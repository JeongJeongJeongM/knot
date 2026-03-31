"""
ANCHOR R3 — Emotional Availability 분석기.
상대의 감정에 얼마나 반응하고 공간을 만들어주는가.
"""
import re
from collections import Counter

from anchor.config import EPSILON
from anchor.schemas import EmotionalAvailability


_EMPATHIC_SIGNALS: list[str] = [
    "그랬구나", "힘들었겠다", "이해해", "맞아 그럴 수 있어",
    "당연히 그렇지", "많이 힘들었을 텐데", "어떤 기분이었어",
    "더 얘기해줘", "괜찮아", "네 마음이 어때",
]

_DISMISSIVE_SIGNALS: list[str] = [
    "에이 그 정도로", "좀 오버 아니야", "별거 아니야",
    "너무 예민해", "감정적이야", "쿨하게 넘겨",
    "다 그래", "원래 그런 거야",
]

_SOLUTION_SIGNALS: list[str] = [
    "이렇게 해봐", "해결책은", "방법이 있어",
    "~하면 돼", "내가 도와줄게", "그러지 말고",
    "차라리", "그냥 ~해",
]

_SPACE_HOLDING_SIGNALS: list[str] = [
    "천천히 얘기해", "급할 거 없어", "다 들을게",
    "네 속도대로", "준비되면 말해", "여기 있을게",
]

_SELF_DISCLOSURE_SIGNALS: list[str] = [
    "나도 그런 적", "솔직히 나는", "내 경험에는",
    "나한테도", "나도 사실", "내 얘기인데",
]


class R3EmotionalAnalyzer:
    """정서적 가용성 분석기."""

    def analyze(self, texts: list[str]) -> EmotionalAvailability:
        if not texts:
            return EmotionalAvailability()

        total = len(texts)
        empathic = 0
        dismissive = 0
        solution = 0
        space = 0
        disclosure = 0

        for text in texts:
            tl = text.lower()
            if any(s in tl for s in _EMPATHIC_SIGNALS):
                empathic += 1
            if any(s in tl for s in _DISMISSIVE_SIGNALS):
                dismissive += 1
            if any(s in tl for s in _SOLUTION_SIGNALS):
                solution += 1
            if any(s in tl for s in _SPACE_HOLDING_SIGNALS):
                space += 1
            if any(s in tl for s in _SELF_DISCLOSURE_SIGNALS):
                disclosure += 1

        # Recognition speed (empathic 반응 비율로 추정)
        empathic_ratio = empathic / (total + EPSILON)
        if empathic_ratio > 0.2:
            recognition = "quick"
        elif empathic_ratio > 0.08:
            recognition = "moderate"
        else:
            recognition = "slow"

        # Response style
        style_counts = {
            "dismissive": dismissive,
            "acknowledging": max(0, total - empathic - dismissive - solution - space),
            "supportive": solution + space,
            "empathic_exploration": empathic,
        }
        response_style = max(style_counts, key=style_counts.get)  # type: ignore
        if all(v == 0 for v in style_counts.values()):
            response_style = "acknowledging"

        # Solution vs Space
        sol_total = solution + space + EPSILON
        if solution / sol_total > 0.7:
            sol_vs_space = "solution_focused"
        elif space / sol_total > 0.7:
            sol_vs_space = "space_holding"
        else:
            sol_vs_space = "balanced"

        # Self-disclosure
        disc_ratio = disclosure / (total + EPSILON)
        if disc_ratio > 0.15:
            self_disc = "open"
        elif disc_ratio > 0.05:
            self_disc = "moderate"
        else:
            self_disc = "minimal"

        narrative = self._generate_narrative(
            recognition, response_style, sol_vs_space, self_disc
        )

        return EmotionalAvailability(
            recognition=recognition,
            response_style=response_style,
            solution_vs_space=sol_vs_space,
            self_disclosure=self_disc,
            narrative=narrative,
        )

    def _generate_narrative(self, recog, style, svs, disc) -> str:
        style_desc = {
            "dismissive": "감정 표현을 최소화하는",
            "acknowledging": "감정을 인정하되 깊이 들어가지 않는",
            "supportive": "지지적으로 반응하는",
            "empathic_exploration": "공감하며 감정을 함께 탐색하는",
        }
        svs_desc = {
            "solution_focused": "해결책 제시를 선호합니다.",
            "balanced": "해결책과 감정 공간을 균형있게 제공합니다.",
            "space_holding": "감정을 풀 수 있는 공간을 우선 만들어줍니다.",
        }
        return (
            f"상대의 감정에 대해 {style_desc.get(style, '중립적으로')} 패턴을 보이며, "
            f"{svs_desc.get(svs, '')}"
        )
