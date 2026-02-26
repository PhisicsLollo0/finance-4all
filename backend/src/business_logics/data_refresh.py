"""
Lightweight data-refresh module.

Fetches market-index data from curvo.eu's fingerprinted JSON assets,
converts it to CSV, and merges into the Historical_data_updated.csv file.
No Selenium required.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

import httpx
import pandas as pd

logger = logging.getLogger(__name__)

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_HISTORICAL_CSV = _DATA_DIR / "Historical_data_updated.csv"

_CURVO_BASE = "https://curvo.eu"
_ASSET_MAP_URL = f"{_CURVO_BASE}/backtest/data/asset-map.json"

# Map: CSV filename → (curvo slug, column name in the historical CSV)
CURVO_INDEXES: list[tuple[str, str, str]] = [
    ("MSCI_World.csv",                                  "msci-world",                                       "MSCI World"),
    ("MSCI_Europe_Small_Cap_Value_Weighted.csv",        "msci-europe-small-cap-value-weighted",              "MSCI Europe Small Cap Value Weighted"),
    ("MSCI_Europe.csv",                                 "msci-europe",                                      "MSCI Europe"),
    ("MSCI_ACWI.csv",                                   "msci-acwi",                                        "MSCI ACWI"),
    ("S&P_500_Minimum_Volatility.csv",                  "sp-500-minimum-volatility",                        "S&P 500 Minimum Volatility"),
    ("MSCI_Emerging_Markets.csv",                       "msci-emerging-markets",                            "MSCI Emerging Markets"),
    ("FTSE_World_Government_Bond_Developed_Markets.csv","ftse-world-government-bond-developed-markets",     "FTSE World Government Bond - Developed Markets"),
    ("S&P_500.csv",                                     "sp-500",                                           "S&P 500"),
    ("MSCI_USA_Small_Cap_Value_Weighted.csv",           "msci-usa-small-cap-value-weighted",                "MSCI USA Small Cap Value Weighted"),
    ("MSCI_World_Momentum.csv",                         "msci-world-momentum",                              "MSCI World Momentum"),
    ("MSCI_World_Quality.csv",                          "msci-world-sector-neutral-quality",                "MSCI World Sector Neutral Quality"),
    ("MSCI_EMU.csv",                                    "msci-emu",                                         "MSCI EMU"),
]


async def _fetch_asset_map(client: httpx.AsyncClient) -> dict[str, str] | None:
    """Fetch the asset-map.json that maps data paths to fingerprinted URLs."""
    try:
        resp = await client.get(_ASSET_MAP_URL, timeout=15, follow_redirects=True)
        if resp.status_code == 200:
            return resp.json()
    except Exception as exc:
        logger.warning("Failed to fetch asset map: %s", exc)
    return None


def _json_to_dataframe(json_data: list[dict], column_name: str) -> pd.DataFrame:
    """
    Convert curvo JSON data ``[{date, value}, ...]`` to a DataFrame with
    ``Date`` (MM/YYYY) and a value column normalised to start at 10 000.
    """
    if not json_data:
        return pd.DataFrame()

    first_value = json_data[0]["value"]
    rows: list[dict] = []
    for entry in json_data:
        dt = datetime.strptime(entry["date"], "%Y-%m-%d")
        normalised = (entry["value"] / first_value) * 10_000
        rows.append({"Date": dt.strftime("%m/%Y"), column_name: normalised})

    return pd.DataFrame(rows)


async def _download_index(
    client: httpx.AsyncClient,
    asset_map: dict[str, str],
    slug: str,
    column_name: str,
) -> pd.DataFrame | None:
    """Download a single index's JSON data and return it as a DataFrame."""
    asset_key = f"/data/{slug}.json"
    fingerprinted_path = asset_map.get(asset_key)
    if not fingerprinted_path:
        logger.warning("Slug %r not found in asset map", slug)
        return None

    url = f"{_CURVO_BASE}{fingerprinted_path}"
    try:
        resp = await client.get(url, timeout=30, follow_redirects=True)
        if resp.status_code == 200:
            json_data = resp.json()
            return _json_to_dataframe(json_data, column_name)
    except Exception as exc:
        logger.warning("Failed to download %s: %s", slug, exc)

    return None


