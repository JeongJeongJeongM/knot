"""
EXODIA v5.0 pipeline.py — 전체 파이프라인 오케스트레이션.
v5.0 Spec Section 16 데이터 흐름.

4가지 주요 기능:
1. analyze_session() — 단일 세션 분석 → SessionProfile
2. build_user_profile() — 복수 세션 → UserProfile (Cold Start cap 포함)
3. match_users() — 두 UserProfile → MatchResult
4. gap_analysis() — 유저별 cold vs real 갭 분석 (L7)

v5.0 변경사항:
- CalibrationConfig DI 추가 (LSM v5.0 Korean-optimized)
- Cold Start confidence cap (turn_count 기반)
- L5 Comparator에 DI 통합
- engine_version → "5.0.0"
"""
import hashlib
import time
from datetime import datetime, timezone
from typing import Literal, Optional

from exodia.config import (
    ENGINE_VERSION,
    MAX_TURNS_PER_SESSION,
    SPEC_VERSION,
    VALID_SPEAKERS,
)
from exodia.calibration import CalibrationConfig
from exodia.gap_analysis import L7GapAnalyzer
from exodia.kernel.l0_morphology import process_morphology
from exodia.kernel.l1_syntax import process_syntax
from exodia.kernel.l2_pragmatics import process_pragmatics
from exodia.layers.integrity import IntegrityGate
from exodia.layers.l0 import L0Processor
from exodia.layers.l1 import L1Processor, LLMProvider, MockProvider
from exodia.layers.l1_rules import RuleBasedKoreanProvider
from exodia.layers.l2 import L2Processor
from exodia.layers.l3 import L3Synthesizer
from exodia.layers.l3_5 import L35Processor
from exodia.layers.l4 import L4Projector
from exodia.layers.l5 import L5Comparator
from exodia.lsm import KoreanLSMEngine, LSMEngine
from exodia.schemas import (
    ConversationSession,
    EngineError,
    L0Output,
    L1Output,
    L2Output,
    L5Output,
    L7Output,
    LSMFeatures,
    MatchResult,
    MorphologyOutput,
    PipelineMetadata,
    PragmaticsOutput,
    SessionProfile,
    UserProfile,
)


def _compute_hash(data: str) -> str:
    """SHA-256 해시."""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def _now_iso() -> str:
    """현재 시각 ISO 포맷."""
    return datetime.now(timezone.utc).isoformat()


def _make_metadata(input_hash: str = "", build_sha: str = "dev") -> PipelineMetadata:
    """공통 메타데이터 생성."""
    return PipelineMetadata(
        engine_version=ENGINE_VERSION,
        spec_version=SPEC_VERSION,
        build_sha=build_sha,
        input_hash=input_hash,
        computed_at=_now_iso(),
    )


