from fastapi import APIRouter, Query
from typing import Optional

from src.business_logics.martingale import run_martingale_simulation

router = APIRouter()


@router.get("/games/martingale")
def martingale_simulator(
    num_simulations: int = Query(1000, ge=1, le=10_000, description="Number of Monte-Carlo runs"),
    base_bet: float = Query(10.0, gt=0, description="Starting bet size"),
    bankroll: float = Query(1000.0, gt=0, description="Initial bankroll"),
    take_profit: float = Query(2000.0, gt=0, description="Stop playing when balance reaches this"),
    max_table_limit: Optional[float] = Query(None, gt=0, description="Max bet the table allows (None = unlimited)"),
) -> dict:
    return run_martingale_simulation(
        num_simulations=num_simulations,
        base_bet=base_bet,
        bankroll=bankroll,
        take_profit=take_profit,
        max_table_limit=max_table_limit,
    )
