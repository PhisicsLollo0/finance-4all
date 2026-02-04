from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Finance Simulators API")
router = APIRouter()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/simulators/linear")
def linear_simulator(m: float = 1.0) -> dict[str, float]:
    return {"m": m}


@router.get("/simulators/investment")
def investment_simulator(
    initial: float = 1000.0,
    growth_rate: float = 0.07,
    fee_a: float = 0.0,
    fee_b: float = 0.02,
    years: int = 30,
) -> dict[str, object]:
    if years < 1:
        years = 1
    if initial < 0:
        initial = 0.0

    def build_series(fee_rate: float) -> list[float]:
        balances = [initial]
        net_rate = growth_rate - fee_rate
        for _ in range(years):
            balances.append(balances[-1] * (1 + net_rate))
        return balances

    years_series = list(range(0, years + 1))
    return {
        "inputs": {
            "initial": initial,
            "growth_rate": growth_rate,
            "fee_a": fee_a,
            "fee_b": fee_b,
            "years": years,
        },
        "years": years_series,
        "series": {
            "fee_a": build_series(fee_a),
            "fee_b": build_series(fee_b),
        },
    }


# Support both `/simulators/*` and `/api/simulators/*` paths.
app.include_router(router)
app.include_router(router, prefix="/api")
