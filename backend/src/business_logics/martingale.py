"""Monte-Carlo Martingale roulette simulator.

European roulette: P(win) = 18/37 ≈ 48.65 %  (red/black bet, 1 : 1 payout).
Martingale strategy: start with *base_bet*; double after every loss; reset to
*base_bet* after every win.
"""

from __future__ import annotations

import math
import random
import statistics
from dataclasses import dataclass, field
from typing import Optional


# ── European roulette probability ────────────────────────────────────────────
P_WIN = 18 / 37  # ≈ 0.4865

# ── Defaults / limits ────────────────────────────────────────────────────────
MAX_SIMULATIONS = 10_000
DEFAULT_SIMULATIONS = 1_000
DEFAULT_BET = 10.0
DEFAULT_BANKROLL = 1_000.0
INTERNAL_MAX_ROUNDS = 100_000  # safety cap – sim ends at bust anyway
SAMPLE_PATHS_COUNT = 100  # balance paths returned for charting


@dataclass
class SimulationResult:
    """Outcome of a single session."""

    final_balance: float
    rounds_played: int
    peak_balance: float
    went_bust: bool
    took_profit: bool
    max_consecutive_losses: int
    max_bet_placed: float


@dataclass
class MartingaleStats:
    """Aggregated statistics returned to the client."""

    # inputs echo
    num_simulations: int
    base_bet: float
    max_table_limit: Optional[float]
    take_profit: float
    bankroll: float

    # headline numbers
    bust_rate: float  # 0-1
    take_profit_rate: float  # 0-1  (reached the take-profit target)
    profit_probability: float  # 0-1
    average_final_balance: float
    median_final_balance: float
    min_final_balance: float
    max_final_balance: float
    std_final_balance: float
    average_profit: float
    median_profit: float

    # survival
    average_rounds_played: float
    median_rounds_played: float

    # risk
    average_peak_balance: float
    average_max_consecutive_losses: float
    average_max_bet_placed: float
    sharpe_ratio: float  # mean(profit) / std(profit), 0 if std=0

    # distribution data (for histogram)
    balance_histogram_bins: list[float]
    balance_histogram_counts: list[int]

    # percentiles
    percentile_5: float
    percentile_25: float
    percentile_75: float
    percentile_95: float

    # sample paths: list of {round: [...], balance: [...]}
    sample_paths: list[dict[str, list[float]]]


# ─────────────────────────────────────────────────────────────────────────────
def _run_single(
    base_bet: float,
    bankroll: float,
    take_profit: float,
    max_table_limit: Optional[float],
) -> tuple[SimulationResult, list[float], list[float]]:
    """Simulate one Martingale session until bust, take-profit, or safety cap.

    Returns (result, balance_path, bet_path).
    """
    balance = bankroll
    current_bet = base_bet
    peak = balance
    max_consec_losses = 0
    consec_losses = 0
    max_bet = base_bet
    path: list[float] = [balance]
    bets: list[float] = [0.0]  # no bet on "round 0"

    rounds_played = 0
    for _ in range(INTERNAL_MAX_ROUNDS):
        # Can't bet more than we have
        if current_bet > balance:
            current_bet = balance
        if current_bet <= 0:
            break

        # Enforce table limit
        if max_table_limit is not None and current_bet > max_table_limit:
            current_bet = max_table_limit

        max_bet = max(max_bet, current_bet)
        rounds_played += 1

        bet_placed = current_bet  # record before outcome

        if random.random() < P_WIN:
            # Win
            balance += current_bet
            current_bet = base_bet
            consec_losses = 0
        else:
            # Lose
            balance -= current_bet
            consec_losses += 1
            max_consec_losses = max(max_consec_losses, consec_losses)
            current_bet *= 2  # Martingale double

        peak = max(peak, balance)
        path.append(balance)
        bets.append(bet_placed)

        if balance <= 0:
            balance = 0.0
            break

        # Take-profit target reached
        if balance >= take_profit:
            break

    return (
        SimulationResult(
            final_balance=balance,
            rounds_played=rounds_played,
            peak_balance=peak,
            went_bust=balance <= 0,
            took_profit=balance >= take_profit,
            max_consecutive_losses=max_consec_losses,
            max_bet_placed=max_bet,
        ),
        path,
        bets,
    )


