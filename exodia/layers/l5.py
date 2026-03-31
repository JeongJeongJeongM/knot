"""
EXODIA v5.0 — L6 Comparison (비교).
순수 Python. LLM 금지. 결정론적.
구현 기준: v5.0 Spec Section 13 + Appendix A.7.

v5.0 변경사항:
- LSMEngine DI 지원 (복제 제거, KoreanLSMEngine 우선)
- CalibrationConfig DI (동적 가중치)
- 3-way friction: effective_l6_weights() 사용
- phase 지원 (cold/real)
"""
from __future__ import annotations

from typing import Optional

from exodia.config import (
    AXIS_CONFIDENCE_THRESHOLD,
    CONFLICT_MATRIX,
    L6_ALPHA,
    L6_BETA,
    L6_GAMMA,
    FRICTION_SIGNIFICANT,
    STABILITY_BONUS_CAP,
)
from exodia.calibration import CalibrationConfig
from exodia.lsm import KoreanLSMEngine, LSMEngine
from exodia.schemas import (
    FrictionSource,
    L5Output,
    LSMFeatures,
    UserProfile,
)


class L5Comparator:
    """L6 비교 프로세서. — v5.0 Spec Section 13

    v5.0: 3-way friction (intensity + structural + LSM) + DI support
    """

    def __init__(self, lsm_engine: Optional[KoreanLSMEngine] = None,
                 calibration_config: Optional[CalibrationConfig] = None):
        self._lsm_engine = lsm_engine or KoreanLSMEngine()
        self._config = calibration_config or CalibrationConfig()

    def compare(
        self,
        profile_a: UserProfile,
        profile_b: UserProfile,
        phase: str = "cold",
    ) -> L5Output:
        """두 UserProfile → L5Output.

        매칭 게이트 (Spec Section 13.5):
        - 둘 다 status ∈ {PROFILED, PARTIAL}
        - risk_level == HIGH/UNKNOWN → blocked
        - trust_level ∈ {UNTRUSTED, UNKNOWN} → blocked
        """
        # ─── 매칭 게이트 ───
        block_reason = self._check_matching_gate(profile_a, profile_b)
        if block_reason:
            return L5Output(
                blocked=True,
                block_reason=block_reason,
                phase=phase,
            )

        l3_a = profile_a.l3
        l3_b = profile_b.l3
        l4_a = profile_a.l4
        l4_b = profile_b.l4

        # ─── Intensity Friction (A1~A6) — Spec Section 13.2 ───
        friction_sources: list[FrictionSource] = []
        excluded_axes: list[str] = []
        intensity_frictions: list[float] = []

        intensity_keys = ["A1", "A2", "A3", "A4", "A5", "A6"]
        for key in intensity_keys:
            axis_a = l3_a.intensity_axes.get(key)
            axis_b = l3_b.intensity_axes.get(key)

            if not axis_a or not axis_b:
                excluded_axes.append(key)
                continue
            if (axis_a.confidence < AXIS_CONFIDENCE_THRESHOLD or
                    axis_b.confidence < AXIS_CONFIDENCE_THRESHOLD):
                excluded_axes.append(key)
                continue

            # L4 bias-aware friction (maintained from v3.2)
            if l4_a and l4_b:
                bias_a = l4_a.bias.get(key, 0.0)
                bias_b = l4_b.bias.get(key, 0.0)
                friction_bias = max(0.0, -(bias_a * bias_b)) * abs(bias_a - bias_b)
                friction_abs = abs(axis_a.score - axis_b.score) * 0.5
                friction_val = max(friction_bias, friction_abs)
            else:
                friction_val = abs(axis_a.score - axis_b.score)

            intensity_frictions.append(friction_val)

            if friction_val > FRICTION_SIGNIFICANT:
                friction_sources.append(FrictionSource(
                    axis=key,
                    type='intensity_divergence',
                    a_value=axis_a.score,
                    b_value=axis_b.score,
                    a_bias=l4_a.bias.get(key, 0.0) if l4_a else None,
                    b_bias=l4_b.bias.get(key, 0.0) if l4_b else None,
                    friction_contribution=friction_val,
                    description_key=f"{key}_divergence",
                ))

        friction_intensity = (
            sum(intensity_frictions) / len(intensity_frictions)
            if intensity_frictions else 0.0
        )

        # ─── Structural Friction (A7~A11) — Spec Section 13.3 ───
        structural_frictions: list[float] = []
        structural_keys = ["A7", "A8", "A9", "A10", "A11"]

        for key in structural_keys:
            axis_a = l3_a.structural_axes.get(key)
            axis_b = l3_b.structural_axes.get(key)

            if not axis_a or not axis_b:
                excluded_axes.append(key)
                continue
            if (axis_a.confidence < AXIS_CONFIDENCE_THRESHOLD or
                    axis_b.confidence < AXIS_CONFIDENCE_THRESHOLD):
                excluded_axes.append(key)
                continue

            matrix = CONFLICT_MATRIX.get(key, {})
            mix_a = axis_a.mix
            mix_b = axis_b.mix

            friction_val = 0.0
            for style_m, weight_m in sorted(mix_a.items()):
                for style_n, weight_n in sorted(mix_b.items()):
                    conflict = matrix.get((style_m, style_n), 0.0)
                    friction_val += weight_m * weight_n * conflict

            structural_frictions.append(friction_val)

            if friction_val > FRICTION_SIGNIFICANT:
                friction_sources.append(FrictionSource(
                    axis=key,
                    type='structural_clash',
                    a_style=axis_a.style,
                    b_style=axis_b.style,
                    friction_contribution=friction_val,
                    description_key=f"{key}_{axis_a.style}_vs_{axis_b.style}",
                ))

        friction_structural = (
            sum(structural_frictions) / len(structural_frictions)
            if structural_frictions else 0.0
        )

        # ─── LSM Friction (v5.0 NEW) — Spec Section 12 + 13.1 ───
        friction_lsm = self._compute_lsm_friction(
            profile_a, profile_b, phase, friction_sources
        )

        # ─── Total Friction / Compatibility — Spec Section 13.1 ───
        # v5.0: Get dynamic weights from CalibrationConfig
        alpha, beta, gamma = self._config.effective_l6_weights()

        total_friction = (
            alpha * friction_intensity +
            beta * friction_structural +
            gamma * friction_lsm
        )
        compatibility = max(0.0, min(1.0, 1.0 - total_friction))

        # ─── Stability Bonus (Spec Section 13.4) ───
        stability_bonus = 0.0
        c_a = profile_a.consistency
        c_b = profile_b.consistency
        if (c_a.c1_pvi is not None and c_b.c1_pvi is not None):
            stability_a = 1.0 - c_a.c1_pvi
            stability_b = 1.0 - c_b.c1_pvi
            stability_bonus = STABILITY_BONUS_CAP * min(stability_a, stability_b)

        final_score = min(1.0, compatibility + stability_bonus)

        return L5Output(
            phase=phase,
            friction_total=total_friction,
            friction_intensity=friction_intensity,
            friction_structural=friction_structural,
            friction_lsm=friction_lsm,
            compatibility=compatibility,
            stability_bonus=stability_bonus,
            final_score=final_score,
            blocked=False,
            friction_sources=friction_sources,
            excluded_axes=excluded_axes,
        )

    def _compute_lsm_friction(
        self,
        profile_a: UserProfile,
        profile_b: UserProfile,
        phase: str,
        friction_sources: list[FrictionSource],
    ) -> float:
        """LSM friction 계산 (v4.0).

        Phase-dependent:
        - cold: profile_cold의 lsm_features 사용
        - real: profile_real의 lsm_features 사용
        """
        # LSM features 가져오기 (phase에 따라)
        if phase == "real":
            sp_a = profile_a.profile_real
            sp_b = profile_b.profile_real
        else:
            sp_a = profile_a.profile_cold
            sp_b = profile_b.profile_cold

        features_a = sp_a.lsm_features if sp_a and sp_a.lsm_features else None
        features_b = sp_b.lsm_features if sp_b and sp_b.lsm_features else None

        if not features_a or not features_b:
            return 0.0  # FAIL-SAFE: LSM 데이터 없으면 friction 0

        lsm_result = self._lsm_engine.compute_similarity(features_a, features_b)

        if lsm_result.friction_lsm > FRICTION_SIGNIFICANT:
            friction_sources.append(FrictionSource(
                axis="LSM",
                type="lsm_divergence",
                a_value=lsm_result.lsm_score,
                b_value=lsm_result.lsm_score,
                friction_contribution=lsm_result.friction_lsm,
                description_key="lsm_style_mismatch",
            ))

        return lsm_result.friction_lsm

    @staticmethod
    def _check_matching_gate(profile_a: UserProfile,
                              profile_b: UserProfile) -> str | None:
        """매칭 게이트 검사. — Spec Section 13.5"""
        # Status 검사
        for label, profile in [("A", profile_a), ("B", profile_b)]:
            if profile.status not in ('PROFILED', 'PARTIAL'):
                return f"Person {label}: status={profile.status}, matching requires PROFILED or PARTIAL"

        # Consistency risk_level 검사
        for label, profile in [("A", profile_a), ("B", profile_b)]:
            rl = profile.consistency.risk_level
            if rl in ('HIGH', 'UNKNOWN'):
                return f"Person {label}: risk_level={rl}, blocked from matching pool"

        # Integrity trust_level 검사
        for label, profile in [("A", profile_a), ("B", profile_b)]:
            if profile.integrity is None:
                return f"Person {label}: no integrity data, blocked from matching"
            tl = profile.integrity.trust_level
            if tl in ('UNTRUSTED', 'UNKNOWN'):
                return f"Person {label}: trust_level={tl}, blocked from matching"

        return None
