def run_linear_simulation(m: float = 1.0) -> dict[str, float]:
    return {"m": m}


def run_investment_simulation(
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
