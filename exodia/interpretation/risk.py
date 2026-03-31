"""
EXODIA v3 — Risk Signal Detection.

Identifies potentially harmful relationship patterns based on
multi-axis combinations. Designed for the web version where
users share profiles for matching analysis.

Risk categories:
  1. Control patterns: dominance + boundary rigidity + conflict aggression
  2. Emotional exploitation: high attunement + low empathy + manipulative markers
  3. Instability risk: volatile patterns that predict relationship harm
  4. Asymmetric dynamics: power imbalances in matching pairs

Output is structured data only — Korean descriptions are for
frontend rendering, never shown raw.

IMPORTANT: Risk signals are probabilistic indicators, NOT diagnoses.
They flag patterns worth monitoring, not definitive character judgments.
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# ─── Data Structures ────────────────────────────────────────────

@dataclass
class RiskSignal:
    """A single detected risk signal."""
    signal_id: str           # machine-readable ID e.g. "ctrl_001"
    category: str            # "control", "exploitation", "instability", "asymmetry"
    severity: str            # "low", "medium", "high", "critical"
    name_kr: str             # Korean display name
    name_en: str             # English reference name
    description_kr: str      # Korean explanation (2-3 sentences)
    axes_involved: List[str] # which axes triggered this
    confidence: float        # 0-1, how strongly the pattern matches
    recommendation_kr: str   # what to watch for / guidance


@dataclass
class RiskReport:
    """Full risk assessment for an individual or pair."""
    signals: List[RiskSignal] = field(default_factory=list)
    overall_risk: str = "none"   # "none", "low", "moderate", "elevated", "high"
    risk_score: int = 0          # 0-100
    summary_kr: str = ""

    @property
    def has_critical(self) -> bool:
        return any(s.severity == "critical" for s in self.signals)

    @property
    def signal_count(self) -> int:
        return len(self.signals)

    def by_category(self, category: str) -> List[RiskSignal]:
        return [s for s in self.signals if s.category == category]


# ─── Helper Functions ───────────────────────────────────────────

def _v(data: Dict, key: str, default: float = 0.5) -> float:
    """Extract intensity value from various data formats."""
    raw = data.get(key)
    if raw is None:
        return default
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, dict):
        return float(raw.get("score", raw.get("value", default)))
    return default


def _dom(data: Dict, key: str) -> str:
    """Extract dominant label from structural axis."""
    raw = data.get(key)
    if raw is None:
        return ""
    if isinstance(raw, dict):
        return raw.get("dominant", "")
    if isinstance(raw, str):
        return raw
    return ""


def _mix_val(data: Dict, axis: str, label: str) -> float:
    """Get a specific mix value from structural axis."""
    raw = data.get(axis)
    if not isinstance(raw, dict):
        return 0.0
    mix = raw.get("mix", {})
    return float(mix.get(label, 0.0))


# ─── Individual Risk Detection ──────────────────────────────────

def detect_individual_risk(profile_data: Dict) -> RiskReport:
    """
    Detect risk signals in an individual profile.

    Scans for:
    - Control/dominance patterns
    - Emotional manipulation markers
    - Instability indicators
    - Extreme isolation patterns

    Returns:
        RiskReport with all detected signals
    """
    signals: List[RiskSignal] = []

    # Unwrap 'axes' wrapper if present
    data = profile_data
    if "axes" in data and isinstance(data["axes"], dict):
        data = data["axes"]

    signals.extend(_detect_control_signals(data))
    signals.extend(_detect_exploitation_signals(data))
    signals.extend(_detect_instability_signals(data))
    signals.extend(_detect_isolation_signals(data))

    # Sort by severity
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    signals.sort(key=lambda s: severity_order.get(s.severity, 9))

    report = RiskReport(signals=signals)
    report.risk_score = _compute_risk_score(signals)
    report.overall_risk = _score_to_level(report.risk_score)
    report.summary_kr = _generate_individual_summary(report)

    return report


def _detect_control_signals(data: Dict) -> List[RiskSignal]:
    """Detect control and dominance risk patterns."""
    signals = []

    a3 = _v(data, "A3")  # assertiveness
    a6 = _v(data, "A6")  # stability
    a8 = _dom(data, "A8")  # conflict style
    a9 = _dom(data, "A9")  # emotion regulation
    a11 = _dom(data, "A11")  # balance (giver/taker)
    a13 = _dom(data, "A13")  # feedback response
    a15 = _dom(data, "A15")  # investment

    # CTRL-001: Dominant controller pattern
    # High assertiveness + confrontational + taker
    if a3 >= 0.7 and a8 == "confrontational" and a11 == "taker":
        signals.append(RiskSignal(
            signal_id="ctrl_001",
            category="control",
            severity="high",
            name_kr="지배적 통제 패턴",
            name_en="Dominant Controller",
            description_kr=(
                "높은 자기주장과 대립적 갈등 스타일이 '받는 쪽' 성향과 결합되어 있습니다. "
                "관계에서 상대의 필요보다 자신의 요구를 우선시하며, 갈등 시 압도하는 방식으로 "
                "대응할 가능성이 있습니다."
            ),
            axes_involved=["A3", "A8", "A11"],
            confidence=min(1.0, (a3 - 0.5) * 2),
            recommendation_kr="상대의 의견이 무시되는 패턴이 반복되는지 관찰이 필요합니다.",
        ))

    # CTRL-002: Rigid + confrontational + defensive feedback
    if a8 == "confrontational" and a13 == "defensive":
        conf = 0.7
        sev = "high" if a3 >= 0.6 else "medium"
        signals.append(RiskSignal(
            signal_id="ctrl_002",
            category="control",
            severity=sev,
            name_kr="비판 거부형 대립",
            name_en="Defensive Confrontation",
            description_kr=(
                "갈등 상황에서 정면 대응하면서도 자신에 대한 피드백은 방어적으로 "
                "처리합니다. 자신은 지적하지만 지적받는 것은 견디지 못하는 이중 기준이 "
                "관계에서 불균형을 만들 수 있습니다."
            ),
            axes_involved=["A8", "A13", "A3"],
            confidence=conf,
            recommendation_kr="쌍방향 피드백이 가능한 관계인지 확인이 필요합니다.",
        ))

    # CTRL-003: Disengaged + taker = parasitic pattern
    if a15 == "disengaged" and a11 == "taker":
        signals.append(RiskSignal(
            signal_id="ctrl_003",
            category="control",
            severity="medium",
            name_kr="기생적 무관심",
            name_en="Parasitic Disengagement",
            description_kr=(
                "관계에 투자하지 않으면서도 받는 것을 기대하는 패턴입니다. "
                "상대가 지속적으로 에너지를 소모하게 만들 수 있습니다."
            ),
            axes_involved=["A15", "A11"],
            confidence=0.65,
            recommendation_kr="관계에서 주고받는 것의 균형을 점검해 보세요.",
        ))

    return signals


def _detect_exploitation_signals(data: Dict) -> List[RiskSignal]:
    """Detect emotional exploitation risk patterns."""
    signals = []

    a1 = _v(data, "A1")  # engagement
    a2 = _v(data, "A2")  # receptivity
    a4 = _v(data, "A4")  # emotional expression
    a9 = _dom(data, "A9")  # emotion regulation
    a10 = _dom(data, "A10")  # intimacy trajectory
    a17 = _dom(data, "A17")  # humor style

    # EXPL-001: Fast opener + suppressive = love bombing risk
    if a10 == "fast_opener" and a9 == "suppressive" and a1 >= 0.6:
        signals.append(RiskSignal(
            signal_id="expl_001",
            category="exploitation",
            severity="high",
            name_kr="과잉 친밀 후 차단 패턴",
            name_en="Love Bombing Risk",
            description_kr=(
                "빠르게 친밀해지려는 성향과 감정 억압이 동시에 나타납니다. "
                "초반에 강렬한 관심을 보이다가 갑자기 감정적으로 닫힐 수 있으며, "
                "상대는 이 급격한 변화에 혼란을 겪을 수 있습니다."
            ),
            axes_involved=["A10", "A9", "A1"],
            confidence=0.75,
            recommendation_kr="친밀감의 속도가 자연스러운지, 갑작스러운 거리두기가 반복되는지 관찰하세요.",
        ))

    # EXPL-002: Aggressive humor + low receptivity = verbal abuse marker
    if a17 == "aggressive" and a2 < 0.35:
        signals.append(RiskSignal(
            signal_id="expl_002",
            category="exploitation",
            severity="high",
            name_kr="언어적 공격 경향",
            name_en="Verbal Aggression Pattern",
            description_kr=(
                "공격적 유머와 낮은 수용성이 결합되어 있습니다. "
                "'농담'이라는 이름으로 상대를 비하하거나 상처를 줄 수 있으며, "
                "상대의 반응에 둔감할 수 있습니다."
            ),
            axes_involved=["A17", "A2"],
            confidence=0.7,
            recommendation_kr="유머가 상대를 웃기는지, 상대를 향한 것인지 구분이 필요합니다.",
        ))

    # EXPL-003: Externalized emotion regulation = blame shifting
    if a9 == "externalized" and a4 >= 0.6:
        signals.append(RiskSignal(
            signal_id="expl_003",
            category="exploitation",
            severity="medium",
            name_kr="감정 전가 패턴",
            name_en="Emotional Externalization",
            description_kr=(
                "자신의 감정을 외부로 표출하는 방식으로 조절합니다. "
                "감정 표현이 높은 편이라 주변 사람이 이 사람의 감정 상태에 "
                "지속적으로 영향을 받을 수 있습니다."
            ),
            axes_involved=["A9", "A4"],
            confidence=0.6,
            recommendation_kr="감정적 부담이 상대에게 전가되는 패턴인지 점검하세요.",
        ))

    return signals


def _detect_instability_signals(data: Dict) -> List[RiskSignal]:
    """Detect emotional instability risk patterns."""
    signals = []

    a1 = _v(data, "A1")  # engagement
    a3 = _v(data, "A3")  # assertiveness
    a4 = _v(data, "A4")  # emotional expression
    a6 = _v(data, "A6")  # stability
    a8 = _dom(data, "A8")  # conflict style
    a9 = _dom(data, "A9")  # emotion regulation
    a10 = _dom(data, "A10")  # intimacy trajectory

    # INST-001: High expression + low stability + externalized
    if a4 >= 0.65 and a6 < 0.35 and a9 == "externalized":
        signals.append(RiskSignal(
            signal_id="inst_001",
            category="instability",
            severity="critical",
            name_kr="감정 폭발 위험",
            name_en="Emotional Volatility Risk",
            description_kr=(
                "감정 표현이 강하고 안정성이 낮으며 감정을 외부로 표출하는 조절 방식을 가지고 있습니다. "
                "감정적 상황에서 통제가 어려울 수 있으며, 주변 사람들이 "
                "이 사람의 감정 상태에 강하게 영향을 받을 수 있습니다."
            ),
            axes_involved=["A4", "A6", "A9"],
            confidence=min(1.0, (a4 + (1 - a6)) / 2),
            recommendation_kr="감정적으로 격앙된 상황에서 안전한 거리를 유지할 수 있는지 확인하세요.",
        ))

    # INST-002: Low stability + confrontational + high assertiveness
    if a6 < 0.35 and a8 == "confrontational" and a3 >= 0.65:
        signals.append(RiskSignal(
            signal_id="inst_002",
            category="instability",
            severity="high",
            name_kr="불안정한 공격성",
            name_en="Unstable Aggression",
            description_kr=(
                "감정적 안정성이 낮은 상태에서 대립적 갈등 방식과 높은 자기주장이 결합되어 있습니다. "
                "작은 자극에도 과도하게 반응할 수 있으며, 갈등이 예측 불가능하게 "
                "확대될 위험이 있습니다."
            ),
            axes_involved=["A6", "A8", "A3"],
            confidence=min(1.0, (a3 + (1 - a6)) / 2),
            recommendation_kr="갈등 상황에서 상대방이 안전하다고 느끼는지 확인이 필요합니다.",
        ))

    # INST-003: Surface locked + high engagement = frustration buildup
    if a10 == "surface_locked" and a1 >= 0.65:
        signals.append(RiskSignal(
            signal_id="inst_003",
            category="instability",
            severity="medium",
            name_kr="표면적 관계 고착",
            name_en="Surface-Level Frustration",
            description_kr=(
                "관계에 적극적으로 참여하면서도 깊은 친밀감을 형성하지 못하는 패턴입니다. "
                "시간이 지나면서 상대가 '벽'을 느끼고 좌절할 수 있으며, "
                "이 사람 또한 '왜 깊어지지 않는지' 답답함을 느낄 수 있습니다."
            ),
            axes_involved=["A10", "A1"],
            confidence=0.6,
            recommendation_kr="친밀감 형성의 속도와 깊이에 대한 기대치 조율이 필요합니다.",
        ))

    return signals


def _detect_isolation_signals(data: Dict) -> List[RiskSignal]:
    """Detect isolation and withdrawal risk patterns."""
    signals = []

    a1 = _v(data, "A1")  # engagement
    a2 = _v(data, "A2")  # receptivity
    a5 = _v(data, "A5")  # collaboration
    a8 = _dom(data, "A8")  # conflict style
    a9 = _dom(data, "A9")  # emotion regulation
    a13 = _dom(data, "A13")  # feedback response
    a15 = _dom(data, "A15")  # investment

    # ISO-001: Low engagement + avoidant + suppressive = complete shutdown
    if a1 < 0.3 and a8 == "avoidant" and a9 == "suppressive":
        signals.append(RiskSignal(
            signal_id="iso_001",
            category="instability",
            severity="high",
            name_kr="완전 차단 패턴",
            name_en="Complete Shutdown",
            description_kr=(
                "관여도가 매우 낮고 갈등을 회피하며 감정을 억압합니다. "
                "관계에서 문제가 생겨도 표현하지 않고 갑자기 연락을 끊거나 "
                "관계를 일방적으로 종료할 수 있습니다."
            ),
            axes_involved=["A1", "A8", "A9"],
            confidence=min(1.0, (1 - a1) * 1.5),
            recommendation_kr="불편함을 표현할 수 있는 안전한 소통 채널이 있는지 확인하세요.",
        ))

    # ISO-002: Avoidant feedback + disengaged + low collaboration
    if a13 == "avoidant" and a15 == "disengaged" and a5 < 0.35:
        signals.append(RiskSignal(
            signal_id="iso_002",
            category="instability",
            severity="medium",
            name_kr="관계 이탈 경향",
            name_en="Relationship Disengagement",
            description_kr=(
                "피드백을 회피하고, 관계에 투자하지 않으며, 협력 수준이 낮습니다. "
                "관계를 유지하려는 노력 없이 서서히 멀어질 가능성이 있습니다."
            ),
            axes_involved=["A13", "A15", "A5"],
            confidence=0.6,
            recommendation_kr="관계에 대한 의지가 서로 일치하는지 대화가 필요합니다.",
        ))

    return signals


# ─── Matching Risk Detection ────────────────────────────────────

def detect_matching_risk(
    profile_a: Dict,
    profile_b: Dict,
) -> RiskReport:
    """
    Detect risk signals in a relationship pair.

    Scans for:
    - Power asymmetry
    - Conflict escalation potential
    - Emotional drain patterns
    - Attachment incompatibility

    Returns:
        RiskReport with pair-specific signals
    """
    signals: List[RiskSignal] = []

    # Unwrap 'axes' wrapper
    data_a = profile_a.get("axes", profile_a) if isinstance(profile_a.get("axes"), dict) else profile_a
    data_b = profile_b.get("axes", profile_b) if isinstance(profile_b.get("axes"), dict) else profile_b

    signals.extend(_detect_power_asymmetry(data_a, data_b))
    signals.extend(_detect_conflict_escalation(data_a, data_b))
    signals.extend(_detect_emotional_drain(data_a, data_b))
    signals.extend(_detect_attachment_clash(data_a, data_b))

    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    signals.sort(key=lambda s: severity_order.get(s.severity, 9))

    report = RiskReport(signals=signals)
    report.risk_score = _compute_risk_score(signals)
    report.overall_risk = _score_to_level(report.risk_score)
    report.summary_kr = _generate_matching_summary(report)

    return report


def _detect_power_asymmetry(a: Dict, b: Dict) -> List[RiskSignal]:
    """Detect power imbalance between two profiles."""
    signals = []

    a3_a, a3_b = _v(a, "A3"), _v(b, "A3")  # assertiveness
    a8_a, a8_b = _dom(a, "A8"), _dom(b, "A8")  # conflict
    a11_a, a11_b = _dom(a, "A11"), _dom(b, "A11")  # balance
    a13_a, a13_b = _dom(a, "A13"), _dom(b, "A13")  # feedback

    # ASYM-001: One confrontational high-assertive + other avoidant low-assertive
    if (a3_a >= 0.65 and a8_a == "confrontational" and
        a3_b < 0.35 and a8_b == "avoidant"):
        signals.append(RiskSignal(
            signal_id="asym_001",
            category="asymmetry",
            severity="high",
            name_kr="압도-침묵 역학",
            name_en="Domination-Silence Dynamic",
            description_kr=(
                "한 쪽은 강하게 주장하고 갈등에 정면으로 대응하는 반면, "
                "다른 쪽은 회피하고 말을 삼킵니다. 시간이 지나면 침묵하는 쪽에 "
                "분노가 축적되어 폭발하거나 관계를 갑자기 끝낼 수 있습니다."
            ),
            axes_involved=["A3", "A8"],
            confidence=min(1.0, (a3_a - a3_b)),
            recommendation_kr="갈등 상황에서 양측 모두 의견을 표현할 수 있는 구조를 만드세요.",
        ))
    # Check reverse direction too
    elif (a3_b >= 0.65 and a8_b == "confrontational" and
          a3_a < 0.35 and a8_a == "avoidant"):
        signals.append(RiskSignal(
            signal_id="asym_001",
            category="asymmetry",
            severity="high",
            name_kr="압도-침묵 역학",
            name_en="Domination-Silence Dynamic",
            description_kr=(
                "한 쪽은 강하게 주장하고 갈등에 정면으로 대응하는 반면, "
                "다른 쪽은 회피하고 말을 삼킵니다. 시간이 지나면 침묵하는 쪽에 "
                "분노가 축적되어 폭발하거나 관계를 갑자기 끝낼 수 있습니다."
            ),
            axes_involved=["A3", "A8"],
            confidence=min(1.0, (a3_b - a3_a)),
            recommendation_kr="갈등 상황에서 양측 모두 의견을 표현할 수 있는 구조를 만드세요.",
        ))

    # ASYM-002: Giver-taker imbalance
    if (a11_a == "giver" and a11_b == "taker") or (a11_b == "giver" and a11_a == "taker"):
        sev = "medium"
        # Worse if taker is also defensive to feedback
        taker_fb = a13_b if a11_b == "taker" else a13_a
        if taker_fb == "defensive":
            sev = "high"
        signals.append(RiskSignal(
            signal_id="asym_002",
            category="asymmetry",
            severity=sev,
            name_kr="주고받기 불균형",
            name_en="Give-Take Imbalance",
            description_kr=(
                "한 쪽은 주는 성향, 다른 쪽은 받는 성향이 뚜렷합니다. "
                "단기적으로는 상보적이지만, 장기적으로 주는 쪽이 소진되고 "
                "받는 쪽은 변화할 동기가 줄어들 수 있습니다."
            ),
            axes_involved=["A11", "A13"],
            confidence=0.7,
            recommendation_kr="관계에서의 노력과 보상이 균형을 이루는지 정기적으로 점검하세요.",
        ))

    return signals


def _detect_conflict_escalation(a: Dict, b: Dict) -> List[RiskSignal]:
    """Detect conflict escalation potential between two profiles."""
    signals = []

    a3_a, a3_b = _v(a, "A3"), _v(b, "A3")
    a6_a, a6_b = _v(a, "A6"), _v(b, "A6")
    a8_a, a8_b = _dom(a, "A8"), _dom(b, "A8")

    # ESC-001: Both confrontational + both high assertiveness
    if (a8_a == "confrontational" and a8_b == "confrontational" and
        a3_a >= 0.6 and a3_b >= 0.6):
        avg_stability = (a6_a + a6_b) / 2
        sev = "critical" if avg_stability < 0.4 else "high"
        signals.append(RiskSignal(
            signal_id="esc_001",
            category="instability",
            severity=sev,
            name_kr="상호 격화 위험",
            name_en="Mutual Escalation Risk",
            description_kr=(
                "양쪽 모두 대립적 갈등 방식과 높은 자기주장을 가지고 있습니다. "
                "갈등이 시작되면 서로 물러서지 않아 빠르게 격화될 수 있으며, "
                "사소한 의견 차이가 큰 싸움으로 번질 위험이 있습니다."
            ),
            axes_involved=["A3", "A8", "A6"],
            confidence=min(1.0, (a3_a + a3_b) / 2),
            recommendation_kr="갈등 상황에서 '중단 신호'를 미리 합의해 두세요.",
        ))

    # ESC-002: Low stability on both sides
    if a6_a < 0.35 and a6_b < 0.35:
        signals.append(RiskSignal(
            signal_id="esc_002",
            category="instability",
            severity="medium",
            name_kr="쌍방 불안정",
            name_en="Mutual Instability",
            description_kr=(
                "양쪽 모두 감정적 안정성이 낮습니다. "
                "서로의 불안정이 공명하여 감정적 기복이 증폭될 수 있으며, "
                "안정적인 관계 기반을 구축하기 어려울 수 있습니다."
            ),
            axes_involved=["A6"],
            confidence=min(1.0, (1 - a6_a + 1 - a6_b) / 2),
            recommendation_kr="감정적으로 힘든 시기에 서로에게 의지하기보다 외부 지지체계를 활용하세요.",
        ))

    return signals


def _detect_emotional_drain(a: Dict, b: Dict) -> List[RiskSignal]:
    """Detect emotional drain patterns in a pair."""
    signals = []

    a1_a, a1_b = _v(a, "A1"), _v(b, "A1")
    a5_a, a5_b = _v(a, "A5"), _v(b, "A5")
    a9_a, a9_b = _dom(a, "A9"), _dom(b, "A9")
    a15_a, a15_b = _dom(a, "A15"), _dom(b, "A15")

    # DRAIN-001: One externalized + other suppressive = emotional dump
    if ((a9_a == "externalized" and a9_b == "suppressive") or
        (a9_b == "externalized" and a9_a == "suppressive")):
        signals.append(RiskSignal(
            signal_id="drain_001",
            category="exploitation",
            severity="high",
            name_kr="감정 투기장 역학",
            name_en="Emotional Dumping Dynamic",
            description_kr=(
                "한 쪽은 감정을 외부로 쏟아내고, 다른 쪽은 감정을 억압합니다. "
                "표출하는 쪽은 해소감을 얻지만, 억압하는 쪽은 지속적으로 감정적 "
                "부담을 흡수하게 됩니다. 시간이 지나면 심각한 소진이 올 수 있습니다."
            ),
            axes_involved=["A9"],
            confidence=0.75,
            recommendation_kr="감정 표현의 방향이 일방적이지 않은지 점검하세요.",
        ))

    # DRAIN-002: One active investor + other disengaged
    if ((a15_a == "active_investor" and a15_b == "disengaged") or
        (a15_b == "active_investor" and a15_a == "disengaged")):
        signals.append(RiskSignal(
            signal_id="drain_002",
            category="asymmetry",
            severity="medium",
            name_kr="투자 불균형",
            name_en="Investment Imbalance",
            description_kr=(
                "한 쪽은 관계에 적극적으로 투자하고, 다른 쪽은 이탈 상태입니다. "
                "투자하는 쪽이 지속적으로 끌어당기다가 지쳐서 포기하는 패턴이 "
                "반복될 수 있습니다."
            ),
            axes_involved=["A15"],
            confidence=0.7,
            recommendation_kr="관계에 대한 기대치와 참여 수준을 솔직하게 대화하세요.",
        ))

    return signals


def _detect_attachment_clash(a: Dict, b: Dict) -> List[RiskSignal]:
    """Detect attachment style incompatibility."""
    signals = []

    a10_a, a10_b = _dom(a, "A10"), _dom(b, "A10")
    a1_a, a1_b = _v(a, "A1"), _v(b, "A1")

    # ATT-001: Fast opener + slow burn = pace mismatch
    if ((a10_a == "fast_opener" and a10_b == "slow_burn") or
        (a10_b == "fast_opener" and a10_a == "slow_burn")):
        signals.append(RiskSignal(
            signal_id="att_001",
            category="asymmetry",
            severity="medium",
            name_kr="친밀감 속도 충돌",
            name_en="Intimacy Pace Mismatch",
            description_kr=(
                "한 쪽은 빠르게 가까워지고 싶고, 다른 쪽은 천천히 신뢰를 쌓아가길 원합니다. "
                "빠른 쪽은 '왜 안 열어?' 하고, 느린 쪽은 '왜 이렇게 밀어?' 라고 느끼는 "
                "추격-도주 패턴이 생길 수 있습니다."
            ),
            axes_involved=["A10"],
            confidence=0.65,
            recommendation_kr="친밀감 형성의 속도를 서로 맞춰가는 대화가 필요합니다.",
        ))

    # ATT-002: Surface locked + depth seeker = frustration
    if ((a10_a == "surface_locked" and a10_b == "depth_seeker") or
        (a10_b == "surface_locked" and a10_a == "depth_seeker")):
        signals.append(RiskSignal(
            signal_id="att_002",
            category="asymmetry",
            severity="high",
            name_kr="깊이 불일치",
            name_en="Depth Incompatibility",
            description_kr=(
                "한 쪽은 깊은 연결을 추구하지만, 다른 쪽은 표면적 관계에 머물러 있습니다. "
                "깊이를 원하는 쪽은 좌절감을, 표면에 머무는 쪽은 부담감을 "
                "느낄 수 있어 장기적으로 불만족이 커질 수 있습니다."
            ),
            axes_involved=["A10"],
            confidence=0.75,
            recommendation_kr="관계의 깊이에 대한 기대치를 솔직하게 공유하세요.",
        ))

    return signals


# ─── Scoring & Summary ──────────────────────────────────────────

_SEVERITY_WEIGHTS = {
    "critical": 30,
    "high": 20,
    "medium": 10,
    "low": 5,
}


def _compute_risk_score(signals: List[RiskSignal]) -> int:
    """Compute aggregate risk score (0-100)."""
    if not signals:
        return 0
    total = sum(
        _SEVERITY_WEIGHTS.get(s.severity, 0) * s.confidence
        for s in signals
    )
    return min(100, int(total))


def _score_to_level(score: int) -> str:
    """Convert risk score to human-readable level."""
    if score >= 60:
        return "high"
    elif score >= 40:
        return "elevated"
    elif score >= 20:
        return "moderate"
    elif score > 0:
        return "low"
    return "none"


def _generate_individual_summary(report: RiskReport) -> str:
    """Generate Korean summary for individual risk report."""
    if not report.signals:
        return "특별한 위험 신호가 감지되지 않았습니다."

    categories = set(s.category for s in report.signals)
    cat_names = {
        "control": "통제",
        "exploitation": "감정 활용",
        "instability": "불안정",
        "asymmetry": "비대칭",
    }
    cat_str = ", ".join(cat_names.get(c, c) for c in sorted(categories))

    if report.has_critical:
        return f"주의가 필요한 패턴이 감지되었습니다. {cat_str} 영역에서 신호가 발견되었습니다."
    elif report.overall_risk in ("elevated", "high"):
        return f"{cat_str} 영역에서 관찰이 필요한 패턴이 있습니다."
    else:
        return f"경미한 주의 신호가 {cat_str} 영역에서 감지되었습니다."


def _generate_matching_summary(report: RiskReport) -> str:
    """Generate Korean summary for matching risk report."""
    if not report.signals:
        return "이 관계에서 특별한 위험 신호가 감지되지 않았습니다."

    n = len(report.signals)
    if report.has_critical:
        return f"이 관계에서 {n}개의 주의 신호가 감지되었으며, 특히 심각한 패턴이 포함되어 있습니다."
    elif report.overall_risk in ("elevated", "high"):
        return f"이 관계에서 {n}개의 주의 신호가 감지되었습니다. 장기적 관계에서 갈등 요인이 될 수 있습니다."
    else:
        return f"이 관계에서 {n}개의 경미한 주의 신호가 있습니다."
