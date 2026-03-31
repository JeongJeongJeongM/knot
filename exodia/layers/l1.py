"""
EXODIA L1 — Labeling (라벨링).
LLM 기반 라벨링. PART 6 §4.2 + Appendix H + PART 12.
EXODIA에서 유일하게 LLM을 호출하는 레이어.
"""
import hashlib
import json
import time
from abc import ABC, abstractmethod
from typing import Optional

from exodia.config import (
    ALLOWED_CONFIDENCE_BUCKETS,
    ALLOWED_LABEL_ID_SET_FULL,
    CONFIDENCE_UNKNOWN_THRESHOLD,
    EVIDENCE_SPAN_MAX_CHARS,
    L1_MODEL_ID,
    LABEL_ID_TO_NAME,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_TOP_P,
    SECONDARY_WHITELIST,
)
from exodia.schemas import L0Output, L1Output, MentionFlags

# ═══════════════════════════════════════════════════════════════
# Appendix H: L1 시스템 프롬프트 완전본 (LOCKED)
# ═══════════════════════════════════════════════════════════════

L1_SYSTEM_PROMPT = r"""You are EXODIA L1, a deterministic utterance classifier for human conversation analysis.

Classify ONE input turn into a structured output. Do NOT interpret intent, emotion depth, personality, or hidden meaning.

## OUTPUT FORMAT

Respond with ONLY a JSON object. No explanation, no markdown, no preamble.

{"p":INT,"s":INT_OR_NULL,"c":FLOAT,"e":"STRING","d":"STRING","v":INT}

Keys:
- p: primary label ID (required, from LABEL CATALOG)
- s: secondary label ID (null if not in WHITELIST)
- c: confidence bucket --- 1.0 | 0.8 | 0.6
- e: evidence span --- exact substring from input, max 24 chars (do not paraphrase)
- d: direction --- "SELF" | "OTHER" | "NEUTRAL"
- v: value declaration --- 0 or 1

## CONFIDENCE RULES
- 1.0: Forced UNKNOWN, or explicit unambiguous keyword match
- 0.8: Clear rule-based determination, minimal inference
- 0.6: Requires inference, borderline, weak evidence
- Below 0.5 certainty: Force UNKNOWN (p=0, c=1.0)

## DIRECTION RULES
- SELF: about speaker's own state/action/value/plan
- OTHER: directed at interlocutor or about them
- NEUTRAL: meta/ambient/no clear target
- When ambiguous, default to NEUTRAL.

## VALUE DECLARATION (v)
Set v=1 ONLY if the turn explicitly declares values, beliefs, principles, moral stance, or ideology.
Preferences and predictions are v=0. Procedural instructions are v=0.

## FORCED UNKNOWN (p=0, c=1.0)
- Single emoji/symbol only
- 1-2 characters with no clear meaning
- Code snippets, logs, URLs only
- Empty or whitespace-only

## PRIORITY ORDER (highest priority first)
1. Forced UNKNOWN (above rules)
2. H: Repair/Correction (240-246)
3. A: Meta (100-108)
4. C: Question (140-147)
5. D: Request (160-169)
6. F: Agreement (200-207)
7. K: Relationship/Work (300-309)
8. E: Suggestion (180-185)
9. I: Interaction/Power (260-269)
10. G: Emotion/Attitude (220-227)
11. B: Greeting (120-128)
12. UNKNOWN (fallback)

## LABEL CATALOG (86 labels)

### A: Meta (100-108)
100 META_CLARIFY --- Asks for clarification
101 META_REPHRASE --- Requests rewording
102 META_SUMMARY --- Requests summary
103 META_DETAIL --- Requests elaboration
104 META_EXAMPLE --- Requests example
105 META_CONSTRAINT_ADD --- Adds constraint
106 META_CONSTRAINT_REMOVE --- Removes constraint
107 META_TOPIC_CHANGE --- Changes topic
108 META_TOPIC_RETURN --- Returns to previous topic

### B: Greeting (120-128)
120 GREET_OPEN --- Opening greeting
121 GREET_CLOSE --- Closing goodbye
122 THANKS --- Thanking
123 THANKS_RESPONSE --- Response to thanks
124 APOLOGY_SOCIAL --- Social apology
125 APOLOGY_RESPONSE --- Response to apology
126 COMPLIMENT --- Complimenting
127 PRAISE --- Acknowledging achievement
128 WELL_WISH --- Well-wishing

### C: Question (140-147)
140 QUESTION_FACT --- Factual question (when/where/who/how much)
141 QUESTION_HOW --- Method/process question
142 QUESTION_WHY --- Reason question
143 QUESTION_WHICH --- Choice question
144 CONFIRM_YN --- Yes/no confirmation
145 CHECK_UNDERSTANDING --- Comprehension check
146 ELICIT_OPINION --- Asks opinion
147 ASK_RECOMMENDATION --- Asks recommendation

### D: Request (160-169)
160 REQUEST_ACTION --- Requests action
161 REQUEST_INFO --- Requests information
162 REQUEST_PERMISSION --- Asks permission
163 REQUEST_WAIT --- Asks to wait
164 REQUEST_REPEAT --- Asks to repeat
165 REQUEST_CONFIRM --- Asks confirmation
166 REQUEST_HELP --- Asks for help
167 REQUEST_STOP --- Asks to stop
168 REQUEST_CHANGE --- Asks for modification
169 REQUEST_SCHEDULE --- Schedule/time request

### E: Suggestion (180-185)
180 SUGGESTION --- Proposes action/idea
181 ALTERNATIVE --- Offers alternative
182 RISK_POINT --- Points out risk
183 MITIGATION --- Proposes risk mitigation
184 ASSUMPTION_DECLARE --- Declares assumption
185 CONSTRAINT_DECLARE --- Declares constraint

### F: Agreement (200-207)
200 AGREE --- Agrees
201 DISAGREE --- Disagrees
202 PARTIAL_AGREE --- Partially agrees
203 ACKNOWLEDGE --- Acknowledges receipt
204 REJECT_PROPOSAL --- Rejects proposal
205 COMMIT --- Commits/promises
206 DEFER --- Defers decision
207 CONDITIONAL_AGREE --- Conditional agreement

### G: Emotion (220-227)
220 EXPRESS_POSITIVE --- Positive emotion
221 EXPRESS_NEGATIVE --- Negative emotion
222 EXPRESS_HOSTILE --- Hostile expression
223 EXPRESS_CONCERN --- Worry/concern
224 COMPLAIN --- Complaint
225 EXPRESS_DISTRESS --- Distress
226 LAUGHTER_MARKER --- Laughter
227 SWEAR_PROFANITY --- Profanity

### H: Repair (240-246)
240 SELF_REPAIR --- Self-correction
241 OTHER_REPAIR --- Corrects other
242 CLARIFICATION_OFFER --- Offers clarification
243 MISUNDERSTANDING_FLAG --- Flags misunderstanding
244 CONTEXT_CORRECTION --- Corrects context
245 RETRACTION --- Retracts statement
246 ELABORATION --- Elaborates on previous

### I: Power (260-269)
260 DIRECTIVE_STRONG --- Strong directive
261 DIRECTIVE_SOFT --- Soft directive
262 PERMISSION_GRANT --- Grants permission
263 BOUNDARY_SET --- Sets boundary
264 CONCESSION --- Concedes
265 REFUSAL --- Refuses
266 CHALLENGE --- Challenges/demands justification
267 DEFLECTION --- Deflects
268 COMPLIANCE_SIGNAL --- Shows compliance
269 ESCALATION --- Escalates intensity

### K: Relationship (300-309)
300 INTEREST_SIGNAL --- Shows interest
301 DISINTEREST_SIGNAL --- Shows disinterest
302 SMALL_TALK --- Light conversation
303 SHARE_PERSONAL --- Self-disclosure
304 EMPATHY --- Empathic response
305 FEEDBACK_POSITIVE --- Positive feedback
306 FEEDBACK_NEGATIVE --- Negative feedback
307 TASK_ASSIGN --- Assigns task
308 STATUS_UPDATE --- Reports status
309 AVAILABILITY_CHECK --- Checks availability

### 0: UNKNOWN
0 UNKNOWN --- Cannot classify or forced unknown

## KOREAN RULES
- ㅇㅇ / ㅇㅋ / ㄱㄱ → AGREE (200), c=0.8
- ㄴㄴ / ㄴ → DISAGREE (201), c=0.8
- ㅋㅋ+ (standalone) → LAUGHTER_MARKER (226), c=0.8
- ㅠㅠ+ / ㅜㅜ+ (standalone) → EXPRESS_DISTRESS (225), c=0.8
- ㅅㅂ / ㅁㅊ / ㅂㅅ / ㅈㄹ → SWEAR_PROFANITY (227), c=0.8
- Discourse markers (아니/근데/그니까/음...) → IGNORE, label substantive content

## SECONDARY LABEL WHITELIST
Only these pairs allowed. All others: s=null.
- 160 → [260, 261]
- 161 → [260, 261]
- 307 → [260, 261]
- 200 → [304]
- 201 → [182]
- 202 → [181]
- 300 → [302]
- 303 → [304]
- 140 → [146]
- 220 → [304]

## CONFUSION PAIRS (apply strictly)

CP-01: REQUEST_ACTION(160) vs DIRECTIVE_SOFT(261)
- Direct request with 해줘/해주세요/가능해? → 160
- Guidance as suggestion ~하면 돼요/이렇게 하세요 → 261

CP-02: EMPATHY(304) vs SHARE_PERSONAL(303)
- Reflecting OTHER's feelings 힘들었겠다/속상했겠다 → 304
- Revealing OWN state/story → 303

CP-03: AGREE(200) vs ACKNOWLEDGE(203)
- Agreement with content 맞아/그치/동의 → 200
- Receipt confirmation 알겠어/확인/ㅇ without opinion → 203

CP-04: AGREE(200) vs COMMIT(205)
- General agreement 맞아/ㅇㅇ → 200
- Promise of future action 할게/약속할게 → 205

CP-05: QUESTION_FACT(140) vs CONFIRM_YN(144)
- Seeking new info 언제야?/몇 개야? → 140
- Verifying known info 맞아?/진짜? → 144

CP-06: COMPLAIN(224) vs EXPRESS_HOSTILE(222)
- Frustration about situation 왜 이래/짜증나게 → 224
- Hostility at person 꺼져/닥쳐 → 222

CP-07: FEEDBACK_NEGATIVE(306) vs DISAGREE(201)
- Evaluating quality 별로야/아쉽다 → 306
- Opposing claim 아니야/그건 아닌데 → 201

CP-08: DIRECTIVE_STRONG(260) vs REQUEST_ACTION(160)
- Imperative without softening 해/하세요 → 260
- Request with politeness 해줄 수 있어?/부탁인데 → 160

CP-09: SUGGESTION(180) vs ALTERNATIVE(181)
- First proposal ~하면 어때? → 180
- Counter-proposal 대신 ~/아니면 ~는? → 181

CP-10: CONCESSION(264) vs AGREE(200)
- Yielding reluctantly 알겠어 네 말대로 → 264
- Genuine agreement 맞아/나도 그렇게 생각해 → 200

CP-11: BOUNDARY_SET(263) vs REFUSAL(265)
- Setting ongoing limit 그건 안 돼/선 넘지 마 → 263
- One-time refusal 싫어/안 해 → 265

CP-12: EXPRESS_DISTRESS(225) vs COMPLAIN(224)
- Internal suffering 힘들어/못하겠어/ㅠㅠ → 225
- External frustration 왜 이래/짜증나게 → 224

CP-13: META_CLARIFY(100) vs QUESTION_FACT(140)
- About conversation itself 무슨 뜻이야? → 100
- About external facts 언제야?/어디서? → 140

CP-14: INTEREST_SIGNAL(300) vs EXPRESS_POSITIVE(220)
- Wanting to hear more 오 재밌다/더 얘기해봐 → 300
- General positive emotion 좋다/기쁘다 → 220

CP-15: CHALLENGE(266) vs QUESTION_WHY(142)
- Confrontational 증거 있어?/근거가 뭔데? → 266
- Genuine curiosity 왜?/이유가 뭐야? → 142"""