def _merge_into_historical(frames: dict[str, pd.DataFrame]) -> None:
    """Merge downloaded DataFrames into the historical CSV."""
    now = datetime.now()
    all_dates = pd.date_range(start="1975-01", end=now.strftime("%Y-%m"), freq="MS").strftime("%m/%Y").tolist()
    merged = pd.DataFrame({"Date": all_dates})

    for _filename, df in frames.items():
        merged = pd.merge(merged, df, on="Date", how="left")

    if _HISTORICAL_CSV.exists():
        try:
            existing = pd.read_csv(_HISTORICAL_CSV)
            # Parse dates for alignment
            existing_dt = existing.copy()
            existing_dt["_dt"] = pd.to_datetime(existing_dt["Date"], format="%m/%Y", errors="coerce")
            merged_dt = merged.copy()
            merged_dt["_dt"] = pd.to_datetime(merged_dt["Date"], format="%m/%Y", errors="coerce")

            existing_dt = existing_dt.set_index("_dt")
            merged_dt = merged_dt.set_index("_dt")

            # Drop the string Date col before combining
            existing_dt = existing_dt.drop(columns=["Date"], errors="ignore")
            merged_dt = merged_dt.drop(columns=["Date"], errors="ignore")

            full_index = existing_dt.index.union(merged_dt.index).sort_values()
            all_cols = list(dict.fromkeys(list(existing_dt.columns) + list(merged_dt.columns)))

            existing_aligned = existing_dt.reindex(index=full_index, columns=all_cols)
            new_aligned = merged_dt.reindex(index=full_index, columns=all_cols)

            combined = new_aligned.combine_first(existing_aligned)
            combined = combined.reset_index()
            combined["Date"] = combined["_dt"].dt.strftime("%m/%Y")
            combined = combined.drop(columns=["_dt"])
            # Reorder so Date is first
            cols = ["Date"] + [c for c in combined.columns if c != "Date"]
            combined = combined[cols]
            combined.to_csv(_HISTORICAL_CSV, index=False)
        except Exception as exc:
            logger.error("Error merging historical data: %s", exc)
            merged.to_csv(_HISTORICAL_CSV, index=False)
    else:
        merged.to_csv(_HISTORICAL_CSV, index=False)


async def refresh_historical_data() -> dict:
    """
    Download fresh data from curvo.eu, merge into the historical file.
    Returns a summary dict.
    """
    downloaded: list[str] = []
    failed: list[str] = []
    frames: dict[str, pd.DataFrame] = {}

    async with httpx.AsyncClient() as client:
        asset_map = await _fetch_asset_map(client)
        if asset_map is None:
            return {
                "status": "error",
                "downloaded": [],
                "failed": [f for f, _, _ in CURVO_INDEXES],
                "message": "Could not fetch asset map from curvo.eu.",
            }

        for filename, slug, column_name in CURVO_INDEXES:
            df = await _download_index(client, asset_map, slug, column_name)
            if df is not None and not df.empty:
                downloaded.append(filename)
                frames[filename] = df
            else:
                failed.append(filename)

    if not downloaded:
        return {
            "status": "no_updates",
            "downloaded": downloaded,
            "failed": failed,
            "message": "Could not download any index data from curvo.eu.",
        }

    _merge_into_historical(frames)

    return {
        "status": "partial" if failed else "ok",
        "downloaded": downloaded,
        "failed": failed,
        "message": f"Downloaded {len(downloaded)}/{len(CURVO_INDEXES)} indexes and updated historical data.",
    }


def get_data_freshness() -> dict:
    """Return metadata about how fresh the bundled data is."""
    if not _HISTORICAL_CSV.exists():
        return {"exists": False}

    df = pd.read_csv(_HISTORICAL_CSV, usecols=["Date"], nrows=0)
    # Quick check: read last non-empty row
    df_full = pd.read_csv(_HISTORICAL_CSV, usecols=["Date"])
    last_date = df_full["Date"].dropna().iloc[-1] if not df_full.empty else None

    stat = _HISTORICAL_CSV.stat()
    return {
        "exists": True,
        "last_date_in_data": last_date,
        "file_modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "file_size_kb": round(stat.st_size / 1024, 1),
    }
