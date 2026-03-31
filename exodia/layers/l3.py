"""
EXODIA L3 — Synthesis (합성).
순수 Python. LLM 금지. 결정론적.
구현 기준: PART 4 §2 + PART 6 §4.5 + PART 9 T-04 (A6 엔트로피) + PART 11 F-04/F-09.
v5.1: A12-A17 supplementary axes added.
"""
import math

from exodia.constants import LABEL_TO_INDEX
from exodia.config import (
    A1_TURN_COUNT_MAX,
    A1_TURN_COUNT_MIN,
    A6_CHANGE_POINT_MAX,
    A6_CHANGE_POINT_MIN,
    A6_ENTROPY_WEIGHT,
    AXIS_CONFIDENCE_THRESHOLD,
    AXIS_CONFIDENCE_TURN_THRESHOLD,
    EPSILON,
    INTENSITY_LEVEL_BOUNDARIES,
    INTENSITY_WEIGHTS,
    NORMALIZE_EPSILON,
    STRUCTURAL_WEIGHTS,
)
from exodia.schemas import (
    ContributingMetric,
    IntensityAxis,
    L2Output,
    L3Output,
    StructuralAxis,
)


def _clamp(value: float, min_val: float = 0.0, max_val: float = 1.0) -> float:
    return max(min_val, min(max_val, value))


def _min_max_norm(value: float, min_v: float, max_v: float) -> float:
    """Min-max 정규화 → [0, 1]."""
    if max_v - min_v < EPSILON:
        return 0.0
    return _clamp((value - min_v) / (max_v - min_v))


def _classify_level(score: float) -> str:
    """강도 축 레벨 분류. — PART 4 §2.3"""
    for level, (low, high) in sorted(INTENSITY_LEVEL_BOUNDARIES.items()):
        if low <= score <= high:
            return level
    return 'low'


def normalize_scores(scores: dict[str, float]) -> dict[str, float]:
    """scores dict 정규화 (합=1). — PART 11, F-09"""
    clamped = {k: max(0.0, v) for k, v in sorted(scores.items())}
    total = sum(clamped.values())
    if total < NORMALIZE_EPSILON:
        n = len(clamped)
        return {k: 1.0 / n for k in sorted(clamped.keys())} if n > 0 else {}
    return {k: v / total for k, v in sorted(clamped.items())}


def _compute_intensity_axis(
    axis_key: str,
    metric_values: dict[str, float],
) -> tuple[float, list[ContributingMetric]]:
    """config.INTENSITY_WEIGHTS 기반 가중합 계산.
    config 구조에 맞춰 어댑터 로직 작성. config 자체는 변경하지 않는다."""
    weights = INTENSITY_WEIGHTS[axis_key]

    # config 구조 대응 (tuple list / dict 둘 다 처리)
    if isinstance(weights, dict):
        iterable = sorted(weights.items())
    elif isinstance(weights, (list, tuple)):
        iterable = weights
    else:
        iterable = []

    score = 0.0
    contributing = []
    for metric_name, weight in iterable:
        value = metric_values.get(metric_name, 0.0)
        score += weight * value
        contributing.append(
            ContributingMetric(metric=metric_name, value=value, weight=weight)
        )

    return _clamp(score), contributing


def _compute_structural_scores(
    axis_config: dict[str, dict[str, float]],
    metric_values: dict[str, float],
) -> dict[str, float]:
    """config.STRUCTURAL_WEIGHTS 기반 구조 축 점수 계산.
    config 구조에 맞춰 어댑터 로직 작성. config 자체는 변경하지 않는다."""
    scores = {}
    for style, weights in sorted(axis_config.items()):
        if not isinstance(weights, dict):
            continue
        s = 0.0
        for metric_name, weight in sorted(weights.items()):
            s += weight * metric_values.get(metric_name, 0.0)
        scores[style] = s
    return scores


