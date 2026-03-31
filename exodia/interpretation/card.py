"""
EXODIA v3 — Sharing Card Data Generator.

Generates structured data for rendering share cards.
Actual rendering (HTML/PNG) is handled by the frontend.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional

from exodia.interpretation.identity import Identity, MatchIdentity
from exodia.interpretation.differentiation import calculate_differentiation_score


@dataclass
class TraitChip:
    """A single trait chip for the card."""
    label: str       # e.g. "감정 밀도 상위 9%"
    direction: str   # "high" or "low"
    percentile: int   # 0-100


@dataclass
class IndividualCardData:
    """All data needed to render an individual share card."""
    identity: Identity
    rarity_pct: float          # e.g. 4.2
    rarity_label: str          # e.g. "매우 드문 조합"
    trait_chips: List[TraitChip]
    quote: str                 # 2-3 sentence summary for card


@dataclass
class MatchingCardData:
    """All data needed to render a matching share card."""
    match_identity: MatchIdentity
    identity_a: Identity
    identity_b: Identity
    compatibility: int
    tension: str
    growth: str
    rarity_pct: float
    quote: str


# ─── Population percentile estimation ────────────────────────────

_INTENSITY_AXES = ["A1", "A2", "A3", "A4", "A5", "A6", "A12", "A14"]
_AXIS_LABELS = {
    "A1": "감정의 밀도",
    "A2": "정서적 안정감",
    "A3": "감정 표현 빈도",
    "A4": "자기 확신도",
    "A5": "사회적 주도성",
    "A6": "권위 수용도",
    "A12": "친밀감 수용도",
    "A14": "변화 수용성",
}


def _estimate_percentile(value: float, mean: float = 0.5, std: float = 0.2) -> int:
    """Rough percentile estimate using normal distribution approximation."""
    import math
    z = (value - mean) / std if std > 0 else 0
    # Approximate CDF using logistic function
    cdf = 1.0 / (1.0 + math.exp(-1.7 * z))
    return max(1, min(99, int(cdf * 100)))


def _get_top_distinctive_traits(profile_data: Dict, n: int = 3) -> List[TraitChip]:
    """Find most distinctive intensity axes (furthest from mean)."""
    scored = []
    for axis in _INTENSITY_AXES:
        val = profile_data.get(axis)
        if val is None:
            continue
        if isinstance(val, dict):
            val = val.get("value", 0.5)
        val = float(val)
        pct = _estimate_percentile(val)
        deviation = abs(val - 0.5)
        label = _AXIS_LABELS.get(axis, axis)

        if pct >= 50:
            chip_label = f"{label} 상위 {100 - pct}%"
            direction = "high"
        else:
            chip_label = f"{label} 하위 {pct}%"
            direction = "low"

        scored.append((deviation, TraitChip(
            label=chip_label,
            direction=direction,
            percentile=pct,
        )))

    scored.sort(key=lambda x: -x[0])
    return [s[1] for s in scored[:n]]


def generate_individual_card(
    profile_data: Dict,
    identity: Identity,
) -> IndividualCardData:
    """
    Generate all data needed for an individual share card.

    Args:
        profile_data: axis data dict
        identity: pre-generated Identity

    Returns:
        IndividualCardData with all rendering data
    """
    diff = calculate_differentiation_score(profile_data)
    score = diff["score"]

    # Rarity percentage (rough: score 70 → ~4%, score 50 → ~15%)
    if score >= 80:
        rarity_pct = round(max(1.0, (100 - score) / 8), 1)
        rarity_label = "극히 드문 조합"
    elif score >= 60:
        rarity_pct = round(max(2.0, (100 - score) / 5), 1)
        rarity_label = "매우 드문 조합"
    elif score >= 40:
        rarity_pct = round((100 - score) / 3, 1)
        rarity_label = "드문 편"
    else:
        rarity_pct = round(max(20.0, (100 - score) / 2), 1)
        rarity_label = "비교적 흔한 편"

    traits = _get_top_distinctive_traits(profile_data, n=3)

    return IndividualCardData(
        identity=identity,
        rarity_pct=rarity_pct,
        rarity_label=rarity_label,
        trait_chips=traits,
        quote=identity.summary,
    )


def generate_matching_card(
    profile_a: Dict,
    profile_b: Dict,
    match_identity: MatchIdentity,
    identity_a: Identity,
    identity_b: Identity,
) -> MatchingCardData:
    """
    Generate all data needed for a matching share card.
    """
    # Estimate rarity of this combination
    diff_a = calculate_differentiation_score(profile_a)
    diff_b = calculate_differentiation_score(profile_b)
    combined = (diff_a["score"] + diff_b["score"]) / 2
    rarity_pct = round(max(2.0, (100 - combined) / 6), 1)

    return MatchingCardData(
        match_identity=match_identity,
        identity_a=identity_a,
        identity_b=identity_b,
        compatibility=match_identity.compatibility,
        tension=match_identity.tension,
        growth=match_identity.growth,
        rarity_pct=rarity_pct,
        quote=match_identity.summary,
    )
