"""
EXODIA L3.5 — Consistency Audit (일관성 감사).
순수 Python. LLM 금지.
구현 기준: PART 8 전체 + PART 11 F-07.
"""
import math
from typing import Optional

from exodia.config import (
    C1_INTENSITY_WEIGHT,
    C1_NORMALIZATION_CEILING,
    C1_STRUCTURAL_WEIGHT,
    C2_COMPARISON_PAIRS,
    C2_NORMALIZATION_CEILING,
    C3_MIN_VALUE_DECLARATIONS,
    C3_NORMALIZATION_CEILING,
    C4_CROSS_CEILING,
    C4_CROSS_WEIGHT,
    C4_WITHIN_CEILING,
    C4_WITHIN_WEIGHT,
    CONSISTENCY_WEIGHTS,
    EPSILON,
    MIN_SESSIONS_FOR_HIGH,
    MIN_SESSIONS_FOR_L35,
    RISK_LEVELS,
    STD_DDOF,
    VALUE_TO_BEHAVIOR_MAP,
)
from exodia.schemas import (
    ConsistencyEvidence,
    ConsistencyOutput,
    DirectionMetrics,
    L1Output,
    L2Output,
    SessionProfile,
)


def _std(values: list[float]) -> float:
    """Population std (ddof=0). — PART 11, F-08"""
    if len(values) < 1:
        return 0.0
    n = len(values)
    mean_v = sum(values) / n
    variance = sum((x - mean_v) ** 2 for x in values) / n
    return math.sqrt(variance)


