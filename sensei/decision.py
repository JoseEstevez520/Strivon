"""Cost-aware decisions.

The scoring is asymmetric (over-estimating stock costs -3, under-estimating -2,
a correct answer +1), so the best answer is the one with the highest *expected
points* under our probability estimate, not the most likely class.
"""
from __future__ import annotations

import numpy as np

from . import config

LEVELS = config.LEVEL_NAMES  # empty, half, full
VALUES = np.array([0.0, 0.5, 1.0])


def stock_payoff() -> np.ndarray:
    """payoff[pred, true]"""
    p = np.zeros((3, 3))
    for i in range(3):
        for j in range(3):
            if i == j:
                p[i, j] = config.SCORE_STOCK_CORRECT
            elif i < j:
                p[i, j] = config.SCORE_STOCK_BELOW
            else:
                p[i, j] = config.SCORE_STOCK_ABOVE
    return p


PAYOFF = stock_payoff()


def expected_stock_points(probs: np.ndarray) -> np.ndarray:
    """probs: (..., 3) over [empty, half, full] -> expected points per decision (..., 3)."""
    return probs @ PAYOFF.T


def decide_stock(probs) -> tuple[str, float, np.ndarray]:
    probs = np.asarray(probs, dtype=float)
    probs = probs / probs.sum()
    ev = expected_stock_points(probs)
    k = int(np.argmax(ev))
    return LEVELS[k], float(VALUES[k]), ev


def decide_compliance(p_compliant: float) -> tuple[bool, float]:
    """+1/-2 symmetric costs -> flag a mismatch only when P(compliant) < 0.5."""
    ev_true = p_compliant * config.SCORE_ID_CORRECT + (1 - p_compliant) * config.SCORE_ID_WRONG
    ev_false = (1 - p_compliant) * config.SCORE_ID_CORRECT + p_compliant * config.SCORE_ID_WRONG
    return (ev_true >= ev_false), max(ev_true, ev_false)
