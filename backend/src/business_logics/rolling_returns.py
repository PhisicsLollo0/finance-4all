"""
Business logic for rolling-returns analysis.

Port of the deprecated Streamlit application's computation layer, now exposed
as pure functions that return JSON-serialisable dicts consumed by the FastAPI
router.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

# ── Paths ────────────────────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
_HISTORICAL_CSV = _DATA_DIR / "Historical_data_updated.csv"
_PORTFOLIOS_DIR = _DATA_DIR / "portfolios"

# ── Portfolio catalogue ──────────────────────────────────────────────────────
PORTFOLIOS: dict[str, dict[str, Any]] = {
    # Complex portfolios
    "100_2factors_EUR": {
        "label": "100% Stocks + SmallCap Value + Momentum + Currency Bias",
        "description": "100% stocks, focusing on small-cap value and momentum, with EUR currency bias.",
        "group": "complex",
    },
    "100_2factors": {
        "label": "100% Stocks + SmallCap Value + Momentum",
        "description": "100% stocks, focusing on small-cap value and momentum strategies.",
        "group": "complex",
    },
    "100_1factor": {
        "label": "100% Stocks + SmallCap Value",
        "description": "100% stocks with small-cap value tilt.",
        "group": "complex",
    },
    "80_20_2factors": {
        "label": "80/20 + SmallCap Value + Momentum",
        "description": "80% stocks, 20% bonds, with small-cap value and momentum factors.",
        "group": "complex",
    },
    "80_20_1factor": {
        "label": "80/20 + SmallCap Value",
        "description": "80% stocks, 20% bonds, with small-cap value.",
        "group": "complex",
    },
    "80_20_ACWI": {
        "label": "80% ACWI + 20% Bonds",
        "description": "80% global stocks (ACWI) and 20% bonds.",
        "group": "complex",
    },
    "80_20_World": {
        "label": "80% World + 20% Bonds",
        "description": "80% MSCI World stocks and 20% bonds.",
        "group": "complex",
    },
    "60_40_World": {
        "label": "60% World + 40% Bonds",
        "description": "Classic 60/40 portfolio: 60% MSCI World, 40% bonds.",
        "group": "complex",
    },
    # Simple portfolios
    "simple100": {
        "label": "100% Stocks",
        "description": "100% MSCI World stocks, aggressive growth.",
        "group": "simple",
    },
    "simple80": {
        "label": "80% Stocks + 20% Bonds",
        "description": "80% MSCI World, 20% bonds.",
        "group": "simple",
    },
    "simple60": {
        "label": "60% Stocks + 40% Bonds",
        "description": "60% MSCI World, 40% bonds.",
        "group": "simple",
    },
    "simple40": {
        "label": "40% Stocks + 60% Bonds",
        "description": "40% MSCI World, 60% bonds.",
        "group": "simple",
    },
    "simple20": {
        "label": "20% Stocks + 80% Bonds",
        "description": "20% MSCI World, 80% bonds.",
        "group": "simple",
    },
    "simple0": {
        "label": "100% Bonds",
        "description": "100% bonds, conservative preservation.",
        "group": "simple",
    },
}


# ── Data helpers ─────────────────────────────────────────────────────────────

def _load_historical_data() -> pd.DataFrame:
    """Load the merged historical CSV (Date + index columns)."""
    df = pd.read_csv(_HISTORICAL_CSV)
    return df


def _load_portfolio_weights(name: str) -> dict[str, float]:
    """Load the JSON weights for a given portfolio name."""
    path = _PORTFOLIOS_DIR / f"{name}.json"
    if not path.exists():
        raise FileNotFoundError(f"Portfolio file not found: {path}")
    with open(path) as f:
        return json.load(f)


def _select_and_prune(data: pd.DataFrame, assets: list[str]) -> pd.DataFrame:
    """Select relevant columns and drop rows with any NaN in asset columns."""
    cols = ["Date"] + [a for a in assets if a in data.columns]
    pruned = data[cols].dropna(subset=cols[1:])
    return pruned


# ── Core computation ─────────────────────────────────────────────────────────

def _compute_annualised_return(
    start_prices: pd.Series,
    end_prices: pd.Series,
    weights: np.ndarray,
    years: int,
) -> float:
    total_return = float(np.dot(end_prices / start_prices, weights))
    return total_return ** (1.0 / years) - 1.0


def _rolling_returns_for_portfolio(
    data: pd.DataFrame,
    weights_list: list[float],
    years: int,
) -> pd.DataFrame:
    """
    Compute rolling annualised returns for a single portfolio.

    Returns DataFrame with columns [Date, return].
    """
    dates = data["Date"]
    num_months = 12 * years
    asset_cols = data.columns[1:]

    weights = np.array(weights_list, dtype=float)
    weights = weights / weights.sum()

    results_date: list[str] = []
    results_return: list[float] = []

    for start_idx in range(len(data) - num_months):
        end_idx = start_idx + num_months
        start_prices = data.iloc[start_idx, 1:].values.astype(float)
        end_prices = data.iloc[end_idx, 1:].values.astype(float)

        ann_ret = _compute_annualised_return(
            pd.Series(start_prices, index=asset_cols),
            pd.Series(end_prices, index=asset_cols),
            weights,
            years,
        )
        results_date.append(dates.iloc[start_idx])
        results_return.append(round(ann_ret, 6))

    return pd.DataFrame({"Date": results_date, "return": results_return})


# ── Public API ───────────────────────────────────────────────────────────────

def list_portfolios() -> list[dict[str, str]]:
    """Return the catalogue of available portfolios."""
    return [
        {"id": pid, **info}
        for pid, info in PORTFOLIOS.items()
    ]


def compute_rolling_returns(
    portfolio_ids: list[str],
    years: int = 15,
) -> dict[str, Any]:
    """
    Compute rolling annualised returns for the requested portfolios.

    Returns
    -------
    {
      "dates": ["01/1990", ...],
      "series": {
        "<portfolio_label>": { "annualised": [...], "total": [...] }
      },
      "distributions": {
        "<portfolio_label>": {
          "values": [...],
          "median": float,
          "p5": float,
          "p95": float,
          "mean": float,
        }
      },
      "years": int,
    }
    """
    historical = _load_historical_data()

    all_dates: list[str] | None = None
    series: dict[str, dict[str, list[float]]] = {}
    distributions: dict[str, dict[str, Any]] = {}

    for pid in portfolio_ids:
        if pid not in PORTFOLIOS:
            continue

        weights_dict = _load_portfolio_weights(pid)
        assets = list(weights_dict.keys())
        weights_vals = list(weights_dict.values())

        pruned = _select_and_prune(historical, assets)
        if len(pruned) < 12 * years + 1:
            continue

        result = _rolling_returns_for_portfolio(pruned, weights_vals, years)

        label = PORTFOLIOS[pid]["label"]
        dates_list = result["Date"].tolist()
        annualised = result["return"].tolist()
        total = [(math.pow(1 + r, years) - 1) for r in annualised]

        if all_dates is None:
            all_dates = dates_list

        series[label] = {
            "annualised": annualised,
            "total": total,
            "dates": dates_list,
        }

        arr = np.array(annualised)
        distributions[label] = {
            "values": annualised,
            "median": round(float(np.median(arr)), 6),
            "p5": round(float(np.percentile(arr, 5)), 6),
            "p95": round(float(np.percentile(arr, 95)), 6),
            "mean": round(float(np.mean(arr)), 6),
        }

    return {
        "series": series,
        "distributions": distributions,
        "years": years,
    }
