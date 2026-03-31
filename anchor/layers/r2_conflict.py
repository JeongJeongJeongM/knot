"""
ANCHOR R2 — Conflict Navigation 분석기.
갈등 또는 불편한 상황에서의 반응 패턴을 분석한다.

EXODIA A3(갈등 직접성)과의 차이:
- A3는 "얼마나 직접적인가"의 단일 축 점수
- R2는 "어떤 전략을 쓰는가"의 패턴 분류 + 맥락별 변화
"""
import re
from collections import Counter

from anchor.config import (
    CONFLICT_MODES,
    RECOVERY_SPEED_LABELS,
    PATTERN_FLEXIBILITY_LABELS,
    EPSILON,
)
from anchor.schemas import ConflictNavigation


# 갈등 모드 시그널
_CONFLICT_SIGNALS: dict[str, list[str]] = {
    "direct_engagement": [
        "솔직히 말하면", "직접적으로", "문제가", "이건 아닌 것 같아",
        "확실히 해야", "말해야 할 게 있어", "불만이 있어",
        "이렇게 하면 안 돼", "동의 못해",
    ],
    "diplomatic_approach": [
        "혹시", "어떻게 생각해", "이해는 하는데", "조심스럽지만",
        "말하기 좀 그렇지만", "기분 나쁘면 미안한데", "네 입장도 알겠는데",
        "한편으로는", "다만",
    ],
    "strategic_withdrawal": [
        "나중에 얘기하자", "좀 생각해볼게", "정리되면 말할게",
        "지금은 좀", "시간이 좀 필요해", "머리 좀 식히고",
    ],
    "avoidance": [
        "그냥 됐어", "몰라 그냥", "아무거나", "상관없어",
        "그 얘기는 그만", "됐어 됐어", "넘어가자",
        "굳이", "별거 아니야",
    ],
    "escalation": [
        "맨날 이래", "항상 너는", "지난번에도", "도대체",
        "이게 몇 번째야", "진짜 너무하다", "정말 어이없",
    ],
}

# 갈등 상황 감지 패턴
_CONFLICT_CONTEXT: list[str] = [
    "싸움", "갈등", "불만", "화나", "짜증",
    "논쟁", "다툼", "의견 차이", "문제가",
    "불편", "서운", "섭섭", "안 맞",
]


class R2ConflictAnalyzer:
    """갈등 항법 분석기."""

    def analyze(self, texts: list[str]) -> ConflictNavigation:
        """텍스트 리스트 → ConflictNavigation."""
        if not texts:
            return ConflictNavigation()

        # 갈등 상황 텍스트 분리
        conflict_texts: list[str] = []
        normal_texts: list[str] = []
        pressure_texts: list[str] = []

        for text in texts:
            text_lower = text.lower()
            is_conflict = any(c in text_lower for c in _CONFLICT_CONTEXT)
            if is_conflict:
                conflict_texts.append(text)
                # 강도 높은 갈등
                if any(w in text_lower for w in ["도대체", "맨날", "항상", "진짜"]):
                    pressure_texts.append(text)
            else:
                normal_texts.append(text)

        # 기본 모드 판별 (전체 텍스트 기반)
        default_mode = self._classify_mode(texts)

        # 압박 시 모드 (갈등 텍스트 기반)
        if conflict_texts:
            under_pressure = self._classify_mode(conflict_texts)
        else:
            under_pressure = default_mode

        # 회복 속도 (갈등 후 정상 복귀 패턴)
        recovery = self._estimate_recovery(texts)

        # 패턴 유연성
        flexibility = self._estimate_flexibility(texts)

        # 서술 생성
        narrative = self._generate_narrative(
            default_mode, under_pressure, recovery, flexibility
        )

        return ConflictNavigation(
            default_mode=default_mode,
            under_pressure=under_pressure,
            recovery_speed=recovery,
            pattern_flexibility=flexibility,
            narrative=narrative,
        )

    def _classify_mode(self, texts: list[str]) -> str:
        """텍스트에서 지배적 갈등 모드 판별."""
        mode_counts: Counter = Counter()

        for text in texts:
            text_lower = text.lower()
            for mode, signals in _CONFLICT_SIGNALS.items():
                for signal in signals:
                    if signal in text_lower:
                        mode_counts[mode] += 1
                        break

        if not mode_counts:
            return "diplomatic_approach"  # 기본값

        return mode_counts.most_common(1)[0][0]

    def _estimate_recovery(self, texts: list[str]) -> str:
        """갈등 후 회복 속도 추정."""
        in_conflict = False
        conflict_duration = 0
        recovery_durations: list[int] = []

        for text in texts:
            text_lower = text.lower()
            is_conflict = any(c in text_lower for c in _CONFLICT_CONTEXT)

            if is_conflict:
                in_conflict = True
                conflict_duration += 1
            elif in_conflict:
                # 갈등에서 벗어남
                recovery_durations.append(conflict_duration)
                in_conflict = False
                conflict_duration = 0

        if not recovery_durations:
            return "moderate"

        avg_duration = sum(recovery_durations) / len(recovery_durations)
        if avg_duration <= 2:
            return "fast"
        elif avg_duration <= 5:
            return "moderate"
        else:
            return "slow"

    def _estimate_flexibility(self, texts: list[str]) -> str:
        """패턴 유연성 추정."""
        modes_used: set[str] = set()

        for text in texts:
            text_lower = text.lower()
            for mode, signals in _CONFLICT_SIGNALS.items():
                if any(signal in text_lower for signal in signals):
                    modes_used.add(mode)

        if len(modes_used) >= 3:
            return "flexible"
        elif len(modes_used) >= 2:
            return "medium"
        else:
            return "rigid"

    def _generate_narrative(
        self,
        default_mode: str,
        under_pressure: str,
        recovery: str,
        flexibility: str,
    ) -> str:
        """행동 기술 서술."""
        mode_desc: dict[str, str] = {
            "direct_engagement": "불편한 사안을 직접적으로 꺼내어 논의하는",
            "diplomatic_approach": "상대의 감정을 고려하며 신중하게 접근하는",
            "strategic_withdrawal": "일단 정리한 후 재접근하는",
            "avoidance": "갈등 상황을 우회하거나 넘기는",
            "escalation": "감정이 확대되는 방향으로 반응하는",
        }

        base = f"평상시 {mode_desc.get(default_mode, '중립적인')} 패턴을 보입니다."

        if under_pressure != default_mode:
            pressure_desc = mode_desc.get(under_pressure, "다른")
            base += f" 강한 압박 상황에서는 {pressure_desc} 방향으로 변화합니다."

        return base
