"""
EXODIA v2 — 차별성 점수 (Differentiation Score).
이 프로필이 모집단 평균에서 얼마나 벗어났는가를 0-100으로 수량화.
"""

from __future__ import annotations

from typing import Any

from exodia.interpretation.vocabulary import AXIS_WEIGHTS, POPULATION_DEFAULTS
from exodia.interpretation.patterns import detect_contradictions, _safe_float


# ═══════════ 희귀 조합 탐지 ═══════════

_KNOWN_RARE_COMBINATIONS: list[dict] = [
    {
        "name": "따뜻하지만 반항적",
        "check": lambda d: _sf(d, "A2") > 0.7 and _sf(d, "A3") > 0.7 and _sf(d, "A4") < 0.4,
        "axes": ["A2", "A3", "A4"],
        "rarity_pct": 0.02,
    },
    {
        "name": "민감하면서 경계심 있는",
        "check": lambda d: _sf(d, "A1") > 0.7 and _sf(d, "A12") > 0.7 and d.get("A11") == "rigid",
        "axes": ["A1", "A12", "A11"],
        "rarity_pct": 0.03,
    },
    {
        "name": "적극적이면서 회피적",
        "check": lambda d: _sf(d, "A1") > 0.7 and d.get("A8") == "avoidant",
        "axes": ["A1", "A8"],
        "rarity_pct": 0.04,
    },
    {
        "name": "냉담하면서 자기노출적",
        "check": lambda d: _sf(d, "A2") < 0.3 and d.get("A9") == "broadcast",
        "axes": ["A2", "A9"],
        "rarity_pct": 0.03,
    },
    {
        "name": "지배적이면서 자기비판적",
        "check": lambda d: _sf(d, "A4") > 0.7 and d.get("A13") == "absorptive",
        "axes": ["A4", "A13"],
        "rarity_pct": 0.02,
    },
    {
        "name": "갈등고착적이면서 성장지향적",
        "check": lambda d: _sf(d, "A14") < 0.3 and d.get("A13") == "growth",
        "axes": ["A14", "A13"],
        "rarity_pct": 0.04,
    },
    {
        "name": "고립적이면서 결속유머",
        "check": lambda d: _sf(d, "A1") < 0.3 and d.get("A17") == "bonding",
        "axes": ["A1", "A17"],
        "rarity_pct": 0.03,
    },
]


def _sf(data: dict, key: str, default: float = 0.5) -> float:
    """Safe float extraction."""
    v = data.get(key, default)
    return float(v) if isinstance(v, (int, float)) else default


def detect_rare_combinations(
    profile_data: dict[str, float | str],
) -> list[dict[str, Any]]:
    """모집단 3% 이하로 나타나는 희귀 조합 탐지."""
    results = []
    for combo in _KNOWN_RARE_COMBINATIONS:
        try:
            if combo["check"](profile_data):
                results.append({
                    "combination": combo["name"],
                    "axes": combo["axes"],
                    "rarity": combo["rarity_pct"],
                })
        except (KeyError, TypeError):
            continue
    return results


# ═══════════ 차별성 점수 계산 ═══════════

def calculate_differentiation_score(
    profile_data: dict[str, float | str],
    population_stats: dict[str, dict[str, float]] | None = None,
) -> dict[str, Any]:
    """프로필의 차별성(uniqueness) 점수 계산.

    Returns:
        {
            "total_score": int (0-100),
            "primary_axes": [(axis, weighted_deviation), ...],
            "rare_combinations": [...],
            "contradictions": [...],
            "interpretation": str,
        }
    """
    stats = population_stats or POPULATION_DEFAULTS

    # Step 1: 각 강도축의 z-score 기반 편차 계산
    axis_deviations: dict[str, float] = {}
    intensity_keys = ["A1", "A2", "A3", "A4", "A5", "A6", "A12", "A14"]

    for axis in intensity_keys:
        value = _sf(profile_data, axis, 0.5)
        mean = stats.get(axis, {"mean": 0.5})["mean"]
        std = stats.get(axis, {"std": 0.2})["std"]
        if std <= 0:
            std = 0.2
        z_score = abs(value - mean) / std
        deviation = min(10.0, z_score * 2)
        axis_deviations[axis] = deviation

    # Step 2: 축별 가중치 적용
    weighted_deviations: dict[str, float] = {}
    for axis, deviation in axis_deviations.items():
        weight = AXIS_WEIGHTS.get(axis, 0.5)
        weighted_deviations[axis] = deviation * weight

    # Step 3: 상위 6개 편차축
    top_axes = sorted(
        weighted_deviations.items(),
        key=lambda x: x[1],
        reverse=True,
    )[:6]
    primary_differentiation = sum(score for _, score in top_axes)

    # Step 4: 희귀 조합 보너스
    rare_combos = detect_rare_combinations(profile_data)
    combination_bonus = len(rare_combos) * 5

    # Step 5: 모순 점수
    contradictions = detect_contradictions(profile_data)
    contradiction_score = len(contradictions) * 3

    # Step 6: 최종 계산 (0-100)
    # primary_differentiation: 실제 범위 0 ~ ~30 (typical z-scores × weights)
    # bonus: 0-35, contradiction: 0-21
    total = primary_differentiation + combination_bonus + contradiction_score
    # 스케일링: total ≈ 20이면 60점, total ≈ 35이면 100점
    final_score = min(100, int(total * 3))

    return {
        "total_score": final_score,
        "primary_axes": top_axes,
        "rare_combinations": rare_combos,
        "contradictions": [
            {"name": c.name_ko, "axes": c.axes, "description": c.description}
            for c in contradictions
        ],
        "interpretation": _interpret_score(final_score),
    }


def _interpret_score(score: int) -> str:
    """점수를 한국어 해석으로 변환."""
    if score >= 90:
        return "매우 특이적 (Highly Distinctive): 이 프로필은 매우 드물다. 극단값들이 의외로 조합되어 있거나, 전형적이지 않은 심리 구조를 가지고 있다."
    elif score >= 75:
        return "상당히 특이적 (Notably Distinctive): 여러 축에서 뚜렷한 편차를 보여준다. 이 사람만의 특별한 특징이 명확하다."
    elif score >= 60:
        return "다소 특이적 (Somewhat Distinctive): 몇몇 축에서 두드러지지만, 전체적으로는 평균 범위 내에 있다."
    elif score >= 40:
        return "평균 범위 (Average Range): 대부분 특성이 평균에 가깝다. 매우 전형적이지도, 매우 특이하지도 않다."
    else:
        return "전형적 (Typical): 대부분 특성이 평균과 유사하다."
