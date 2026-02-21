from fastapi import APIRouter

from src.business_logics.simulations import (
    run_investment_simulation,
    run_linear_simulation,
)

router = APIRouter()


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/simulators/linear")
def linear_simulator(m: float = 1.0) -> dict[str, float]:
    return run_linear_simulation(m)


@router.get("/simulators/investment")
def investment_simulator(
    initial: float = 1000.0,
    growth_rate: float = 0.07,
    fee_a: float = 0.0,
    fee_b: float = 0.02,
    years: int = 30,
) -> dict[str, object]:
    return run_investment_simulation(initial, growth_rate, fee_a, fee_b, years)
