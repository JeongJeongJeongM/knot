"""
ANCHOR R1 — Attachment Signal 분석기.
대화 패턴에서 애착 경향성을 추론한다.

⚠️ 법적 안전 원칙:
"당신은 불안형입니다" ← 금지
"감정적 압박 시 확인 요구가 증가하는 패턴이 관찰됩니다" ← 허용
"""
import re
from collections import Counter

from anchor.config import (
    ATTACHMENT_TENDENCIES,
    STRESS_SHIFT_PATTERNS,
    REASSURANCE_SEEKING_HIGH,
    EMOTIONAL_AVOIDANCE_HIGH,
    EPSILON,
)
from anchor.schemas import AttachmentSignal


# 애착 경향 시그널 패턴
_SECURE_SIGNALS: list[str] = [
    "괜찮아", "이해해", "고마워", "알겠어", "맞아",
    "당연하지", "그럴 수 있지", "충분해", "함께",
]

_ANXIOUS_SIGNALS: list[str] = [
    "왜 답 안 해", "언제 연락", "나 싫어", "혼자",
    "확인", "진짜", "불안", "걱정", "왜 안 돼",
    "나한테 관심", "무시하는 거", "다른 사람",
    "어디야", "뭐하는 거야", "화났어",
]

_AVOIDANT_SIGNALS: list[str] = [
    "그냥", "몰라", "알아서 해", "바빠", "나중에",
    "상관없어", "별로", "귀찮", "그런 얘기 왜",
    "감정적이지 마", "오버하지 마",
]

_DISORGANIZED_SIGNALS: list[str] = [
    "사랑해 근데 짜증나", "보고 싶은데 만나기 싫",
    "좋은데 불안해", "가까이 오지마 근데 가지마",
]

# 스트레스 상황 감지 패턴
_STRESS_INDICATORS: list[str] = [
    "짜증", "화", "스트레스", "힘들", "지쳤",
    "싸움", "갈등", "문제", "왜 그래", "미치겠",
]


class R1AttachmentAnalyzer:
    """애착 신호 분석기."""

    def analyze(self, texts: list[str]) -> AttachmentSignal:
        """텍스트 리스트 → AttachmentSignal."""
        if not texts:
            return AttachmentSignal()

        total = len(texts)

        # 경향성 시그널 카운트
        secure_count = 0
        anxious_count = 0
        avoidant_count = 0
        disorganized_count = 0
        reassurance_count = 0
        avoidance_count = 0

        # 스트레스 상황 분리 분석
        stress_texts: list[str] = []
        normal_texts: list[str] = []

        for text in texts:
            text_lower = text.lower()
            is_stress = any(s in text_lower for s in _STRESS_INDICATORS)

            if is_stress:
                stress_texts.append(text)
            else:
                normal_texts.append(text)

            # 경향성 시그널
            for signal in _SECURE_SIGNALS:
                if signal in text_lower:
                    secure_count += 1
                    break

            for signal in _ANXIOUS_SIGNALS:
                if signal in text_lower:
                    anxious_count += 1
                    reassurance_count += 1
                    break

            for signal in _AVOIDANT_SIGNALS:
                if signal in text_lower:
                    avoidant_count += 1
                    avoidance_count += 1
                    break

            for signal in _DISORGANIZED_SIGNALS:
                if signal in text_lower:
                    disorganized_count += 1
                    break

        # 주 경향성 판단
        counts = {
            "leans_secure": secure_count,
            "leans_anxious": anxious_count,
            "leans_avoidant": avoidant_count,
            "leans_disorganized": disorganized_count,
        }
        primary = max(counts, key=counts.get)  # type: ignore

        # 모든 시그널이 0이면 기본값
        if all(v == 0 for v in counts.values()):
            primary = "leans_secure"

        # 스트레스 시 변화 분석
        stress_shift = self._analyze_stress_shift(
            normal_texts, stress_texts, primary
        )

        # 비율 계산
        reassurance_ratio = round(reassurance_count / (total + EPSILON), 4)
        avoidance_ratio = round(avoidance_count / (total + EPSILON), 4)

        # 행동 기술 서술 생성
        narrative = self._generate_narrative(
            primary, stress_shift, reassurance_ratio, avoidance_ratio
        )

        return AttachmentSignal(
            primary_tendency=primary,
            stress_shift=stress_shift,
            narrative=narrative,
            reassurance_seeking_ratio=reassurance_ratio,
            emotional_avoidance_ratio=avoidance_ratio,
        )

    def _analyze_stress_shift(
        self,
        normal_texts: list[str],
        stress_texts: list[str],
        normal_tendency: str,
    ) -> str:
        """스트레스 상황에서의 변화 패턴 분석."""
        if not stress_texts:
            return "stable_under_pressure"

        # 스트레스 시 시그널 변화 감지
        stress_anxious = 0
        stress_avoidant = 0

        for text in stress_texts:
            text_lower = text.lower()
            for signal in _ANXIOUS_SIGNALS:
                if signal in text_lower:
                    stress_anxious += 1
                    break
            for signal in _AVOIDANT_SIGNALS:
                if signal in text_lower:
                    stress_avoidant += 1
                    break

        total_stress = len(stress_texts) + EPSILON

        if stress_anxious / total_stress > 0.4:
            return "mild_anxious_under_pressure"
        elif stress_avoidant / total_stress > 0.4:
            return "withdrawal_under_pressure"
        elif stress_anxious > 0 and stress_avoidant > 0:
            return "inconsistent_under_pressure"
        elif normal_tendency == "leans_secure":
            return "stable_under_pressure"
        else:
            return "escalation_under_pressure"

    def _generate_narrative(
        self,
        tendency: str,
        stress_shift: str,
        reassurance_ratio: float,
        avoidance_ratio: float,
    ) -> str:
        """행동 기술 서술 생성 (라벨링 금지)."""
        narratives: dict[str, str] = {
            "leans_secure": "평상시 안정적이고 일관된 대화 패턴을 보입니다.",
            "leans_anxious": "감정적 확인과 연결 유지에 대한 관심이 높은 대화 패턴을 보입니다.",
            "leans_avoidant": "감정적 거리를 유지하며 독립적인 대화 패턴을 보입니다.",
            "leans_disorganized": "감정 표현에 있어 상반된 경향이 공존하는 패턴을 보입니다.",
        }

        stress_narratives: dict[str, str] = {
            "stable_under_pressure": "",
            "mild_anxious_under_pressure": " 감정적 압박 상황에서 확인 요구가 증가하는 경향이 있습니다.",
            "withdrawal_under_pressure": " 감정적 압박 상황에서 거리두기 경향이 나타납니다.",
            "escalation_under_pressure": " 감정적 압박 상황에서 감정 표현이 강해지는 경향이 있습니다.",
            "inconsistent_under_pressure": " 감정적 압박 상황에서 반응 패턴이 일관적이지 않습니다.",
        }

        base = narratives.get(tendency, "")
        stress_note = stress_narratives.get(stress_shift, "")
        return base + stress_note