def _compute_prompt_hash() -> str:
    """시스템 프롬프트의 SHA-256 해시 계산."""
    return hashlib.sha256(L1_SYSTEM_PROMPT.encode('utf-8')).hexdigest()


L1_PROMPT_HASH_COMPUTED: str = _compute_prompt_hash()


# ═══════════════════════════════════════════════════════════════
# LLM Provider 추상화
# ═══════════════════════════════════════════════════════════════

class LLMProvider(ABC):
    """LLM 프로바이더 추상 인터페이스."""

    @abstractmethod
    def call(self, system_prompt: str, user_message: str,
             temperature: float, max_tokens: int, top_p: float) -> str:
        """LLM 호출. JSON 문자열 반환."""
        ...


class MockProvider(LLMProvider):
    """테스트용 고정 응답 프로바이더."""

    def __init__(self, fixed_response: dict | None = None):
        self._fixed = fixed_response or {
            "p": 0, "s": None, "c": 1.0,
            "e": "", "d": "NEUTRAL", "v": 0
        }

    def call(self, system_prompt: str, user_message: str,
             temperature: float, max_tokens: int, top_p: float) -> str:
        return json.dumps(self._fixed)


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API 프로바이더."""

    def __init__(self, api_key: str, model_id: str = L1_MODEL_ID):
        self._api_key = api_key
        self._model_id = model_id

    def call(self, system_prompt: str, user_message: str,
             temperature: float, max_tokens: int, top_p: float) -> str:
        try:
            import anthropic
            client = anthropic.Anthropic(api_key=self._api_key)
            response = client.messages.create(
                model=self._model_id,
                temperature=temperature,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[{"role": "user", "content": user_message}],
            )
            return response.content[0].text
        except Exception as e:
            raise RuntimeError(f"Anthropic API error: {e}") from e


# ═══════════════════════════════════════════════════════════════
# L1 응답 파싱 + 검증
# ═══════════════════════════════════════════════════════════════

def _truncate_evidence(span: str) -> str:
    """evidence_span 길이 제한. — PART 12, P-03"""
    if len(span) <= EVIDENCE_SPAN_MAX_CHARS:
        return span
    # 중앙 우선 잘라내기: 앞 12자 + "..." + 뒤 11자
    return span[:12] + "..." + span[-11:]


def _snap_confidence(raw_c: float) -> float:
    """confidence를 허용 버킷으로 내림. — Appendix H + PART 6 §4.2"""
    if raw_c < CONFIDENCE_UNKNOWN_THRESHOLD:
        return -1.0  # UNKNOWN 강제 시그널
    # 가장 가까운 하위 버킷으로 내림
    for bucket in ALLOWED_CONFIDENCE_BUCKETS:
        if raw_c >= bucket:
            return bucket
    return -1.0  # 모든 버킷보다 작음 → UNKNOWN


def _validate_secondary(primary_id: int, secondary_id: Optional[int]) -> Optional[int]:
    """secondary_id 화이트리스트 검증. — Appendix H"""
    if secondary_id is None:
        return None
    allowed = SECONDARY_WHITELIST.get(primary_id, [])
    if secondary_id in allowed:
        return secondary_id
    return None


def _make_unknown_output(turn_id: str, input_hash: str, model_id: str,
                         prompt_hash: str) -> L1Output:
    """UNKNOWN 강제 반환."""
    return L1Output(
        turn_id=turn_id,
        primary_id=0,
        primary_label="UNKNOWN",
        secondary_id=None,
        secondary_label=None,
        confidence=1.0,
        evidence_span="",
        direction="neutral",
        mention_flags=MentionFlags(),
        input_hash=input_hash,
        model_id=model_id,
        prompt_hash=prompt_hash,
    )


def parse_l1_response(raw_json: str, turn_id: str,
                       input_hash: str, model_id: str,
                       prompt_hash: str) -> L1Output:
    """LLM 응답 JSON 파싱 + 검증. — PART 6 §4.2, PART 11 F-01"""
    try:
        data = json.loads(raw_json)
    except (json.JSONDecodeError, TypeError):
        return _make_unknown_output(turn_id, input_hash, model_id, prompt_hash)

    # primary_id 검증
    primary_id = data.get('p', 0)
    if not isinstance(primary_id, int) or primary_id not in ALLOWED_LABEL_ID_SET_FULL:
        return _make_unknown_output(turn_id, input_hash, model_id, prompt_hash)

    # confidence 스냅
    raw_c = data.get('c', 0.0)
    if not isinstance(raw_c, (int, float)):
        raw_c = 0.0
    confidence = _snap_confidence(float(raw_c))
    if confidence < 0:
        # UNKNOWN 강제 (confidence < 0.5)
        return _make_unknown_output(turn_id, input_hash, model_id, prompt_hash)

    # secondary_id 검증
    secondary_id = data.get('s')
    if secondary_id is not None:
        if not isinstance(secondary_id, int):
            secondary_id = None
        else:
            secondary_id = _validate_secondary(primary_id, secondary_id)

    # evidence_span 처리
    evidence_span = str(data.get('e', ''))
    evidence_span = _truncate_evidence(evidence_span)

    # direction (canonical: lowercase self/other/neutral)
    direction_raw = str(data.get('d', 'neutral')).upper()
    if direction_raw not in ('SELF', 'OTHER', 'NEUTRAL'):
        direction_raw = 'NEUTRAL'
    direction_raw = direction_raw.lower()

    # value_declaration
    v = data.get('v', 0)
    if v not in (0, 1):
        v = 0

    # 라벨 이름 매핑
    primary_label = LABEL_ID_TO_NAME.get(primary_id, "UNKNOWN")
    secondary_label = LABEL_ID_TO_NAME.get(secondary_id) if secondary_id else None

    return L1Output(
        turn_id=turn_id,
        primary_id=primary_id,
        primary_label=primary_label,
        secondary_id=secondary_id,
        secondary_label=secondary_label,
        confidence=confidence,
        evidence_span=evidence_span,
        direction=direction_raw,  # already lowercase
        mention_flags=MentionFlags(VALUE_DECLARATION=v),
        input_hash=input_hash,
        model_id=model_id,
        prompt_hash=prompt_hash,
    )


# ═══════════════════════════════════════════════════════════════
# L1 Processor
# ═══════════════════════════════════════════════════════════════

class L1Processor:
    """L1 라벨링 프로세서.

    캐싱: input_hash → dict 캐시 (MVP 인메모리).
    """

    def __init__(self, provider: LLMProvider, model_id: str = L1_MODEL_ID):
        self._provider = provider
        self._model_id = model_id
        self._prompt_hash = L1_PROMPT_HASH_COMPUTED
        self._cache: dict[str, L1Output] = {}

    def _compute_input_hash(self, normalized_text: str) -> str:
        """입력 해시 계산. — PART 6 §4.2.1"""
        content = f"{self._model_id}:{self._prompt_hash}:{normalized_text}"
        return hashlib.sha256(content.encode('utf-8')).hexdigest()

    def _format_input(self, l0_output: L0Output) -> str:
        """L1 입력 포맷."""
        parts = [l0_output.normalized_text]
        if l0_output.span_hints:
            hints_str = ", ".join(
                f"{h.hint_type}:{h.matched_text}" for h in l0_output.span_hints
            )
            parts.append(f"[hints: {hints_str}]")
        if l0_output.surface_features:
            sf = l0_output.surface_features
            features = []
            if sf.ko_honorific_ending:
                features.append("honorific")
            if sf.ko_casual_ending:
                features.append("casual")
            if sf.ko_profanity_present:
                features.append("profanity")
            if sf.is_very_short:
                features.append("very_short")
            if features:
                parts.append(f"[features: {', '.join(features)}]")
        return "\n".join(parts)

    def process(self, l0_output: L0Output) -> L1Output:
        """단일 턴 L1 처리.

        캐시 확인 → LLM 호출 → 파싱 → 검증 → 반환.
        에러 시 UNKNOWN 반환 (PART 6 §4.2.3).
        """
        input_hash = self._compute_input_hash(l0_output.normalized_text)

        # 캐시 확인 (MVP 인메모리)
        if input_hash in self._cache:
            return self._cache[input_hash]

        # 빈 텍스트 → UNKNOWN
        if l0_output.is_empty_after_norm:
            result = _make_unknown_output(
                l0_output.turn_id, input_hash,
                self._model_id, self._prompt_hash
            )
            self._cache[input_hash] = result
            return result

        # LLM 호출 (최대 2회 시도: 1회 정상 + 1회 재시도)
        user_message = self._format_input(l0_output)
        max_attempts = 2
        for attempt in range(max_attempts):
            try:
                raw_response = self._provider.call(
                    system_prompt=L1_SYSTEM_PROMPT,
                    user_message=user_message,
                    temperature=LLM_TEMPERATURE,
                    max_tokens=LLM_MAX_TOKENS,
                    top_p=LLM_TOP_P,
                )
                result = parse_l1_response(
                    raw_response, l0_output.turn_id,
                    input_hash, self._model_id, self._prompt_hash
                )
                self._cache[input_hash] = result
                return result
            except Exception:
                if attempt == max_attempts - 1:
                    result = _make_unknown_output(
                        l0_output.turn_id, input_hash,
                        self._model_id, self._prompt_hash
                    )
                    self._cache[input_hash] = result
                    return result
                time.sleep(1)  # 재시도 전 대기

        # Fallback (도달하지 않음)
        result = _make_unknown_output(
            l0_output.turn_id, input_hash,
            self._model_id, self._prompt_hash
        )
        self._cache[input_hash] = result
        return result

    def run_golden_set_eval(self, golden_set: list[dict]) -> dict:
        """Golden Set 평가. — PART 12 P-01~P-07

        Args:
            golden_set: [{"input": str, "expected_primary_id": int}, ...]
        Returns:
            {"macro_f1": float, "drift_rate": float, "per_label_f1": dict}
        """
        if not golden_set:
            return {"macro_f1": 0.0, "drift_rate": 0.0, "per_label_f1": {}}

        from collections import defaultdict
        from exodia.layers.l0 import L0Processor

        l0 = L0Processor()
        tp = defaultdict(int)
        fp = defaultdict(int)
        fn = defaultdict(int)
        drift_count = 0

        for item in golden_set:
            l0_out = l0.process(turn_id="eval", raw_text=item["input"])
            l1_out = self.process(l0_out)
            predicted = l1_out.primary_id
            expected = item["expected_primary_id"]

            if predicted == expected:
                tp[expected] += 1
            else:
                fp[predicted] += 1
                fn[expected] += 1
                drift_count += 1

        # Per-label F1
        per_label_f1 = {}
        all_labels = set(tp) | set(fp) | set(fn)
        for lid in sorted(all_labels):
            p = tp[lid] / (tp[lid] + fp[lid]) if (tp[lid] + fp[lid]) else 0.0
            r = tp[lid] / (tp[lid] + fn[lid]) if (tp[lid] + fn[lid]) else 0.0
            f1 = (2 * p * r / (p + r)) if (p + r) else 0.0
            per_label_f1[lid] = round(f1, 4)

        f1_vals = list(per_label_f1.values())
        macro_f1 = sum(f1_vals) / len(f1_vals) if f1_vals else 0.0

        return {
            "macro_f1": round(macro_f1, 4),
            "drift_rate": round(drift_count / len(golden_set), 4),
            "per_label_f1": per_label_f1,
        }