class ExodiaPipeline:
    """EXODIA v5.0 엔진 파이프라인.

    v5.0 Pipeline:
    - analyze_session: ConversationSession → SessionProfile (incl. LSM features)
    - build_user_profile: SessionProfile[] → UserProfile (incl. Cold Start cap)
    - match_users: UserProfile × 2 → MatchResult (incl. L7 gap analysis)

    v5.0: CalibrationConfig DI + Korean LSM default
    """

    def __init__(self, llm_provider: Optional[LLMProvider] = None,
                 build_sha: str = "dev",
                 calibration_config: Optional['CalibrationConfig'] = None,
                 lsm_engine: Optional[KoreanLSMEngine] = None):
        self.l0 = L0Processor()
        self.l1 = L1Processor(provider=llm_provider or RuleBasedKoreanProvider())
        self.l2 = L2Processor()
        self.integrity = IntegrityGate()
        self.l3 = L3Synthesizer()
        self.l3_5 = L35Processor()
        self.l4 = L4Projector()
        self.config = calibration_config or CalibrationConfig()
        self.lsm = lsm_engine or KoreanLSMEngine()  # v5.0: Korean LSM default
        self.l5 = L5Comparator(lsm_engine=self.lsm, calibration_config=self.config)  # inject
        self.l7 = L7GapAnalyzer()
        self._build_sha = build_sha

    def analyze_session(
        self,
        session: ConversationSession,
        purpose_distribution: dict[str, float] | None = None,
        user_id: str = "",
        session_type: Literal["cold_llm", "real_peer"] = "cold_llm",
        peer_id: str | None = None,
    ) -> SessionProfile | EngineError:
        """단일 세션 분석. — v4.0 Spec Section 16.1

        ConversationSession → L0-Norm → NLP Kernel → L2.5 → L3 → Integrity
        → L4 → L5 → LSM → SessionProfile

        v4.0 변경: session_type, peer_id 추가, LSM rate 추출.
        """
        try:
            start_time = time.monotonic()

            # 입력 해시
            raw_texts = [t.raw_text for t in session.turns]
            input_hash = _compute_hash("||".join(raw_texts))

            # E-05: 화자 필터링
            user_turns = [
                t for t in session.turns
                if t.metadata.speaker in VALID_SPEAKERS
            ]

            # E-04: 턴 수 제한
            if len(user_turns) > MAX_TURNS_PER_SESSION:
                user_turns = user_turns[-MAX_TURNS_PER_SESSION:]

            if not user_turns:
                return EngineError(
                    error_code='INSUFFICIENT_TURNS',
                    error_stage='PIPELINE',
                    message='No valid user turns in session',
                    input_hash=input_hash,
                    engine_version=ENGINE_VERSION,
                )

            # L0-Norm: 각 턴 정규화
            l0_outputs: list[L0Output] = []
            for turn in user_turns:
                l0_out = self.l0.process(
                    turn_id=turn.turn_id,
                    raw_text=turn.raw_text,
                    metadata={"speaker": turn.metadata.speaker},
                )
                l0_outputs.append(l0_out)

            # NLP Kernel: L0 Morphology + L1 Syntax + L2 Pragmatics
            morphology_outputs: list[MorphologyOutput] = []
            pragmatics_outputs: list[PragmaticsOutput] = []

            for l0_out in l0_outputs:
                morph = process_morphology(l0_out.normalized_text)
                syntax = process_syntax(l0_out.normalized_text)
                prag = process_pragmatics(l0_out.normalized_text, morph, syntax)
                morphology_outputs.append(morph)
                pragmatics_outputs.append(prag)

            # L2.5: 각 턴 라벨링
            l1_outputs: list[L1Output] = []
            for l0_out in l0_outputs:
                l1_out = self.l1.process(l0_out)
                l1_outputs.append(l1_out)

            # L3: 세션 집계
            l2_output = self.l2.process(session.session_id, l1_outputs)

            # Integrity Gate
            integrity_output = self.integrity.evaluate(
                l2_output=l2_output,
                client_signals=session.client_signals,
                turn_count=len(user_turns),
            )

            # L4: 축 합성
            l3_output = self.l3.process(l2_output)

            # L5: 투영
            l4_output = self.l4.process(l3_output, purpose_distribution)

            # LSM: 기능어 rate 추출 (v4.0 NEW)
            lsm_features = self.lsm.extract_rates(
                morphology_outputs, pragmatics_outputs
            )

            elapsed_ms = (time.monotonic() - start_time) * 1000

            return SessionProfile(
                session_id=session.session_id,
                user_id=user_id,
                session_type=session_type,
                peer_id=peer_id,
                l3=l3_output,
                l4=l4_output,
                integrity=integrity_output,
                l2_direction=l2_output.direction_metrics,
                lsm_features=lsm_features,
                turn_count=len(user_turns),
                computed_at=_now_iso(),
                metadata=_make_metadata(input_hash, self._build_sha),
            )

        except AssertionError as e:
            return EngineError(
                error_code='INVARIANT_VIOLATION',
                error_stage='PIPELINE',
                message=str(e),
                input_hash=_compute_hash(session.session_id),
                engine_version=ENGINE_VERSION,
            )
        except Exception as e:
            return EngineError(
                error_code='COMPUTATION_ERROR',
                error_stage='PIPELINE',
                message=str(e),
                input_hash=_compute_hash(session.session_id),
                engine_version=ENGINE_VERSION,
            )

    def build_user_profile(
        self,
        user_id: str,
        session_profiles: list[SessionProfile],
        l2_outputs: list[L2Output] | None = None,
        all_l1_outputs: list[list[L1Output]] | None = None,
    ) -> UserProfile:
        """복수 세션 → UserProfile. — v5.0 Spec Section 16.2

        SessionProfile[] (≥3) → L3.5 → L4 집계 → UserProfile

        v5.0 변경: Cold Start confidence cap (turn_count 기반).
        """
        session_count = len(session_profiles)

        # L3.5: 일관성 감사
        consistency = self.l3_5.process(
            user_id=user_id,
            session_profiles=session_profiles,
            l2_outputs=l2_outputs or [],
            all_l1_outputs=all_l1_outputs,
        )

        # 시간 가중 평균 L3 (최신 세션 가중치 ↑)
        aggregated_l3 = self._aggregate_l3(session_profiles)

        # Integrity 가중 → 최악값
        worst_integrity = min(
            (sp.integrity.trust_score or 1.0 for sp in session_profiles),
            default=1.0,
        )

        # 집계 L4 (마지막 세션 기준)
        aggregated_l4 = session_profiles[-1].l4 if session_profiles else None

        # v5.0: Dual profile — cold vs real 분리
        cold_sessions = [sp for sp in session_profiles if sp.session_type == "cold_llm"]
        real_sessions = [sp for sp in session_profiles if sp.session_type == "real_peer"]

        profile_cold = cold_sessions[-1] if cold_sessions else None
        profile_real = real_sessions[-1] if real_sessions else None

        # v5.0: LSM scores (단일 세션 대표값)
        lsm_cold = (
            self.lsm.compute_single_session_lsm(profile_cold.lsm_features)
            if profile_cold and profile_cold.lsm_features else None
        )
        lsm_real = (
            self.lsm.compute_single_session_lsm(profile_real.lsm_features)
            if profile_real and profile_real.lsm_features else None
        )

        # v5.0: Cold Start confidence cap
        total_turns = sum(sp.turn_count for sp in session_profiles)
        conf_cap = self.config.confidence_cap(total_turns)

        # 상태 분류
        if total_turns < self.config.cold_start_min_turns:
            status = 'INSUFFICIENT'
        elif session_count >= 3 and consistency.risk_level != 'HIGH':
            worst_trust = min(
                (sp.integrity.trust_level for sp in session_profiles),
                key=lambda x: {'TRUSTED': 4, 'CAUTIOUS': 3, 'SUSPICIOUS': 2,
                               'UNTRUSTED': 1, 'UNKNOWN': 0}.get(x, 0),
            )
            if worst_trust in ('UNTRUSTED',):
                status = 'PARTIAL'
            else:
                status = 'PROFILED'
        elif session_count >= 1:
            status = 'PARTIAL'
        else:
            status = 'INSUFFICIENT'

        return UserProfile(
            user_id=user_id,
            profile_cold=profile_cold,
            profile_real=profile_real,
            l3=aggregated_l3,
            l4=aggregated_l4 or (session_profiles[0].l4 if session_profiles else None),
            integrity=session_profiles[-1].integrity if session_profiles else None,
            consistency=consistency,
            lsm_cold=lsm_cold,
            lsm_real=lsm_real,
            session_count=session_count,
            status=status,
            metadata=_make_metadata(
                _compute_hash(user_id), self._build_sha
            ),
        )

    def match_users(
        self,
        profile_a: UserProfile,
        profile_b: UserProfile,
        phase: str = "cold",
    ) -> MatchResult:
        """두 UserProfile → MatchResult. — v5.0 Spec Section 16.3

        v5.0 변경:
        - engine_version → "5.0.0"
        - phase 파라미터 (cold/real)
        - LSM 통합 (3-way friction)
        - L7 Gap Analysis 자동 실행 (profile_real 존재 시)
        """
        pair_id = f"{profile_a.user_id}:{profile_b.user_id}"

        # L6 Comparison (3-way friction incl. LSM)
        l5_output = self.l5.compare(profile_a, profile_b, phase=phase)
        l5_output.pair_id = pair_id

        # L7 Gap Analysis (v5.0 NEW)
        # Spec 14.2: profile_real이 있을 때만 활성화
        l7_a: Optional[L7Output] = None
        l7_b: Optional[L7Output] = None

        if profile_a.profile_real is not None:
            l7_a = self.l7.analyze(profile_a)
        if profile_b.profile_real is not None:
            l7_b = self.l7.analyze(profile_b)

        return MatchResult(
            pair_id=pair_id,
            person_a_id=profile_a.user_id,
            person_b_id=profile_b.user_id,
            phase=phase,
            l5=l5_output,
            l7_a=l7_a,
            l7_b=l7_b,
            metadata=_make_metadata(
                _compute_hash(pair_id), self._build_sha
            ),
        )

    def _aggregate_l3(self, session_profiles: list[SessionProfile]):
        """시간 가중 평균 L3."""
        from exodia.schemas import L3Output, IntensityAxis, StructuralAxis

        if not session_profiles:
            return L3Output()

        # 시간 가중치: 최신일수록 높은 가중치
        n = len(session_profiles)
        weights = [(i + 1) / sum(range(1, n + 1)) for i in range(n)]

        # Integrity trust_score 가중 배율
        for i, sp in enumerate(session_profiles):
            trust = sp.integrity.trust_score if sp.integrity.trust_score is not None else 0.5
            weights[i] *= trust

        # 정규화
        total_w = sum(weights)
        if total_w > 0:
            weights = [w / total_w for w in weights]
        else:
            weights = [1.0 / n for _ in range(n)]

        # 강도 축 가중 평균
        intensity_keys = ["A1", "A2", "A3", "A4", "A5", "A6", "A12", "A14"]
        intensity_axes = {}
        for key in intensity_keys:
            weighted_score = sum(
                w * (sp.l3.intensity_axes.get(key, IntensityAxis()).score)
                for w, sp in zip(weights, session_profiles)
            )
            weighted_score = max(0.0, min(1.0, weighted_score))
            from exodia.layers.l3 import _classify_level
            intensity_axes[key] = IntensityAxis(
                score=weighted_score,
                level=_classify_level(weighted_score),
                confidence=max(
                    (sp.l3.intensity_axes.get(key, IntensityAxis()).confidence
                     for sp in session_profiles),
                    default=0.0,
                ),
            )

        # 구조 축: 시간 가중 mix 평균
        structural_keys = ["A7", "A8", "A9", "A10", "A11", "A13", "A15", "A16", "A17"]
        structural_axes = {}
        for key in structural_keys:
            # 각 세션의 mix를 가중 평균
            all_mix_keys: set[str] = set()
            for sp in session_profiles:
                sa = sp.l3.structural_axes.get(key)
                if sa and sa.mix:
                    all_mix_keys.update(sa.mix.keys())

            if not all_mix_keys:
                structural_axes[key] = session_profiles[-1].l3.structural_axes.get(
                    key, StructuralAxis()
                )
                continue

            weighted_mix: dict[str, float] = {k: 0.0 for k in all_mix_keys}
            for w, sp in zip(weights, session_profiles):
                sa = sp.l3.structural_axes.get(key)
                if sa and sa.mix:
                    for mk, mv in sa.mix.items():
                        weighted_mix[mk] += w * mv

            # 정규화
            mix_total = sum(weighted_mix.values())
            if mix_total > 0:
                weighted_mix = {k: v / mix_total for k, v in weighted_mix.items()}

            dominant = max(sorted(weighted_mix.keys()), key=lambda k: weighted_mix[k])
            structural_axes[key] = StructuralAxis(
                dominant=dominant,
                mix=weighted_mix,
                confidence=max(
                    (sp.l3.structural_axes.get(key, StructuralAxis()).confidence
                     for sp in session_profiles),
                    default=0.0,
                ),
            )

        return L3Output(
            intensity_axes=intensity_axes,
            structural_axes=structural_axes,
        )