def _histogram(values: list[float], num_bins: int = 40) -> tuple[list[float], list[int]]:
    """Build a simple histogram (bin edges + counts)."""
    if not values:
        return [], []
    lo, hi = min(values), max(values)
    if lo == hi:
        return [lo, lo + 1], [len(values)]
    bin_width = (hi - lo) / num_bins
    bins = [lo + i * bin_width for i in range(num_bins + 1)]
    counts = [0] * num_bins
    for v in values:
        idx = min(int((v - lo) / bin_width), num_bins - 1)
        counts[idx] += 1
    return bins, counts


# ─────────────────────────────────────────────────────────────────────────────
def run_martingale_simulation(
    num_simulations: int = DEFAULT_SIMULATIONS,
    base_bet: float = DEFAULT_BET,
    bankroll: float = DEFAULT_BANKROLL,
    take_profit: float = 2000.0,
    max_table_limit: Optional[float] = None,
    seed: Optional[int] = None,
) -> dict:
    """Run Monte-Carlo and return rich statistics as a plain dict."""

    # Clamp inputs
    num_simulations = max(1, min(num_simulations, MAX_SIMULATIONS))
    base_bet = max(0.01, base_bet)
    bankroll = max(base_bet, bankroll)
    take_profit = max(bankroll, take_profit)

    if seed is not None:
        random.seed(seed)

    results: list[SimulationResult] = []
    paths: list[list[float]] = []
    bet_paths: list[list[float]] = []

    for _ in range(num_simulations):
        res, path, bpath = _run_single(base_bet, bankroll, take_profit, max_table_limit)
        results.append(res)
        paths.append(path)
        bet_paths.append(bpath)

    # ── aggregate ────────────────────────────────────────────────────────
    finals = [r.final_balance for r in results]
    profits = [r.final_balance - bankroll for r in results]
    rounds_list = [r.rounds_played for r in results]

    sorted_finals = sorted(finals)
    n = len(sorted_finals)

    def percentile(pct: float) -> float:
        k = (n - 1) * pct / 100
        f = math.floor(k)
        c = min(f + 1, n - 1)
        d = k - f
        return sorted_finals[f] + d * (sorted_finals[c] - sorted_finals[f])

    bust_count = sum(1 for r in results if r.went_bust)
    take_profit_count = sum(1 for r in results if r.took_profit)
    profit_count = sum(1 for f in finals if f > bankroll)

    # Sharpe ratio: mean(profit) / std(profit), risk-free rate = 0
    std_profit = statistics.stdev(profits) if num_simulations > 1 else 0.0
    sharpe = (statistics.mean(profits) / std_profit) if std_profit > 0 else 0.0

    bins, counts = _histogram(finals)

    # Pick sample paths (evenly spaced + some interesting ones)
    sample_indices = list(
        sorted(
            set(
                list(range(0, num_simulations, max(1, num_simulations // SAMPLE_PATHS_COUNT)))
            )
        )
    )[:SAMPLE_PATHS_COUNT]
    sample_paths = [
        {
            "round": list(range(len(paths[i]))),
            "balance": paths[i],
            "bet": bet_paths[i],
        }
        for i in sample_indices
    ]

    stats = MartingaleStats(
        num_simulations=num_simulations,
        base_bet=base_bet,
        max_table_limit=max_table_limit,
        take_profit=take_profit,
        bankroll=bankroll,
        bust_rate=bust_count / num_simulations,
        take_profit_rate=take_profit_count / num_simulations,
        profit_probability=profit_count / num_simulations,
        average_final_balance=statistics.mean(finals),
        median_final_balance=statistics.median(finals),
        min_final_balance=min(finals),
        max_final_balance=max(finals),
        std_final_balance=statistics.stdev(finals) if num_simulations > 1 else 0.0,
        average_profit=statistics.mean(profits),
        median_profit=statistics.median(profits),
        average_rounds_played=statistics.mean(rounds_list),
        median_rounds_played=statistics.median(rounds_list),
        average_peak_balance=statistics.mean([r.peak_balance for r in results]),
        average_max_consecutive_losses=statistics.mean(
            [r.max_consecutive_losses for r in results]
        ),
        average_max_bet_placed=statistics.mean([r.max_bet_placed for r in results]),
        sharpe_ratio=sharpe,
        balance_histogram_bins=bins,
        balance_histogram_counts=counts,
        percentile_5=percentile(5),
        percentile_25=percentile(25),
        percentile_75=percentile(75),
        percentile_95=percentile(95),
        sample_paths=sample_paths,
    )

    # Return as plain dict for JSON serialization
    return stats.__dict__
