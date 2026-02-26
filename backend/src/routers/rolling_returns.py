"""Router for rolling-returns portfolio analysis."""

from __future__ import annotations

from fastapi import APIRouter, Query
from typing import Any

from src.business_logics.rolling_returns import (
    compute_rolling_returns,
    list_portfolios,
)
from src.business_logics.data_refresh import get_data_freshness, refresh_historical_data

router = APIRouter()


@router.get("/rolling-returns/portfolios")
def get_portfolios() -> list[dict[str, str]]:
    """Return the catalogue of available portfolios with metadata."""
    return list_portfolios()


@router.get("/rolling-returns/compute")
def get_rolling_returns(
    portfolios: list[str] = Query(
        ...,
        description="List of portfolio IDs to compute (e.g. simple100, 80_20_World)",
    ),
    years: int = Query(15, ge=1, le=30, description="Rolling window size in years"),
) -> dict[str, Any]:
    """Compute rolling annualised & total returns + distributions."""
    return compute_rolling_returns(portfolios, years)


@router.get("/rolling-returns/data-freshness")
def data_freshness() -> dict:
    """Return information about the bundled historical data."""
    return get_data_freshness()


@router.post("/rolling-returns/refresh-data")
async def refresh_data() -> dict:
    """Attempt to refresh historical data from curvo.eu (HTTP, no Selenium)."""
    return await refresh_historical_data()
