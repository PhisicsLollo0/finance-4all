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
    # ── Stock/Bond Spectrum ──────────────────────────────────────────────────
    # Pure MSCI World + Bonds at different ratios — shows the effect of equity %
    "simple100": {
        "label": "100% Stocks",
        "description": "All-in on MSCI World. Maximum growth potential, maximum volatility.",
        "group": "spectrum",
    },
    "simple80": {
        "label": "80% Stocks · 20% Bonds",
        "description": "Classic growth allocation. Bonds add a small cushion against drawdowns.",
        "group": "spectrum",
    },
    "simple60": {
        "label": "60% Stocks · 40% Bonds",
        "description": "Balanced allocation. Historically smoother ride with lower peaks.",
        "group": "spectrum",
    },
    "simple40": {
        "label": "40% Stocks · 60% Bonds",
        "description": "Conservative allocation. Prioritises capital preservation over growth.",
        "group": "spectrum",
    },
    "simple20": {
        "label": "20% Stocks · 80% Bonds",
        "description": "Defensive allocation. Mostly bonds with a sliver of equity upside.",
        "group": "spectrum",
    },
    "simple0": {
        "label": "100% Bonds",
        "description": "Pure bonds. Lowest volatility, but vulnerable to inflation over decades.",
        "group": "spectrum",
    },
    # ── Classic Allocations ──────────────────────────────────────────────────
    # Well-known portfolio templates using broad market indices
    "80_20_World": {
        "label": "80/20 — MSCI World",
        "description": "80% developed-market stocks + 20% bonds. A popular growth strategy.",
        "group": "classic",
    },
    "80_20_ACWI": {
        "label": "80/20 — MSCI ACWI",
        "description": "Like 80/20 World, but includes emerging markets via ACWI.",
        "group": "classic",
    },
    "60_40_World": {
        "label": "60/40 — MSCI World",
        "description": "The textbook balanced portfolio: 60% stocks, 40% bonds.",
        "group": "classic",
    },
    # ── Factor Tilted (Smart Beta) ───────────────────────────────────────────
    # Portfolios that tilt towards academically-backed risk factors
    "80_20_1factor": {
        "label": "80/20 + Small-Cap Value",
        "description": "Adds a small-cap value tilt to the 80/20 base. Targets the value premium.",
        "group": "factor",
    },
    "80_20_2factors": {
        "label": "80/20 + Value + Momentum",
        "description": "Adds small-cap value and momentum factors to an 80/20 allocation.",
        "group": "factor",
    },
    "100_1factor": {
        "label": "100% Stocks + Small-Cap Value",
        "description": "All-equity with a value tilt. Higher expected return, higher risk.",
        "group": "factor",
    },
    "100_2factors": {
        "label": "100% Stocks + Value + Momentum",
        "description": "All-equity with value and momentum factors. Multi-factor approach.",
        "group": "factor",
    },
    "100_2factors_EUR": {
        "label": "100% Stocks + Value + Momentum + EUR Bias",
        "description": "Multi-factor all-equity with an extra EUR home-bias via MSCI EMU.",
        "group": "factor",
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


def _portfolio_value_series(
    data: pd.DataFrame,
    weights: np.ndarray,
    start_idx: int,
    end_idx: int,
) -> np.ndarray:
    """Build a normalised portfolio value series for a window [start_idx, end_idx]."""
    prices = data.iloc[start_idx : end_idx + 1, 1:].values.astype(float)
    # Normalise each asset to 1 at start
    base = prices[0]
    normed = prices / base  # shape (months+1, n_assets)
    return normed @ weights  # weighted portfolio value


def _compute_risk_metrics_for_portfolio(
    data: pd.DataFrame,
    weights_list: list[float],
    years: int,
) -> dict[str, list]:
    """
    Compute rolling risk metrics for a single portfolio.

    For each rolling window compute:
    - sharpe: annualised Sharpe ratio (assuming 0% risk-free rate)
    - max_drawdown: worst peak-to-trough decline
    - time_underwater: longest streak (months) below the previous peak

    Returns dict with keys: dates, sharpe, max_drawdown, time_underwater.
    """
    dates = data["Date"]
    num_months = 12 * years

    w = np.array(weights_list, dtype=float)
    w = w / w.sum()

    out_dates: list[str] = []
    out_sharpe: list[float] = []
    out_mdd: list[float] = []
    out_underwater: list[int] = []

    for start_idx in range(len(data) - num_months):
        end_idx = start_idx + num_months
        pv = _portfolio_value_series(data, w, start_idx, end_idx)

        # Monthly returns
        monthly_ret = np.diff(pv) / pv[:-1]

        # Sharpe (annualised, rf=0)
        if np.std(monthly_ret) > 0:
            sharpe = (np.mean(monthly_ret) / np.std(monthly_ret)) * math.sqrt(12)
        else:
            sharpe = 0.0

        # Max drawdown
        running_max = np.maximum.accumulate(pv)
        drawdowns = (pv - running_max) / running_max
        max_dd = float(np.min(drawdowns))

        # Time underwater (longest consecutive months below peak)
        is_underwater = pv < running_max
        longest = 0
        current = 0
        for uw in is_underwater:
            if uw:
                current += 1
                longest = max(longest, current)
            else:
                current = 0

        out_dates.append(dates.iloc[start_idx])
        out_sharpe.append(round(float(sharpe), 4))
        out_mdd.append(round(float(max_dd), 6))
        out_underwater.append(longest)

    return {
        "dates": out_dates,
        "sharpe": out_sharpe,
        "max_drawdown": out_mdd,
        "time_underwater": out_underwater,
    }

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
        risk = _compute_risk_metrics_for_portfolio(pruned, weights_vals, years)

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
            "sharpe": risk["sharpe"],
            "max_drawdown": risk["max_drawdown"],
            "time_underwater": risk["time_underwater"],
        }

        arr = np.array(annualised)
        sharpe_arr = np.array(risk["sharpe"])
        mdd_arr = np.array(risk["max_drawdown"])
        uw_arr = np.array(risk["time_underwater"])

        distributions[label] = {
            "values": annualised,
            "median": round(float(np.median(arr)), 6),
            "p5": round(float(np.percentile(arr, 5)), 6),
            "p95": round(float(np.percentile(arr, 95)), 6),
            "mean": round(float(np.mean(arr)), 6),
            "sharpe_median": round(float(np.median(sharpe_arr)), 4),
            "sharpe_mean": round(float(np.mean(sharpe_arr)), 4),
            "max_drawdown_median": round(float(np.median(mdd_arr)), 4),
            "max_drawdown_worst": round(float(np.min(mdd_arr)), 4),
            "time_underwater_median": int(np.median(uw_arr)),
            "time_underwater_worst": int(np.max(uw_arr)),
        }

    return {
        "series": series,
        "distributions": distributions,
        "years": years,
    }
