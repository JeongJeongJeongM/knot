"""
EXODIA Integrity Layer — Trust Score Gate.
순수 Python. LLM 금지. 규칙 기반.
구현 기준: PART 5 + PART 7 (Integrity Patch) + PART 6 §4.4.
"""
from typing import Optional

from exodia.config import (
    CR04_EXPECTED_TRANSITION_RATE,
    INTEGRITY_MIN_TURNS,
    STAGE1_TRUST_WEIGHT,
    STAGE1_WEIGHTS,
    STAGE2_ONLY_MAX_TRUST_LEVEL,
    STAGE2_ONLY_MAX_TRUST_SCORE,
    STAGE2_TRUST_WEIGHT,
    STAGE2_WEIGHTS,
    TRUST_THRESHOLDS,
)
from exodia.schemas import (
    ClientSignals,
    IntegrityEvidence,
    IntegrityOutput,
    L2Output,
)


class IntegrityGate:
    """Integrity Gate 프로세서. — PART 5 + PART 7"""

    def evaluate(self, l2_output: L2Output,
                 client_signals: Optional[ClientSignals] = None,
                 turn_count: int = 0) -> IntegrityOutput:
        """L2 + ClientSignals → IntegrityOutput.

        - Stage 1: 클라이언트 신호 (paste_likelihood)
        - Stage 2: 대화 상호성 탐지 (reciprocity_anomaly)
        - Trust Score: 통합 점수
        - Trust Level: 5단계 분류
        """
        # 세션 < 10턴 → UNKNOWN (PART 6 §4.4)
        if turn_count < INTEGRITY_MIN_TURNS:
            return IntegrityOutput(
                trust_score=None,
                trust_level='UNKNOWN',
                evidence=IntegrityEvidence(),
            )

        # Stage 1: 클라이언트 신호
        stage1_score = self._compute_stage1(client_signals)

        # Stage 2: L2 기반 이상 탐지
        stage2_score = self._compute_stage2(l2_output)

        # Trust Score 합산 (PART 5 §4.1 + PART 7 PATCH-05)
        if stage1_score is not None:
            raw_suspicion = (
                STAGE1_TRUST_WEIGHT * stage1_score +
                STAGE2_TRUST_WEIGHT * stage2_score
            )
        else:
            # Stage 1 비활성 → Stage 2 단독 (PART 7, PATCH-05)
            raw_suspicion = stage2_score

        trust_score = max(0.0, min(1.0, 1.0 - raw_suspicion))

        # Trust Level 분류
        trust_level = self._classify_level(trust_score)

        # PART 7, PATCH-05: Stage2-only 신뢰도 상한
        if stage1_score is None:
            if trust_level == 'TRUSTED':
                trust_level = STAGE2_ONLY_MAX_TRUST_LEVEL
                trust_score = min(trust_score, STAGE2_ONLY_MAX_TRUST_SCORE)

        # Evidence 구성
        evidence = IntegrityEvidence(
            stage1_detail={'session_paste_likelihood': stage1_score}
            if stage1_score is not None else None,
            stage2_detail={'reciprocity_anomaly': stage2_score},
        )

        return IntegrityOutput(
            trust_score=trust_score,
            trust_level=trust_level,
            evidence=evidence,
            stage1_score=stage1_score,
            stage2_score=stage2_score,
        )

    def _compute_stage1(self, client_signals: Optional[ClientSignals]) -> Optional[float]:
        """Stage 1: 클라이언트 신호 기반 paste_likelihood. — PART 5 §2"""
        if client_signals is None or not client_signals.per_message:
            return None

        msg_paste_scores = []
        for msg in client_signals.per_message:
            # IF.01: chars_per_second
            cps = msg.chars_per_second
            score_if01 = _clamp((cps - 8.0) / 12.0, 0, 1) if cps is not None else 0.0

            # IF.02: paste_event
            score_if02 = 1.0 if msg.paste_event else 0.0

            # IF.03: backspace_ratio
            br = msg.backspace_ratio
            score_if03 = _clamp((0.05 - br) / 0.05, 0, 1) if br is not None else 0.0

            # IF.04: paragraph_structure
            ps = msg.paragraph_structure
            score_if04 = _clamp((ps - 0.5) / 0.5, 0, 1) if ps is not None else 0.0

            # IF.05: edit_count
            ec = msg.edit_count
            score_if05 = _clamp((1 - ec) / 1, 0, 1) if ec is not None else 0.0

            # IF.06: input_rhythm_variance
            irv = msg.input_rhythm_variance
            score_if06 = _clamp((0.01 - irv) / 0.01, 0, 1) if irv is not None else 0.0

            msg_paste = (
                0.30 * score_if01 + 0.25 * score_if02 + 0.15 * score_if03 +
                0.10 * score_if04 + 0.10 * score_if05 + 0.10 * score_if06
            )
            msg_paste_scores.append(msg_paste)

        if not msg_paste_scores:
            return None

        return sum(msg_paste_scores) / len(msg_paste_scores)

    def _compute_stage2(self, l2_output: L2Output) -> float:
        """Stage 2: L2 기반 상호성 이상 탐지. — PART 5 §3"""
        # CR.01: Reference Carry Rate (간소화: L2에서 직접 계산 불가, 0으로)
        s_cr01 = 0.0

        # CR.02: QA Directness (간소화: L2 question/answer 비율)
        s_cr02 = 0.0

        # CR.03: Latency Consistency (PART 7, PATCH-01)
        cr03 = l2_output.cr03_latency_anomaly
        s_cr03 = _clamp((cr03 - 0.40) / 0.30, 0, 1)

        # CR.04: Tone Shift Absence (PART 7, PATCH-02)
        cr04 = l2_output.cr04_tone_anomaly
        s_cr04 = _clamp((cr04 - 0.50) / 0.25, 0, 1)

        # CR.05: Formulaic Pattern (간소화)
        s_cr05 = 0.0

        reciprocity_anomaly = (
            STAGE2_WEIGHTS["CR01"] * s_cr01 +
            STAGE2_WEIGHTS["CR02"] * s_cr02 +
            STAGE2_WEIGHTS["CR03"] * s_cr03 +
            STAGE2_WEIGHTS["CR04"] * s_cr04 +
            STAGE2_WEIGHTS["CR05"] * s_cr05
        )

        return max(0.0, min(1.0, reciprocity_anomaly))

    @staticmethod
    def _classify_level(trust_score: float) -> str:
        """Trust Level 분류. — PART 5 §4.2"""
        for level, (low, high) in sorted(TRUST_THRESHOLDS.items(),
                                          key=lambda x: -x[1][0]):
            if trust_score >= low:
                return level
        return 'UNTRUSTED'


def _clamp(value: float, min_val: float, max_val: float) -> float:
    """값을 [min_val, max_val] 범위로 제한."""
    return max(min_val, min(max_val, value))
