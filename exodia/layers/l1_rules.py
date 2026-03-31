"""
EXODIA L1 — Rule-Based Korean Classifier (LLM Fallback).

LLM 없이 한국어 대화 턴을 규칙 기반으로 분류.
MockProvider 대체용. 정확도는 LLM보다 낮지만 차별화된 라벨을 생성.
"""
import json
import re
from exodia.layers.l1 import LLMProvider


# ═══════════ Pattern definitions ═══════════

# Shorthand patterns (highest priority after UNKNOWN)
_AGREE_SHORT = re.compile(r'^(ㅇㅇ|ㅇㅋ|ㄱㄱ|ㅇ{2,}|웅|응|넹|넵|네|그래|맞아|맞지|그치|당연|ㄹㅇ|인정)$')
_DISAGREE_SHORT = re.compile(r'^(ㄴㄴ|ㄴ|아니|아닌데|아냐|노노)$')
_LAUGH_ONLY = re.compile(r'^[ㅋㅎ]{2,}$')
_CRY_ONLY = re.compile(r'^[ㅠㅜ]{2,}$')
_PROFANITY = re.compile(r'(시발|씨발|ㅅㅂ|ㅁㅊ|ㅂㅅ|ㅈㄹ|ㅆㅂ|개새|존나|좆)')

# Question patterns
_QUESTION_MARK = re.compile(r'\?')
_QUESTION_WORDS = re.compile(r'(뭐|뭔|무슨|어디|언제|얼마|몇|누구|왜|어때|어떻게|할까|갈까|볼까|먹을까)')
_CONFIRM_YN = re.compile(r'(맞아\?|맞지\?|진짜\?|그래\?|그런가\?|알지\?|있어\?|괜찮아\?|했어\?|봤어\?)')

# Emotion patterns
_POS_EMOTION = re.compile(r'(좋아|좋다|기쁘|뿌듯|행복|신나|최고|대박|와|오)')
_NEG_EMOTION = re.compile(r'(짜증|힘들|싫|슬프|우울|지치|답답|속상|서운|걱정)')
_DISTRESS = re.compile(r'(힘들어|못하겠|죽겠|미치겠|ㅠ{2,}|ㅜ{2,})')
_HOSTILE = re.compile(r'(꺼져|닥쳐|죽어|미친놈|미친년)')
_COMPLAIN = re.compile(r'(짜증나|귀찮|왜이래|왜 이래|짜증)')

# Sharing / personal disclosure
_SHARE = re.compile(r'(나|내가|저는|제가).{0,10}(했|있었|됐|갔|먹었|봤|만났|받았|샀|쏘고|주고|할게|줄게|골라)')
_SHARE_FEELING = re.compile(r'(나|내가|저).{0,8}(좋아|싫어|힘들|걱정|뿌듯|속상|서운|쏘고 싶|하고 싶|듣고 싶)')
_SHARE_SELF = re.compile(r'(나\s?원래|내\s?성격|나\s?진짜|나\s?솔직히|내가\s?원래)')

# Interest / engagement
_INTEREST = re.compile(r'(오\s|와\s|와!|와\?|대박|재밌|궁금|더\s?얘기|알려줘|듣고\s?싶|축하|잘\s?됐)')

# Praise / congratulation (subset of FEEDBACK_POS)
_PRAISE = re.compile(r'(축하|잘했|대단|수고|멋지|최고)')

# Feedback negative
_FEEDBACK_NEG = re.compile(r'(항상\s?그런|맨날\s?그래|왜\s?그래|좀\s?그렇|별로|아쉽)')

# Empathy — includes caring questions and "겠다" (inferring other's feeling)
_EMPATHY = re.compile(r'(힘들겠|속상했겠|걱정되|괜찮아\?|무슨\s?일이?야|어떡해|고생|수고|말해도\s?되|여기\s?있|힘들면\s?말해|듣고\s?싶)')
_EMPATHY_INFER = re.compile(r'(겠다|겠네|겠지|힘들겠|좋겠|슬프겠|외롭겠)')  # inferring feeling

# Suggestion
_SUGGEST = re.compile(r'(하자|갈까|해볼까|어때|가자|먹자|보자|할까|같이)')