class L3Synthesizer:
    """L3 합성 프로세서. — PART 4 + PART 6 §4.5"""

    def process(self, l2: L2Output) -> L3Output:
        """L2Output → L3Output (11축)."""
        m = l2.metrics
        ts = l2.timeseries
        tr = l2.transition
        total_turns = m.total_turns or 0
        turn_count_val = getattr(ts, "turn_count", None) or total_turns or 0

        intensity_axes = {}
        structural_axes = {}

        # ── 공통 metric_values 구성 ──
        turn_count_norm = _min_max_norm(
            turn_count_val, A1_TURN_COUNT_MIN, A1_TURN_COUNT_MAX
        )
        vol_norm = _clamp(1.0 - ts.volatility)
        cp_norm = 1.0 - _min_max_norm(
            ts.change_point_count, A6_CHANGE_POINT_MIN, A6_CHANGE_POINT_MAX
        )

        # 모든 "one_minus_*" 변환을 포함한 메트릭 사전
        all_metrics: dict[str, float] = {
            "interest_rate": m.interest_rate,
            "sharing_rate": m.sharing_rate,
            "turn_count_norm": turn_count_norm,
            "one_minus_self_loop": 1.0 - tr.self_loop_all,
            "empathy_rate": m.empathy_rate,
            "feedback_pos_rate": m.feedback_pos_rate,
            "one_minus_disinterest_rate": 1.0 - m.disinterest_rate,
            "task_assign_rate": m.task_assign_rate,
            "feedback_neg_rate": m.feedback_neg_rate,
            "boundary_rate": m.boundary_rate,
            "one_minus_availability_rate": 1.0 - m.availability_rate,
            "hostile_rate": m.hostile_rate,
            "distress_rate": m.distress_rate,
            "one_minus_status_update_rate": 1.0 - m.status_update_rate,
            "status_update_rate": m.status_update_rate,
            "availability_rate": m.availability_rate,
            "disinterest_rate": m.disinterest_rate,
            "one_minus_volatility": vol_norm,
            "self_loop_all": tr.self_loop_all,
            "one_minus_change_point_norm": cp_norm,
            "one_minus_hostile_rate": 1.0 - m.hostile_rate,
            "one_minus_boundary_rate": 1.0 - m.boundary_rate,
            "one_minus_sharing_rate": 1.0 - m.sharing_rate,
            "one_minus_distress_rate": 1.0 - m.distress_rate,
            "one_minus_task_assign_rate": 1.0 - m.task_assign_rate,
        }

        # ═══ 강도 축 A1-A5 ═══
        for axis_key in ("A1", "A2", "A3", "A4", "A5"):
            score, cm = _compute_intensity_axis(axis_key, all_metrics)
            intensity_axes[axis_key] = IntensityAxis(
                score=score, level=_classify_level(score),
                confidence=self._axis_confidence(total_turns),
                contributing_metrics=cm,
            )

        # ── A6: Stability (T-04 엔트로피 보강) ──
        a6_base_score, a6_cm = _compute_intensity_axis("A6", all_metrics)

        # 엔트로피 보강 (T-04)
        if tr.entropy_norm is not None:
            s_entropy = _clamp(1.0 - tr.entropy_norm)
            a6_score = _clamp(
                A6_ENTROPY_WEIGHT * a6_base_score
                + (1.0 - A6_ENTROPY_WEIGHT) * s_entropy
            )
        else:
            a6_score = a6_base_score

        intensity_axes["A6"] = IntensityAxis(
            score=a6_score, level=_classify_level(a6_score),
            confidence=self._axis_confidence(total_turns),
            contributing_metrics=a6_cm,
        )

        # ═══ 구조 축 ═══

        # ── A7: Interaction Orientation ── (STRUCTURAL_WEIGHTS 기반)
        a7_config = STRUCTURAL_WEIGHTS["A7"]
        a7_threshold = a7_config["threshold"]
        a7_balanced_scale = a7_config["balanced_scale"]
        a7_equal_weight = a7_config["equal_weight"]
        init_score = m.task_assign_rate + m.interest_rate
        resp_score = m.empathy_rate + m.feedback_pos_rate
        diff = init_score - resp_score
        if diff > a7_threshold:
            style_a7 = 'initiator'
        elif diff < -a7_threshold:
            style_a7 = 'responder'
        else:
            style_a7 = 'balanced'
        mix_a7 = normalize_scores({
            'initiator': init_score,
            'responder': resp_score,
            'balanced': max(0.0, 1.0 - abs(diff) * a7_balanced_scale),
        })
        structural_axes["A7"] = StructuralAxis(
            style=style_a7, mix=mix_a7,
            confidence=self._axis_confidence(total_turns),
            contributing_metrics=[
                ContributingMetric(metric="initiative_score", value=init_score, weight=a7_equal_weight),
                ContributingMetric(metric="response_score", value=resp_score, weight=a7_equal_weight),
            ],
        )

        # ── A8: Conflict Regulation ── (STRUCTURAL_WEIGHTS 기반)
        a8_config = STRUCTURAL_WEIGHTS["A8"]
        scores_a8 = _compute_structural_scores(a8_config, all_metrics)
        style_a8 = max(sorted(scores_a8.keys()), key=lambda k: scores_a8[k])
        mix_a8 = normalize_scores(scores_a8)
        structural_axes["A8"] = StructuralAxis(
            style=style_a8, mix=mix_a8,
            confidence=self._axis_confidence(total_turns),
        )

        # ── A9: Emotional Processing ── (STRUCTURAL_WEIGHTS 기반)
        a9_config = STRUCTURAL_WEIGHTS["A9"]
        scores_a9 = _compute_structural_scores(a9_config, all_metrics)
        style_a9 = max(sorted(scores_a9.keys()), key=lambda k: scores_a9[k])
        mix_a9 = normalize_scores(scores_a9)
        structural_axes["A9"] = StructuralAxis(
            style=style_a9, mix=mix_a9,
            confidence=self._axis_confidence(total_turns),
        )

        # ── A10: Intimacy Gradient ── (STRUCTURAL_WEIGHTS 기반)
        a10_config = STRUCTURAL_WEIGHTS["A10"]
        a10_grad = a10_config["gradient_threshold"]
        a10_slow_ceil = a10_config["slow_burn_early_ceiling"]
        a10_fast_thresh = a10_config["fast_opener_early_threshold"]
        a10_surface_ceil = a10_config["surface_locked_late_ceiling"]
        a10_default = a10_config["default_score"]

        sharing_early = self._mean_rate_from_dist(
            l2.timeseries.early_distribution, 'K'
        )
        sharing_late = self._mean_rate_from_dist(
            l2.timeseries.late_distribution, 'K'
        )
        sharing_gradient = sharing_late - sharing_early
        empathy_early = 0.0  # 간소화
        empathy_late = 0.0
        empathy_gradient = empathy_late - empathy_early

        scores_a10 = {
            'slow_burn': 1.0 if (
                sharing_gradient > a10_grad and sharing_early < a10_slow_ceil
            ) else 0.0,
            'fast_opener': 1.0 if sharing_early > a10_fast_thresh else 0.0,
            'surface_locked': 1.0 if (
                sharing_late < a10_surface_ceil
                and abs(sharing_gradient) < a10_grad
            ) else 0.0,
            'depth_seeker': 1.0 if (
                sharing_gradient > a10_grad and empathy_gradient > a10_grad
            ) else 0.0,
        }
        # 가장 높은 점수 선택
        if max(scores_a10.values()) == 0:
            scores_a10['surface_locked'] = a10_default
        style_a10 = max(sorted(scores_a10.keys()), key=lambda k: scores_a10[k])
        mix_a10 = normalize_scores(scores_a10)
        structural_axes["A10"] = StructuralAxis(
            style=style_a10, mix=mix_a10,
            confidence=self._axis_confidence(total_turns),
        )

        # ── A11: Reciprocity Pattern ── (STRUCTURAL_WEIGHTS 기반)
        a11_config = STRUCTURAL_WEIGHTS["A11"]
        a11_balanced_scale = a11_config["balanced_scale"]
        give_score = m.feedback_pos_rate + m.empathy_rate + m.status_update_rate
        take_score = m.task_assign_rate + m.interest_rate + (1.0 - m.sharing_rate)
        ratio = give_score / (give_score + take_score + EPSILON)
        if ratio > a11_config["giver_threshold"]:
            style_a11 = 'giver'
        elif ratio < a11_config["taker_threshold"]:
            style_a11 = 'taker'
        else:
            style_a11 = 'balanced'
        mix_a11 = normalize_scores({
            'giver': give_score,
            'taker': take_score,
            'balanced': max(0.0, 1.0 - abs(give_score - take_score) * a11_balanced_scale),
        })
        structural_axes["A11"] = StructuralAxis(
            style=style_a11, mix=mix_a11,
            confidence=self._axis_confidence(total_turns),
        )

        # ═══ v5.1 신규 축 A12-A17 ═══
        probs = tr.probs_dense  # 85×85 전이 확률 행렬

        # ── A12: 감정 응답 정확성 (Emotional Attunement) ──
        a12_score, a12_conf = self._compute_a12_attunement(probs, tr.counts_dense)
        intensity_axes["A12"] = IntensityAxis(
            score=a12_score, level=_classify_level(a12_score),
            confidence=a12_conf,
        )

        # ── A13: 피드백 반응성 (Feedback Responsiveness) ──
        a13_style, a13_mix, a13_conf = self._compute_a13_feedback(probs, tr.counts_dense)
        structural_axes["A13"] = StructuralAxis(
            style=a13_style, mix=a13_mix, confidence=a13_conf,
        )

        # ── A14: 갈등 처리 효율성 (Conflict Resolution Efficiency) ──
        a14_score, a14_conf = self._compute_a14_conflict_efficiency(
            probs, tr.counts_dense, m, ts
        )
        intensity_axes["A14"] = IntensityAxis(
            score=a14_score, level=_classify_level(a14_score),
            confidence=a14_conf,
        )

        # ── A15: 관계 투자도 (Relational Investment) ──
        a15_style, a15_mix, a15_conf = self._compute_a15_relational(m, probs, tr.counts_dense)
        structural_axes["A15"] = StructuralAxis(
            style=a15_style, mix=a15_mix, confidence=a15_conf,
        )

        # ── A16: 인지적 복잡성 (Cognitive Complexity) ──
        a16_style, a16_mix, a16_conf = self._compute_a16_cognitive(m, l2)
        structural_axes["A16"] = StructuralAxis(
            style=a16_style, mix=a16_mix, confidence=a16_conf,
        )

        # ── A17: 유머 활용 (Humor Utilization) ──
        a17_style, a17_mix, a17_conf = self._compute_a17_humor(probs, tr.counts_dense, m)
        structural_axes["A17"] = StructuralAxis(
            style=a17_style, mix=a17_mix, confidence=a17_conf,
        )

        # confidence < 0.5인 축 → insufficient
        for key in sorted(intensity_axes.keys()):
            if intensity_axes[key].confidence < AXIS_CONFIDENCE_THRESHOLD:
                intensity_axes[key].level = 'insufficient'
        for key in sorted(structural_axes.keys()):
            if structural_axes[key].confidence < AXIS_CONFIDENCE_THRESHOLD:
                structural_axes[key].style = 'insufficient'

        return L3Output(
            intensity_axes=intensity_axes,
            structural_axes=structural_axes,
        )

    @staticmethod
    def _axis_confidence(total_turns: int) -> float:
        """축 confidence 계산. — PART 4 §2.6"""
        if total_turns >= AXIS_CONFIDENCE_TURN_THRESHOLD:
            return 1.0
        return total_turns / AXIS_CONFIDENCE_TURN_THRESHOLD

    @staticmethod
    def _mean_rate_from_dist(dist: dict[str, float], category: str) -> float:
        """분포에서 특정 카테고리 비율 추출."""
        return dist.get(category, 0.0)

    # ═══════════════════════════════════════════════════
    #  v5.1 — A12-A17 Supplementary Axis Methods
    # ═══════════════════════════════════════════════════

    def _compute_a12_attunement(
        self, probs: list[list[float]], counts: list[list[int]],
    ) -> tuple[float, float]:
        """A12: 감정 응답 정확성 (Emotional Attunement).
        감정 표현(220-227) 뒤에 공감적 반응이 오는 비율."""
        EMO_LABELS = [220, 221, 222, 223, 224, 225, 226, 227]
        ATTUNED_TARGETS = [304, 223, 203, 305]  # empathy, concern, acknowledge, feedback_pos
        MISATTUNED = [301, 222, 307, 227]  # disinterest, hostile, task_assign, swear

        if not counts or not counts[0]:
            return 0.5, 0.0

        emo_indices = [LABEL_TO_INDEX[lid] for lid in EMO_LABELS if lid in LABEL_TO_INDEX]
        attuned_idx = [LABEL_TO_INDEX[lid] for lid in ATTUNED_TARGETS if lid in LABEL_TO_INDEX]
        misattuned_idx = [LABEL_TO_INDEX[lid] for lid in MISATTUNED if lid in LABEL_TO_INDEX]

        attuned_sum = 0.0
        misattuned_sum = 0.0
        total_transitions = 0

        for i in emo_indices:
            row_total = sum(counts[i])
            if row_total == 0:
                continue
            total_transitions += row_total
            for j in attuned_idx:
                attuned_sum += counts[i][j]
            for j in misattuned_idx:
                misattuned_sum += counts[i][j]

        if total_transitions < 3:
            return 0.5, total_transitions / max(AXIS_CONFIDENCE_TURN_THRESHOLD, 1)

        attuned_rate = attuned_sum / total_transitions
        misattuned_rate = misattuned_sum / total_transitions
        score = _clamp(attuned_rate - 0.5 * misattuned_rate + 0.3)

        conf = min(1.0, total_transitions / AXIS_CONFIDENCE_TURN_THRESHOLD)
        return score, conf

    def _compute_a13_feedback(
        self, probs: list[list[float]], counts: list[list[int]],
    ) -> tuple[str, dict[str, float], float]:
        """A13: 피드백 반응성 (Feedback Responsiveness).
        부정 피드백(306) 이후 반응 패턴 분류."""
        if not counts or not counts[0]:
            return 'insufficient', {'growth': 0.25, 'defensive': 0.25, 'avoidant': 0.25, 'absorptive': 0.25}, 0.0

        NEG_FB = LABEL_TO_INDEX.get(306)
        if NEG_FB is None:
            return 'insufficient', {'growth': 0.25, 'defensive': 0.25, 'avoidant': 0.25, 'absorptive': 0.25}, 0.0

        row_total = sum(counts[NEG_FB])
        if row_total < 3:
            return 'insufficient', {'growth': 0.25, 'defensive': 0.25, 'avoidant': 0.25, 'absorptive': 0.25}, row_total / max(AXIS_CONFIDENCE_TURN_THRESHOLD, 1)

        # growth: elaborate(246), partial_agree(202), self_repair(240)
        growth_labels = [246, 202, 240]
        # defensive: disagree(201), challenge(266), escalation(269)
        defensive_labels = [201, 266, 269]
        # avoidant: deflection(267), small_talk(302), disinterest(301)
        avoidant_labels = [267, 302, 301]
        # absorptive: acknowledge(203), compliance_signal(268), agree(200)
        absorptive_labels = [203, 268, 200]

        scores: dict[str, float] = {}
        for style, labels in [
            ('growth', growth_labels), ('defensive', defensive_labels),
            ('avoidant', avoidant_labels), ('absorptive', absorptive_labels),
        ]:
            s = 0.0
            for lid in labels:
                idx = LABEL_TO_INDEX.get(lid)
                if idx is not None:
                    s += counts[NEG_FB][idx]
            scores[style] = s

        mix = normalize_scores(scores)
        style = max(sorted(mix.keys()), key=lambda k: mix[k])
        conf = min(1.0, row_total / AXIS_CONFIDENCE_TURN_THRESHOLD)
        return style, mix, conf

    def _compute_a14_conflict_efficiency(
        self, probs: list[list[float]], counts: list[list[int]],
        metrics, timeseries,
    ) -> tuple[float, float]:
        """A14: 갈등 처리 효율성 (Conflict Resolution Efficiency).
        수리 비율 + 적대성 감쇠 + 적대성 자기루프."""
        if not counts or not counts[0]:
            return 0.5, 0.0

        REPAIR_LABELS = [240, 241, 242, 244, 245]  # self_repair, other_repair, clarification_offer, context_correction, retraction
        HOSTILE_LABEL = LABEL_TO_INDEX.get(222)
        CONFLICT_LABELS = [222, 224, 269]  # hostile, complain, escalation

        # 수리 비율
        repair_count = 0
        conflict_count = 0
        for lid in REPAIR_LABELS:
            idx = LABEL_TO_INDEX.get(lid)
            if idx is not None:
                repair_count += sum(counts[idx])
        for lid in CONFLICT_LABELS:
            idx = LABEL_TO_INDEX.get(lid)
            if idx is not None:
                conflict_count += sum(counts[idx])

        total_relevant = repair_count + conflict_count
        if total_relevant < 3:
            return 0.5, total_relevant / max(AXIS_CONFIDENCE_TURN_THRESHOLD, 1)

        repair_ratio = repair_count / (total_relevant + EPSILON)

        # 적대성 자기루프 (낮을수록 좋음)
        hostile_self_loop = 0.0
        if HOSTILE_LABEL is not None:
            h_total = sum(counts[HOSTILE_LABEL])
            if h_total > 0:
                hostile_self_loop = counts[HOSTILE_LABEL][HOSTILE_LABEL] / h_total

        # hostile 감쇠 (late < early → 좋음)
        hostile_early = timeseries.early_distribution.get('F', 0.0)
        hostile_late = timeseries.late_distribution.get('F', 0.0)
        decay_bonus = _clamp(hostile_early - hostile_late)

        score = _clamp(
            0.4 * repair_ratio
            + 0.3 * (1.0 - hostile_self_loop)
            + 0.3 * decay_bonus
        )
        conf = min(1.0, total_relevant / AXIS_CONFIDENCE_TURN_THRESHOLD)
        return score, conf

    def _compute_a15_relational(
        self, metrics, probs: list[list[float]], counts: list[list[int]],
    ) -> tuple[str, dict[str, float], float]:
        """A15: 관계 투자도 (Relational Investment).
        OTHER_REPAIR(241) + CLARIFICATION_OFFER(242) 빈도 기반."""
        if not counts or not counts[0]:
            return 'insufficient', {'active_investor': 0.33, 'passive_maintainer': 0.34, 'disengaged': 0.33}, 0.0

        INVEST_LABELS = [241, 242, 304, 303]  # other_repair, clarification_offer, empathy, share_personal
        DISENGAGE_LABELS = [301, 267, 222]  # disinterest, deflection, hostile

        invest_count = 0
        disengage_count = 0
        for lid in INVEST_LABELS:
            idx = LABEL_TO_INDEX.get(lid)
            if idx is not None:
                invest_count += sum(counts[idx])
        for lid in DISENGAGE_LABELS:
            idx = LABEL_TO_INDEX.get(lid)
            if idx is not None:
                disengage_count += sum(counts[idx])

        total = invest_count + disengage_count
        if total < 3:
            return 'insufficient', {'active_investor': 0.33, 'passive_maintainer': 0.34, 'disengaged': 0.33}, total / max(AXIS_CONFIDENCE_TURN_THRESHOLD, 1)

        invest_ratio = invest_count / (total + EPSILON)
        scores = {
            'active_investor': max(0.0, invest_ratio - 0.3) * 2.0,
            'passive_maintainer': max(0.0, 1.0 - abs(invest_ratio - 0.5) * 3.0),
            'disengaged': max(0.0, (1.0 - invest_ratio) - 0.3) * 2.0,
        }
        mix = normalize_scores(scores)
        style = max(sorted(mix.keys()), key=lambda k: mix[k])
        conf = min(1.0, total / AXIS_CONFIDENCE_TURN_THRESHOLD)
        return style, mix, conf

    def _compute_a16_cognitive(
        self, metrics, l2: L2Output,
    ) -> tuple[str, dict[str, float], float]:
        """A16: 인지적 복잡성 (Cognitive Complexity).
        ELABORATION(246) + ALTERNATIVE(181) + PARTIAL_AGREE(202) +
        CONDITIONAL_AGREE(207) + META labels(100-108)."""
        counts = l2.transition.counts_dense
        if not counts or not counts[0]:
            return 'insufficient', {'analytical_nuanced': 0.33, 'pragmatic_direct': 0.34, 'binary_reactive': 0.33}, 0.0

        COMPLEX_LABELS = [246, 181, 202, 207]  # elaboration, alternative, partial_agree, conditional_agree
        META_LABELS = list(range(100, 109))  # 100-108
        BINARY_LABELS = [200, 201, 301]  # agree, disagree, disinterest

        complex_count = 0
        for lid in COMPLEX_LABELS + META_LABELS:
            idx = LABEL_TO_INDEX.get(lid)
            if idx is not None:
                complex_count += sum(counts[idx])

        binary_count = 0
        for lid in BINARY_LABELS:
            idx = LABEL_TO_INDEX.get(lid)
            if idx is not None:
                binary_count += sum(counts[idx])

        total = complex_count + binary_count
        if total < 3:
            return 'insufficient', {'analytical_nuanced': 0.33, 'pragmatic_direct': 0.34, 'binary_reactive': 0.33}, 0.0

        ratio = complex_count / (total + EPSILON)
        scores = {
            'analytical_nuanced': max(0.0, ratio - 0.4) * 3.0,
            'pragmatic_direct': max(0.0, 1.0 - abs(ratio - 0.4) * 3.0),
            'binary_reactive': max(0.0, (1.0 - ratio) - 0.3) * 2.0,
        }
        mix = normalize_scores(scores)
        style = max(sorted(mix.keys()), key=lambda k: mix[k])
        conf = min(1.0, total / AXIS_CONFIDENCE_TURN_THRESHOLD)
        return style, mix, conf

    def _compute_a17_humor(
        self, probs: list[list[float]], counts: list[list[int]], metrics,
    ) -> tuple[str, dict[str, float], float]:
        """A17: 유머 활용 (Humor Utilization).
        LAUGHTER_MARKER(226) 전후 맥락으로 유머 유형 분류."""
        if not counts or not counts[0]:
            return 'minimal', {'tension_breaker': 0.0, 'bonding': 0.0, 'deflective': 0.0, 'aggressive': 0.0, 'minimal': 1.0}, 0.0

        LAUGH = LABEL_TO_INDEX.get(226)
        if LAUGH is None:
            return 'minimal', {'tension_breaker': 0.0, 'bonding': 0.0, 'deflective': 0.0, 'aggressive': 0.0, 'minimal': 1.0}, 0.0

        laugh_total = sum(counts[LAUGH])
        # 226으로의 인바운드 전이도 확인
        inbound_total = sum(counts[i][LAUGH] for i in range(len(counts)))

        total = laugh_total + inbound_total
        if total < 3:
            return 'minimal', {'tension_breaker': 0.0, 'bonding': 0.0, 'deflective': 0.0, 'aggressive': 0.0, 'minimal': 1.0}, 0.0

        # tension_breaker: conflict(222,224,269) → 226
        conflict_to_laugh = sum(
            counts[LABEL_TO_INDEX[lid]][LAUGH]
            for lid in [222, 224, 269] if lid in LABEL_TO_INDEX
        )
        # bonding: small_talk(302), share_personal(303) → 226
        bond_to_laugh = sum(
            counts[LABEL_TO_INDEX[lid]][LAUGH]
            for lid in [302, 303] if lid in LABEL_TO_INDEX
        )
        # deflective: 226 → deflection(267), disinterest(301)
        laugh_to_deflect = sum(
            counts[LAUGH][LABEL_TO_INDEX[lid]]
            for lid in [267, 301] if lid in LABEL_TO_INDEX
        )
        # aggressive: 226 → hostile(222), swear(227)
        laugh_to_hostile = sum(
            counts[LAUGH][LABEL_TO_INDEX[lid]]
            for lid in [222, 227] if lid in LABEL_TO_INDEX
        )

        scores = {
            'tension_breaker': float(conflict_to_laugh),
            'bonding': float(bond_to_laugh),
            'deflective': float(laugh_to_deflect),
            'aggressive': float(laugh_to_hostile),
            'minimal': max(0.0, 1.0 - (laugh_total / max(metrics.total_turns or 1, 1)) * 10),
        }
        mix = normalize_scores(scores)
        style = max(sorted(mix.keys()), key=lambda k: mix[k])
        conf = min(1.0, total / AXIS_CONFIDENCE_TURN_THRESHOLD)
        return style, mix, conf
