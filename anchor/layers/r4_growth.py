"""
ANCHOR R4 — Growth Orientation 분석기.
현재 상태에 대한 태도와 변화 의지를 분석한다.
"""
import re
from collections import Counter

from anchor.config import EPSILON
from anchor.schemas import GrowthOrientation


_ACTIVE_GROWTH_SIGNALS: list[str] = [
    "배우고 싶", "도전", "성장", "발전", "개선",
    "새로운 시도", "변화", "목표", "계획",
    "노력", "공부", "연습", "더 나아",
]

_REFLECTIVE_SIGNALS: list[str] = [
    "돌아보면", "경험상", "교훈", "깨달",
    "알게 됐", "배웠", "실수에서", "반성",
]

_STABILITY_SIGNALS: list[str] = [
    "현재가 좋", "만족", "이대로", "편안",
    "굳이", "바꿀 필요", "충분", "안정",
]

_EXTERNAL_SIGNALS: list[str] = [
    "시키면", "해야 하니까", "어쩔 수 없", "강제",
    "의무", "분위기상", "다들 그러니까",
]


class R4GrowthAnalyzer:
    """성장 지향성 분석기."""

    def analyze(self, texts: list[str]) -> GrowthOrientation:
        if not texts:
            return GrowthOrientation()

        total = len(texts)
        active = 0
        reflective = 0
        stability = 0
        external = 0

        for text in texts:
            tl = text.lower()
            if any(s in tl for s in _ACTIVE_GROWTH_SIGNALS):
                active += 1
            if any(s in tl for s in _REFLECTIVE_SIGNALS):
                reflective += 1
            if any(s in tl for s in _STABILITY_SIGNALS):
                stability += 1
            if any(s in tl for s in _EXTERNAL_SIGNALS):
                external += 1

        counts = {
            "active_growth": active,
            "reflective_growth": reflective,
            "stability_oriented": stability,
            "externally_driven": external,
        }
        orientation = max(counts, key=counts.get)  # type: ignore
        if all(v == 0 for v in counts.values()):
            orientation = "reflective_growth"

        # Change tolerance
        change_signals = active + reflective
        resist_signals = stability + external
        change_total = change_signals + resist_signals + EPSILON
        change_ratio = change_signals / change_total

        if change_ratio > 0.65:
            change_tolerance = "high"
        elif change_ratio > 0.35:
            change_tolerance = "moderate"
        else:
            change_tolerance = "low"

        # Improvement frequency
        improvement_ratio = (active + reflective) / (total + EPSILON)
        if improvement_ratio > 0.2:
            frequency = "frequent"
        elif improvement_ratio > 0.08:
            frequency = "periodic"
        else:
            frequency = "rare"

        narrative = self._generate_narrative(orientation, change_tolerance)

        return GrowthOrientation(
            orientation=orientation,
            change_tolerance=change_tolerance,
            self_improvement_frequency=frequency,
            narrative=narrative,
        )

    def _generate_narrative(self, orientation, tolerance) -> str:
        orient_desc = {
            "active_growth": "지속적인 자기 개선과 새로운 시도를 추구하는 패턴을 보입니다.",
            "reflective_growth": "경험에서 배우며 점진적으로 성장하는 패턴을 보입니다.",
            "stability_oriented": "현재의 안정적인 상태를 선호하는 패턴을 보입니다.",
            "externally_driven": "외부 자극이나 환경 변화에 의해 움직이는 패턴을 보입니다.",
        }
        return orient_desc.get(orientation, "")