# Feedback positive
_FEEDBACK_POS = re.compile(r'(잘했|대단|멋지|천재|최고|굿|잘\s?한다|잘\s?하네)')

# Greeting
_GREET_OPEN = re.compile(r'^(안녕|하이|헬로|ㅎㅇ|반가)')
_GREET_CLOSE = re.compile(r'(잘\s?가|안녕|바이|ㅂㅂ|내일\s?봐)')
_THANKS = re.compile(r'(고마워|감사|ㄳ|고맙)')

# Request
_REQUEST = re.compile(r'(해줘|해주세요|부탁|가능해\?|해줄\s?수)')

# Boundary / deflection
_BOUNDARY = re.compile(r'(안\s?돼|선\s?넘|하지\s?마)')
_DEFLECTION = re.compile(r'(뭐\s?별거|그냥|몰라|모르겠|신경\s?끄|상관\s?없)')

# Status update
_STATUS = re.compile(r'(했어|끝났|완료|다\s?됐|되긴\s?했)')

# Availability
_AVAILABILITY = re.compile(r'(시간\s?있|괜찮|가능|될까|되나)')

# Exclamation intensity (!! or more)
_EXCLAIM = re.compile(r'!{2,}')


def _classify_korean(text: str) -> dict:
    """Classify a single Korean text turn using rule-based patterns.

    Returns dict matching L1 JSON output format:
    {"p": int, "s": int|None, "c": float, "e": str, "d": str, "v": 0}
    """
    t = text.strip()

    # Forced UNKNOWN: too short or empty
    if len(t) <= 1:
        return {"p": 0, "s": None, "c": 1.0, "e": "", "d": "NEUTRAL", "v": 0}

    # === Shorthand patterns (highest priority) ===
    if _LAUGH_ONLY.match(t):
        return {"p": 226, "s": None, "c": 0.8, "e": t[:24], "d": "NEUTRAL", "v": 0}
    if _CRY_ONLY.match(t):
        return {"p": 225, "s": None, "c": 0.8, "e": t[:24], "d": "SELF", "v": 0}
    if _AGREE_SHORT.match(t):
        return {"p": 200, "s": None, "c": 0.8, "e": t[:24], "d": "NEUTRAL", "v": 0}
    if _DISAGREE_SHORT.match(t):
        return {"p": 201, "s": None, "c": 0.8, "e": t[:24], "d": "NEUTRAL", "v": 0}
    if _PROFANITY.search(t):
        return {"p": 227, "s": None, "c": 0.8, "e": t[:24], "d": "NEUTRAL", "v": 0}

    # === Multi-pattern scoring ===
    # Score each category and pick the best match
    scores: dict[int, float] = {}
    evidence: dict[int, str] = {}
    direction: dict[int, str] = {}

    def _add(label_id: int, score: float, ev: str, d: str = "NEUTRAL"):
        scores[label_id] = scores.get(label_id, 0) + score
        if label_id not in evidence:
            evidence[label_id] = ev[:24]
            direction[label_id] = d

    # Greeting
    if _GREET_OPEN.search(t):
        _add(120, 2.0, t, "OTHER")
    if _THANKS.search(t):
        _add(122, 2.0, t, "OTHER")

    # Questions (high priority)
    if _QUESTION_MARK.search(t):
        if _CONFIRM_YN.search(t):
            _add(144, 2.5, t, "OTHER")
        elif _QUESTION_WORDS.search(t):
            _add(140, 2.5, t, "OTHER")
        else:
            _add(140, 1.5, t, "OTHER")
    elif _QUESTION_WORDS.search(t) and not _SUGGEST.search(t):
        _add(140, 1.0, t, "OTHER")

    # Empathy (before emotion — higher priority per spec)
    if _EMPATHY.search(t):
        _add(304, 3.0, t, "OTHER")  # High priority: empathy beats questions
    if _EMPATHY_INFER.search(t):
        _add(304, 2.5, t, "OTHER")

    # Emotion — context-aware: ㅠㅠ + positive words = positive emotion, not distress
    has_cry_marker = bool(re.search(r'[ㅠㅜ]{2,}', t))
    has_pos_words = bool(_POS_EMOTION.search(t))
    has_neg_words = bool(_NEG_EMOTION.search(t))

    if _HOSTILE.search(t):
        _add(222, 3.0, t, "OTHER")
    if _DISTRESS.search(t) and not has_pos_words:
        _add(225, 2.0, t, "SELF")
    elif has_cry_marker and has_pos_words:
        # ㅠㅠ + positive = touched/moved, not distressed
        _add(220, 2.0, t, "SELF")
    elif has_cry_marker and not has_neg_words and not _DISTRESS.search(t):
        # ㅠㅠ alone without negative context = mild emotional expression
        _add(303, 1.5, t, "SELF")  # sharing feeling
    if _COMPLAIN.search(t):
        _add(224, 1.8, t, "SELF")
    if has_neg_words and 225 not in scores and 224 not in scores:
        _add(221, 1.5, t, "SELF")
    if has_pos_words and 220 not in scores:
        _add(220, 1.5, t, "SELF")

    # Interest / engagement
    if _INTEREST.search(t):
        _add(300, 2.0, t, "OTHER")
    if _PRAISE.search(t):
        _add(305, 2.5, t, "OTHER")  # Praise is strong feedback_pos

    # Sharing personal info
    if _SHARE.search(t):
        _add(303, 2.0, t, "SELF")
    if _SHARE_FEELING.search(t):
        _add(303, 1.5, t, "SELF")
    if _SHARE_SELF.search(t):
        _add(303, 2.0, t, "SELF")

    # Suggestion
    if _SUGGEST.search(t):
        _add(180, 2.0, t, "NEUTRAL")

    # Feedback positive
    if _FEEDBACK_POS.search(t):
        _add(305, 2.0, t, "OTHER")

    # Request
    if _REQUEST.search(t):
        _add(160, 2.0, t, "OTHER")

    # Boundary / deflection
    if _BOUNDARY.search(t):
        _add(263, 2.0, t, "SELF")
    if _DEFLECTION.search(t):
        _add(267, 1.5, t, "SELF")

    # Status update
    if _STATUS.search(t):
        _add(308, 1.0, t, "SELF")

    # Availability
    if _AVAILABILITY.search(t):
        _add(309, 1.0, t, "NEUTRAL")

    # Exclamation boosts positive emotion
    if _EXCLAIM.search(t) and 220 in scores:
        scores[220] += 1.0

    # Feedback negative
    if _FEEDBACK_NEG.search(t):
        _add(306, 1.8, t, "OTHER")

    # Agreement patterns in longer text
    if re.search(r'(맞아|그치|그래|알겠어|ㅇㅇ)', t) and len(t) > 3:
        _add(200, 1.0, t, "NEUTRAL")

    # Pick highest scoring label
    if not scores:
        # No pattern matched — classify as small talk (302) if conversational
        if len(t) > 5:
            return {"p": 302, "s": None, "c": 0.6, "e": t[:24], "d": "NEUTRAL", "v": 0}
        return {"p": 0, "s": None, "c": 1.0, "e": "", "d": "NEUTRAL", "v": 0}

    best_label = max(sorted(scores.keys()), key=lambda k: scores[k])
    conf = 0.8 if scores[best_label] >= 2.0 else 0.6

    return {
        "p": best_label,
        "s": None,
        "c": conf,
        "e": evidence.get(best_label, t[:24]),
        "d": direction.get(best_label, "NEUTRAL"),
        "v": 0,
    }


class RuleBasedKoreanProvider(LLMProvider):
    """규칙 기반 한국어 턴 분류기.

    LLM 없이 한국어 대화 패턴을 regex로 분류.
    MockProvider 대비: 차별화된 라벨 생성으로 L2/L3 축이 실제로 분화됨.
    """

    def call(self, system_prompt: str, user_message: str,
             temperature: float, max_tokens: int, top_p: float) -> str:
        """system_prompt는 무시하고, user_message에서 텍스트 추출 후 분류."""
        # user_message format: "normalized_text\n[hints: ...]\n[features: ...]"
        text = user_message.split("\n")[0].strip()
        result = _classify_korean(text)
        return json.dumps(result)
