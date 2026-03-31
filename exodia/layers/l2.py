"""
EXODIA L2 — Statistics (통계).
순수 Python. LLM 금지. 결정론적.
구현 기준: PART 6 §4.3 + PART 9 (T-01~T-11) + PART 11 (F-01~F-03, F-06).
"""
import math
from typing import Optional

from exodia.config import (
    ALLOWED_LABEL_ID_SET_MATRIX,
    ALLOWED_LABEL_IDS_MATRIX,
    CONFIDENCE_FILTER_THRESHOLD,
    CR04_EXPECTED_TRANSITION_RATE,
    EPSILON,
    K,
    LABEL_CATEGORIES,
    LABEL_TO_INDEX,
    LONG_WINDOW_MIN,
    MAX_TURNS_PER_SESSION,
    MIN_EFFECTIVE_TRANSITIONS,
    SHORT_WINDOW,
    SMOOTHING_ALPHA,
    STD_DDOF,
    VALID_SPEAKERS,
    VOLATILITY_SERIES_SET,
)
from exodia.schemas import (
    DirectionMetrics,
    L1Output,
    L2Metrics,
    L2Output,
    MentionSummary,
    TimeseriesData,
    TransitionData,
    TransitionQC,
)


def safe_log(x: float) -> float:
    """log(0) 방지. — PART 10, E-02"""
    return math.log(max(x, EPSILON))


def _std(values: list[float]) -> float:
    """Population std (ddof=0). — PART 11, F-08"""
    if len(values) < 1:
        return 0.0
    n = len(values)
    mean_v = sum(values) / n
    variance = sum((x - mean_v) ** 2 for x in values) / n
    return math.sqrt(variance)


def _mean(values: list[float]) -> float:
    """산술 평균. — PART 11, F-08"""
    if not values:
        return 0.0
    return sum(values) / len(values)


def _count_change_points(series: list[float]) -> int:
    """편차 기반 변화점 탐지. — PART 9, T-09 + PART 11, F-04"""
    if len(series) < 3:
        return 0
    mean_val = _mean(series)
    std_val = _std(series)
    if std_val < EPSILON:
        return 0
    return sum(1 for x in series if abs(x - mean_val) > 2 * std_val)