class L35Processor:
    """L3.5 일관성 감사 프로세서. — PART 8"""

    def process(self, user_id: str,
                session_profiles: list[SessionProfile],
                l2_outputs: list[L2Output],
                all_l1_outputs: Optional[list[list[L1Output]]] = None,
                ) -> ConsistencyOutput:
        """교차 세션 일관성 감사.

        세션 < 3 → INSUFFICIENT.
        3~9 세션 → risk_level 상한 MED.
        ≥ 10 세션 → 전체 정밀도.
        """
        session_count = len(session_profiles)

        if session_count < MIN_SESSIONS_FOR_L35:
            return ConsistencyOutput(
                user_id=user_id,
                session_count=session_count,
                status='INSUFFICIENT',
                risk_level='UNKNOWN',
            )

        # C1: PVI
        c1 = self._compute_c1_pvi(session_profiles)

        # C2: SOAI
        c2 = self._compute_c2_soai(l2_outputs)

        # C3: PAG
        c3 = self._compute_c3_pag(l2_outputs, all_l1_outputs)

        # C4: ET
        c4 = self._compute_c4_et(l2_outputs, session_profiles)

        # Risk Score
        risk_score = self._compute_risk_score(c1, c2, c3, c4)

        # Risk Level
        risk_level = self._classify_risk(risk_score, session_count)

        # 세션 상한 적용 여부
        ceiling_applied = (
            session_count < MIN_SESSIONS_FOR_HIGH and risk_level == 'HIGH'
        )
        if ceiling_applied:
            risk_level = 'MED'

        return ConsistencyOutput(
            user_id=user_id,
            session_count=session_count,
            status='COMPUTED',
            c1_pvi=c1,
            c2_soai=c2,
            c3_pag=c3,
            c4_et=c4,
            risk_score=risk_score,
            risk_level=risk_level,
            evidence=ConsistencyEvidence(
                session_ceiling_applied=ceiling_applied,
            ),
        )

    def _compute_c1_pvi(self, session_profiles: list[SessionProfile]) -> float:
        """C1: 패턴 변동성 지수 (PVI). — PART 8 §3.4"""
        intensity_keys = ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']
        axis_stds: list[float] = []

        for key in intensity_keys:
            values = []
            for sp in session_profiles:
                axis = sp.l3.intensity_axes.get(key)
                if axis is not None:
                    values.append(axis.score)
            if len(values) >= 2:
                axis_stds.append(_std(values))

        intensity_pvi = (
            (sum(axis_stds) / len(axis_stds) / C1_NORMALIZATION_CEILING)
            if axis_stds else 0.0
        )

        structural_keys = ['A7', 'A8', 'A9', 'A10', 'A11']
        change_rates: list[float] = []

        for key in structural_keys:
            dominants = []
            for sp in session_profiles:
                axis = sp.l3.structural_axes.get(key)
                if axis is not None:
                    dominants.append(axis.style)
            changes = sum(
                1 for i in range(len(dominants) - 1) if dominants[i] != dominants[i + 1]
            )
            if len(dominants) > 1:
                change_rates.append(changes / (len(dominants) - 1))

        structural_vol = (
            sum(change_rates) / len(change_rates) if change_rates else 0.0
        )

        c1 = C1_INTENSITY_WEIGHT * min(1.0, intensity_pvi) + C1_STRUCTURAL_WEIGHT * structural_vol
        return min(1.0, max(0.0, c1))

    def _compute_c2_soai(self, l2_outputs: list[L2Output]) -> float:
        """C2: 자기-타자 비대칭 지수 (SOAI). — PART 8 §3.5"""
        asymmetries: list[float] = []

        for l2 in l2_outputs:
            dm = l2.direction_metrics
            self_rates = dm.rates_by_direction.get('SELF', {})
            other_rates = dm.rates_by_direction.get('OTHER', {})

            for rate_name, direction in C2_COMPARISON_PAIRS:
                s = self_rates.get(rate_name, 0.0)
                o = other_rates.get(rate_name, 0.0)
                if direction == 'positive':
                    asymmetries.append(max(0.0, s - o))
                else:
                    asymmetries.append(max(0.0, o - s))

        raw_soai = (sum(asymmetries) / len(asymmetries)) if asymmetries else 0.0
        return min(1.0, raw_soai / C2_NORMALIZATION_CEILING)

    def _compute_c3_pag(self, l2_outputs: list[L2Output],
                         all_l1_outputs: Optional[list[list[L1Output]]]) -> Optional[float]:
        """C3: 원칙-행동 불일치 (PAG). — PART 8 §3.6"""
        if all_l1_outputs is None:
            return None

        all_l1 = [l1 for session in all_l1_outputs for l1 in session]
        all_vd = [l1 for l1 in all_l1 if l1.mention_flags.VALUE_DECLARATION == 1]

        if len(all_vd) < C3_MIN_VALUE_DECLARATIONS:
            return None  # Fail-Closed

        gaps: list[float] = []
        for theme, mapping in sorted(VALUE_TO_BEHAVIOR_MAP.items()):
            decl_count = sum(
                1 for l1 in all_vd if l1.primary_id in mapping['declaration_labels']
            )
            if decl_count == 0:
                continue

            behavior_count = sum(
                1 for l1 in all_l1 if l1.primary_id in mapping['expected_behavior']
            )
            behavior_rate = behavior_count / len(all_l1) if all_l1 else 0.0
            decl_intensity = decl_count / len(all_vd) if all_vd else 0.0
            gap = max(0.0, decl_intensity - behavior_rate)
            gaps.append(gap)

        if not gaps:
            return None

        return min(1.0, sum(gaps) / len(gaps) / C3_NORMALIZATION_CEILING)

    def _compute_c4_et(self, l2_outputs: list[L2Output],
                        session_profiles: list[SessionProfile]) -> float:
        """C4: 갈등 격화 경향 (ET). — PART 8 §3.7"""
        # 세션 내 격화
        within_ets: list[float] = []
        for l2 in l2_outputs:
            series = l2.timeseries.hostile_rate_short
            if len(series) < 3:
                continue
            mid = len(series) // 2
            early_mean = sum(series[:mid]) / mid if mid > 0 else 0.0
            late_mean = sum(series[mid:]) / (len(series) - mid) if (len(series) - mid) > 0 else 0.0
            within_ets.append(max(0.0, late_mean - early_mean))

        within_et = (
            (sum(within_ets) / len(within_ets) / C4_WITHIN_CEILING)
            if within_ets else 0.0
        )

        # 세션 간 격화
        sorted_sp = sorted(session_profiles, key=lambda sp: sp.computed_at)
        hostile_rates = [
            sp.l2_direction.rates_by_direction.get('OTHER', {}).get('hostile_rate', 0.0)
            for sp in sorted_sp
        ]

        cross_et = 0.0
        if len(hostile_rates) >= 3:
            mid = len(hostile_rates) // 2
            early_mean = sum(hostile_rates[:mid]) / mid if mid > 0 else 0.0
            late_mean = (
                sum(hostile_rates[mid:]) / (len(hostile_rates) - mid)
                if (len(hostile_rates) - mid) > 0 else 0.0
            )
            cross_et = min(1.0, max(0.0, late_mean - early_mean) / C4_CROSS_CEILING)

        c4 = C4_WITHIN_WEIGHT * min(1.0, within_et) + C4_CROSS_WEIGHT * cross_et
        return min(1.0, max(0.0, c4))

    def _compute_risk_score(self, c1: float, c2: float,
                             c3: Optional[float], c4: float) -> float:
        """리스크 점수 계산. — PART 8 §4.1"""
        scores = {'C1_pvi': c1, 'C2_soai': c2, 'C4_et': c4}
        weights = dict(CONSISTENCY_WEIGHTS)

        if c3 is not None:
            scores['C3_pag'] = c3
        else:
            # C3가 null이면 나머지 가중치 비례 재분배
            removed_weight = weights.pop('C3_pag', 0.0)
            remaining_total = sum(weights.values())
            if remaining_total > 0:
                for k in weights:
                    weights[k] = weights[k] / remaining_total

        risk_score = sum(scores.get(k, 0.0) * weights.get(k, 0.0) for k in weights)
        return min(1.0, max(0.0, risk_score))

    @staticmethod
    def _classify_risk(risk_score: float, session_count: int) -> str:
        """리스크 등급 분류. — PART 8 §4.2"""
        for level, (low, high) in sorted(RISK_LEVELS.items(), key=lambda x: -x[1][0]):
            if low <= risk_score <= high:
                # 3~9 세션: HIGH 불가
                if level == 'HIGH' and session_count < MIN_SESSIONS_FOR_HIGH:
                    return 'MED'
                return level
        return 'LOW'