class L2Processor:
    """L2 세션 집계 프로세서."""

    def process(self, session_id: str, l1_outputs: list[L1Output],
                speaker_filter: bool = True) -> L2Output:
        """L1Output 리스트 → L2Output.

        처리 순서 (PART 11, F-06):
        1. Speaker 필터 (E-05)
        2. MAX_TURNS 절단 (E-04)
        3. L1 검증
        4~12. 전이행렬 + 파생 메트릭
        """
        # 1. Speaker 필터 (E-05)
        if speaker_filter:
            # MVP에서는 모든 턴을 user로 간주
            filtered = l1_outputs
        else:
            filtered = l1_outputs

        # 2. MAX_TURNS 절단 (E-04)
        truncated = False
        if len(filtered) > MAX_TURNS_PER_SESSION:
            filtered = filtered[-MAX_TURNS_PER_SESSION:]
            truncated = True

        total_turns = len(filtered)

        if total_turns == 0:
            return L2Output(
                session_id=session_id,
                metrics=L2Metrics(total_turns=0, valid_turns=0),
            )

        # 메트릭 계산
        metrics = self._compute_metrics(filtered)
        transition = self._compute_transition(filtered, truncated)
        timeseries = self._compute_timeseries(filtered)
        mentions = self._compute_mentions(filtered)
        direction_metrics = self._compute_direction_metrics(filtered)
        cr04_tone_anomaly = self._compute_cr04(filtered)

        return L2Output(
            session_id=session_id,
            metrics=metrics,
            transition=transition,
            timeseries=timeseries,
            mentions=mentions,
            direction_metrics=direction_metrics,
            cr03_latency_anomaly=0.0,  # 클라이언트 신호 필요
            cr04_tone_anomaly=cr04_tone_anomaly,
        )

    def _compute_metrics(self, l1_outputs: list[L1Output]) -> L2Metrics:
        """Core + Extended 메트릭 계산. — PART 1 §5.2~5.3"""
        total = len(l1_outputs)
        if total == 0:
            return L2Metrics(total_turns=0, valid_turns=0)

        # UNKNOWN 제외 (PART 11, F-01.3)
        valid = [o for o in l1_outputs if o.primary_id != 0]
        valid_count = len(valid)

        # 라벨별 카운트
        label_counts: dict[int, int] = {}
        for o in valid:
            label_counts[o.primary_id] = label_counts.get(o.primary_id, 0) + 1

        def rate(label_id: int) -> float:
            return label_counts.get(label_id, 0) / total if total > 0 else 0.0

        # Core (6)
        interest_rate = rate(300)        # INTEREST_SIGNAL
        disinterest_rate = rate(301)     # DISINTEREST_SIGNAL
        sharing_rate = rate(303)         # SHARE_PERSONAL
        empathy_rate = rate(304)         # EMPATHY
        task_assign_rate = rate(307)     # TASK_ASSIGN
        status_update_rate = rate(308)   # STATUS_UPDATE

        # Extended (4)
        smalltalk_rate = rate(302)       # SMALL_TALK
        feedback_pos_rate = rate(305)    # FEEDBACK_POSITIVE
        feedback_neg_rate = rate(306)    # FEEDBACK_NEGATIVE
        availability_rate = rate(309)    # AVAILABILITY_CHECK

        # 추가 (L3에서 사용)
        hostile_rate = rate(222)         # EXPRESS_HOSTILE
        distress_rate = rate(225)        # EXPRESS_DISTRESS
        boundary_rate = rate(263)        # BOUNDARY_SET

        # 카테고리별 분포
        category_counts: dict[str, int] = {}
        for cat_name, cat_ids in sorted(LABEL_CATEGORIES.items()):
            if cat_name == "UNKNOWN":
                continue
            count = sum(label_counts.get(lid, 0) for lid in cat_ids)
            category_counts[cat_name] = count

        total_cat = sum(category_counts.values())
        category_mix: dict[str, float] = {}
        for cat_name in sorted(category_counts.keys()):
            category_mix[cat_name] = (
                category_counts[cat_name] / total_cat if total_cat > 0 else 0.0
            )

        return L2Metrics(
            interest_rate=interest_rate,
            disinterest_rate=disinterest_rate,
            sharing_rate=sharing_rate,
            empathy_rate=empathy_rate,
            task_assign_rate=task_assign_rate,
            status_update_rate=status_update_rate,
            smalltalk_rate=smalltalk_rate,
            feedback_pos_rate=feedback_pos_rate,
            feedback_neg_rate=feedback_neg_rate,
            availability_rate=availability_rate,
            hostile_rate=hostile_rate,
            distress_rate=distress_rate,
            boundary_rate=boundary_rate,
            category_mix=category_mix,
            total_turns=total,
            valid_turns=valid_count,
        )

    def _compute_transition(self, l1_outputs: list[L1Output],
                             truncated: bool = False) -> TransitionData:
        """전이행렬 계산. — PART 9 T-01~T-11 + PART 11 F-01~F-06

        12단계 파이프라인 (PART 11, F-06):
        1. Speaker 필터 — 이미 적용됨
        2. MAX_TURNS 절단 — 이미 적용됨
        3-7. 전이 카운트
        8. Dense 인덱싱 (T-06)
        9. 라플라스 스무딩 (T-03)
        10. Self-loop (T-07)
        11. 엔트로피 (T-04)
        12. 불변성 검증 (E-07)
        """
        N = len(l1_outputs)
        qc = TransitionQC(truncated=truncated)

        # 85×85 dense count matrix 초기화
        counts = [[0] * K for _ in range(K)]

        # 전이 카운트 (T-01, T-02, T-05, T-06, T-11)
        effective_transitions = 0
        skipped_transitions = 0
        low_conf_turns = 0
        unknown_turns = 0
        invalid_label_turns = 0

        for t in range(N):
            lid = l1_outputs[t].primary_id
            conf = l1_outputs[t].confidence

            # UNKNOWN/Invalid 검사 (T-05, F-01.3)
            if lid not in ALLOWED_LABEL_ID_SET_MATRIX:
                unknown_turns += 1
            if conf < CONFIDENCE_FILTER_THRESHOLD:
                low_conf_turns += 1

        # T-01: 경계 처리 — t=0..N-2만 전이
        # T-02: confidence 필터 — 양쪽 모두 >= 0.6
        # T-05: UNKNOWN 제외 — ALLOWED_LABEL_ID_SET_MATRIX 포함 여부
        # T-11: primary_id만 사용
        for t in range(N - 1):
            lid_t = l1_outputs[t].primary_id
            lid_t1 = l1_outputs[t + 1].primary_id
            conf_t = l1_outputs[t].confidence
            conf_t1 = l1_outputs[t + 1].confidence

            # Confidence 필터 (T-02)
            if conf_t < CONFIDENCE_FILTER_THRESHOLD or conf_t1 < CONFIDENCE_FILTER_THRESHOLD:
                skipped_transitions += 1
                continue

            # UNKNOWN/Invalid 필터 (T-05)
            if lid_t not in ALLOWED_LABEL_ID_SET_MATRIX:
                skipped_transitions += 1
                continue
            if lid_t1 not in ALLOWED_LABEL_ID_SET_MATRIX:
                skipped_transitions += 1
                continue

            # Dense 인덱싱 (T-06)
            idx_t = LABEL_TO_INDEX[lid_t]
            idx_t1 = LABEL_TO_INDEX[lid_t1]
            counts[idx_t][idx_t1] += 1
            effective_transitions += 1

        # QC 기록
        qc.unknown_turns = unknown_turns
        qc.low_conf_turn_rate = low_conf_turns / N if N > 0 else 0.0
        qc.skipped_transition_rate = (
            skipped_transitions / (N - 1) if N > 1 else 0.0
        )

        if effective_transitions == 0:
            qc.no_transition = True

        # 라플라스 스무딩 (T-03)
        probs = [[0.0] * K for _ in range(K)]
        for i in range(K):
            out_i = sum(counts[i])
            for j in range(K):
                probs[i][j] = (counts[i][j] + SMOOTHING_ALPHA) / (
                    out_i + SMOOTHING_ALPHA * K
                )

        # Self-loop 계산 (T-07)
        diagonal_sum = sum(counts[i][i] for i in range(K))
        self_loop_all = (
            diagonal_sum / effective_transitions
            if effective_transitions > 0
            else 0.0
        )

        # 엔트로피 계산 (T-04)
        # 상태별 엔트로피
        row_weights = []
        row_entropies = []
        total_out = sum(sum(counts[i]) for i in range(K))
        for i in range(K):
            out_i = sum(counts[i])
            w_i = out_i / total_out if total_out > 0 else 0.0
            h_i = -sum(
                probs[i][j] * safe_log(probs[i][j])
                for j in range(K)
            )
            row_weights.append(w_i)
            row_entropies.append(h_i)

        h_session = sum(w * h for w, h in zip(row_weights, row_entropies))

        # 정규화
        h_norm: Optional[float] = None
        if effective_transitions >= MIN_EFFECTIVE_TRANSITIONS:
            log_k = math.log(K)  # log(85) ≈ 4.4427
            h_norm = h_session / log_k if log_k > 0 else 0.0
            h_norm = max(0.0, min(1.0, h_norm))

        # 불변성 검증 (E-07) — 기존 QC 플래그로 전파, assert 금지
        for i in range(K):
            row_sum = sum(probs[i])
            if abs(row_sum - 1.0) >= 1e-9:
                qc.no_transition = True
                return TransitionData(qc=qc)

        if not (0.0 <= self_loop_all <= 1.0):
            qc.no_transition = True
            return TransitionData(qc=qc)

        if h_norm is not None and not (0.0 <= h_norm <= 1.0):
            qc.no_transition = True
            return TransitionData(qc=qc)

        # effective_transitions >= 0 은 구조적으로 음수 불가. 검증 생략.

        return TransitionData(
            counts_dense=counts,
            probs_dense=probs,
            self_loop_all=self_loop_all,
            entropy_raw=h_session,
            entropy_norm=h_norm,
            effective_transitions=effective_transitions,
            qc=qc,
        )

    def _compute_timeseries(self, l1_outputs: list[L1Output]) -> TimeseriesData:
        """시계열 계산. — PART 6 §4.3 + PART 9 T-08~T-10 + PART 11 F-02"""
        N = len(l1_outputs)
        if N == 0:
            return TimeseriesData(turn_count=0)

        # Long window 계산 (PART 11, F-02)
        long_window = max(LONG_WINDOW_MIN, N // 3)

        # Rolling rate 계산 (비중첩, T-10)
        def compute_rolling_rate(l1s: list[L1Output], window: int,
                                  target_ids: set[int]) -> list[float]:
            """비중첩 Rolling rate 계산."""
            stride = window  # T-10
            rates: list[float] = []
            pos = 0
            while pos + window <= len(l1s):
                chunk = l1s[pos:pos + window]
                count = sum(1 for o in chunk if o.primary_id in target_ids)
                rates.append(count / window)
                pos += stride
            return rates

        hostile_ids = {222}     # EXPRESS_HOSTILE
        distress_ids = {225}    # EXPRESS_DISTRESS

        hostile_short = compute_rolling_rate(l1_outputs, SHORT_WINDOW, hostile_ids)
        hostile_long = compute_rolling_rate(l1_outputs, long_window, hostile_ids)
        distress_short = compute_rolling_rate(l1_outputs, SHORT_WINDOW, distress_ids)
        distress_long = compute_rolling_rate(l1_outputs, long_window, distress_ids)

        # Volatility (T-08)
        all_series = {
            'hostile_rate_short': hostile_short,
            'hostile_rate_long': hostile_long,
            'distress_rate_short': distress_short,
            'distress_rate_long': distress_long,
        }
        vol_stds = []
        for key in VOLATILITY_SERIES_SET:
            s = all_series.get(key, [])
            if len(s) >= 2:
                vol_stds.append(_std(s))
        volatility = _mean(vol_stds) if vol_stds else 0.0

        # Change Point (T-09)
        change_points = []
        for key in VOLATILITY_SERIES_SET:
            s = all_series.get(key, [])
            change_points.append(_count_change_points(s))
        change_point_count = sum(change_points)

        # 3등분 분포
        third = max(1, N // 3)
        early = l1_outputs[:third]
        mid = l1_outputs[third:2 * third]
        late = l1_outputs[2 * third:]

        def label_distribution(chunk: list[L1Output]) -> dict[str, float]:
            if not chunk:
                return {}
            counts: dict[str, int] = {}
            for o in chunk:
                cat = self._get_category(o.primary_id)
                counts[cat] = counts.get(cat, 0) + 1
            total = len(chunk)
            return {k: v / total for k, v in sorted(counts.items())}

        return TimeseriesData(
            hostile_rate_short=hostile_short,
            hostile_rate_long=hostile_long,
            distress_rate_short=distress_short,
            distress_rate_long=distress_long,
            volatility=volatility,
            change_point_count=change_point_count,
            turn_count=N,
            early_distribution=label_distribution(early),
            mid_distribution=label_distribution(mid),
            late_distribution=label_distribution(late),
        )

    def _compute_mentions(self, l1_outputs: list[L1Output]) -> MentionSummary:
        """멘션 집계. — PART 6 §4.3"""
        flag_counts: dict[str, int] = {}
        vd_count = 0
        total = len(l1_outputs)

        for o in l1_outputs:
            mf = o.mention_flags
            for field_name in [
                'SELF_HARM_MENTION', 'VIOLENCE_MENTION', 'SEXUAL_CONTENT_MENTION',
                'HATE_SPEECH_MENTION', 'ILLEGAL_REQUEST_MENTION', 'PERSONAL_DATA_MENTION',
                'FINANCIAL_INFO_MENTION', 'MEDICAL_CONTEXT_MENTION', 'MINOR_MENTION',
                'DOXXING_MENTION',
            ]:
                val = getattr(mf, field_name, 0)
                if val:
                    flag_counts[field_name] = flag_counts.get(field_name, 0) + 1
            if mf.VALUE_DECLARATION:
                vd_count += 1

        return MentionSummary(
            flag_counts=flag_counts,
            value_declaration_count=vd_count,
            value_declaration_rate=vd_count / total if total > 0 else 0.0,
        )

    def _compute_direction_metrics(self, l1_outputs: list[L1Output]) -> DirectionMetrics:
        """방향별 메트릭 계산. — PART 8 §2"""
        total = len(l1_outputs)
        if total == 0:
            return DirectionMetrics()

        dir_counts = {'SELF': 0, 'OTHER': 0, 'NEUTRAL': 0}
        dir_labels: dict[str, list[L1Output]] = {
            'SELF': [], 'OTHER': [], 'NEUTRAL': []
        }
        vd_self = 0
        vd_other = 0

        for o in l1_outputs:
            d_raw = str(o.direction or "neutral").lower()
            d = {"self": "SELF", "other": "OTHER", "neutral": "NEUTRAL"}.get(d_raw, "NEUTRAL")
            dir_counts[d] = dir_counts.get(d, 0) + 1
            dir_labels.setdefault(d, []).append(o)
            if o.mention_flags.VALUE_DECLARATION:
                if d == "SELF":
                    vd_self += 1
                elif d == "OTHER":
                    vd_other += 1

        direction_distribution = {
            k: v / total for k, v in sorted(dir_counts.items())
        }

        # 방향별 rate
        rates_by_direction: dict[str, dict[str, float]] = {}
        target_labels = {
            'empathy_rate': 304, 'feedback_pos_rate': 305,
            'feedback_neg_rate': 306, 'hostile_rate': 222,
            'sharing_rate': 303, 'disinterest_rate': 301,
        }
        for direction, outputs in sorted(dir_labels.items()):
            dir_total = len(outputs)
            if dir_total == 0:
                rates_by_direction[direction] = {k: 0.0 for k in target_labels}
                continue
            rates: dict[str, float] = {}
            for rate_name, label_id in sorted(target_labels.items()):
                count = sum(1 for o in outputs if o.primary_id == label_id)
                rates[rate_name] = count / dir_total
            rates_by_direction[direction] = rates

        vd_total = vd_self + vd_other
        return DirectionMetrics(
            direction_distribution=direction_distribution,
            rates_by_direction=rates_by_direction,
            value_declaration_rate=(vd_self + vd_other) / total if total > 0 else 0.0,
            value_declaration_self_rate=vd_self / total if total > 0 else 0.0,
            value_declaration_other_rate=vd_other / total if total > 0 else 0.0,
        )

    def _compute_cr04(self, l1_outputs: list[L1Output]) -> float:
        """CR04 톤 전환 부재 계산. — PART 7, PATCH-02"""
        if len(l1_outputs) < 2:
            return 0.0

        category_transitions = 0
        for i in range(len(l1_outputs) - 1):
            cat_a = self._get_category(l1_outputs[i].primary_id)
            cat_b = self._get_category(l1_outputs[i + 1].primary_id)
            if cat_a != cat_b:
                category_transitions += 1

        total = len(l1_outputs)
        expected = total * CR04_EXPECTED_TRANSITION_RATE
        anomaly = 1.0 - min(1.0, category_transitions / expected) if expected > 0 else 0.0
        return max(0.0, min(1.0, anomaly))

    @staticmethod
    def _get_category(label_id: int) -> str:
        """라벨 ID → 카테고리."""
        for cat_name, cat_ids in LABEL_CATEGORIES.items():
            if label_id in cat_ids:
                return cat_name
        return "UNKNOWN"
