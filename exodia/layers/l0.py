"""
EXODIA L0 — Measurement (계측).
Appendix G 그대로 구현. 순수 Python + re. NLP 라이브러리 금지.

3가지 함수:
1. normalize(raw_text) → str            — G.1 정규화 7단계
2. extract_surface_features(text) → SurfaceFeatures  — G.2 20개 필드
3. extract_span_hints(text) → list[SpanHint]          — G.3 8유형

PART 10 적용: E-01 Pure function, E-11 메모리 안전, E-12 복잡도 제약
"""
import re
from exodia.schemas import L0Output, SurfaceFeatures, SpanHint


# ═══════════════════════════════════════════════════════════════
# G.1 정규화 파이프라인 (순서 고정)
# ═══════════════════════════════════════════════════════════════

# Step 2 전각→반각 매핑 (모듈 수준 상수)
_FULLWIDTH_MAP = str.maketrans('？！，．：；', '?!,.:;')


def normalize(raw_text: str) -> str:
    """L0 정규화. 7단계 순서 변경 금지. — Appendix G §G.1"""
    text = raw_text

    # Step 1: 제어문자/Zero-width 제거
    text = re.sub(
        r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\u200b-\u200f\u2028-\u202f\ufeff]',
        '', text
    )

    # Step 2: 전각 문장부호 → 반각
    text = text.translate(_FULLWIDTH_MAP)

    # Step 3: URL → [URL] 토큰
    text = re.sub(r'https?://\S+', '[URL]', text)

    # Step 4: 코드 블록 → [CODE] 토큰
    text = re.sub(r'```[\s\S]*?```', '[CODE]', text)
    text = re.sub(r'`[^`]+`', '[CODE]', text)

    # Step 5: 한글 자모 3회+ → 2회 (ㅋㅋㅋㅋ → ㅋㅋ)
    text = re.sub(r'([ㄱ-ㅎㅏ-ㅣ])\1{2,}', r'\1\1', text)

    # Step 6: 동일 문자 4회+ → 3회 (!!!! → !!!)
    text = re.sub(r'(.)\1{3,}', r'\1\1\1', text)

    # Step 7: 연속 공백/개행 → 단일 공백
    text = re.sub(r'\s+', ' ', text).strip()

    return text


# ═══════════════════════════════════════════════════════════════
# G.2 SurfaceFeatures 20개 필드 — 추출 로직
# ═══════════════════════════════════════════════════════════════

def extract_surface_features(normalized_text: str) -> SurfaceFeatures:
    """L0 표층 피처 추출. — Appendix G §G.2"""
    text = normalized_text

    if not text.strip():
        return SurfaceFeatures(is_empty_after_norm=True)

    # 기본 통계 (3)
    char_count = len(text)
    word_count = len(text.split())
    sentence_matches = re.findall(r'[.?!]+', text)
    sentence_count = len(sentence_matches) if sentence_matches else 1

    # 문장부호 (4)
    question_mark_count = text.count('?')
    exclamation_count = text.count('!')
    ellipsis_present = '…' in text or '...' in text
    multi_punctuation = bool(re.search(r'[?!.]{2,}', text))

    # 한국어 특화 (6)
    ko_laugh_count = len(re.findall(r'[ㅋㅎ]{2}', text))
    ko_cry_count = len(re.findall(r'[ㅠㅜ]{2}', text))
    ko_abbrev_present = bool(re.search(r'^[ㄱ-ㅎ]{2,4}$', text.strip()))
    ko_profanity_present = bool(re.search(
        r'ㅅㅂ|ㅁㅊ|ㅂㅅ|ㅈㄹ|씨발|시발|개새|미친', text
    ))
    ko_honorific_ending = bool(re.search(
        r'(요|습니다|세요|십시오|시죠)\s*[.?!]*$', text
    ))
    ko_casual_ending = bool(re.search(
        r'(임|음|ㅇㅇ|ㄴㄴ|ㄱㄱ|함|됨)\s*[.?!]*$', text
    ))

    # 일반 (4)
    upper_count = sum(1 for c in text if c.isupper())
    all_caps_ratio = upper_count / max(1, len(text))
    has_url = '[URL]' in text
    has_code = '[CODE]' in text
    emoji_count = len(re.findall(r'[\U0001F300-\U0001F9FF]', text))

    # 구조 (3)
    is_single_token = word_count == 1
    is_very_short = char_count <= 5
    is_empty_after_norm = len(text.strip()) == 0

    return SurfaceFeatures(
        char_count=char_count,
        word_count=word_count,
        sentence_count=sentence_count,
        question_mark_count=question_mark_count,
        exclamation_count=exclamation_count,
        ellipsis_present=ellipsis_present,
        multi_punctuation=multi_punctuation,
        ko_laugh_count=ko_laugh_count,
        ko_cry_count=ko_cry_count,
        ko_abbrev_present=ko_abbrev_present,
        ko_profanity_present=ko_profanity_present,
        ko_honorific_ending=ko_honorific_ending,
        ko_casual_ending=ko_casual_ending,
        all_caps_ratio=all_caps_ratio,
        has_url=has_url,
        has_code=has_code,
        emoji_count=emoji_count,
        is_single_token=is_single_token,
        is_very_short=is_very_short,
        is_empty_after_norm=is_empty_after_norm,
    )


# ═══════════════════════════════════════════════════════════════
# G.3 SpanHint 8유형 — 패턴 매칭 규칙
# ═══════════════════════════════════════════════════════════════

SPAN_PATTERNS: dict[str, str] = {
    'QUESTION': r'[?？]|뭐야|왜|어떻게|언제|어디|누가|몇|뭘|뭘까',
    'PROFANITY': r'ㅅㅂ|ㅁㅊ|ㅂㅅ|ㅈㄹ|씨발|시발|개새끼|미친놈|미친년|병신|지랄',
    'COMMAND': r'해라|하세요|해줘|해주세요|하십시오|해봐|해주라|하거라',
    'NEGATION': r'아니[야요]?|ㄴㄴ|안 |못 |없[어다]|말[아아라]|하지 ?마',
    'AFFIRMATION': r'ㅇㅇ|ㅇㅋ|ㄱㄱ|맞[아다]|그래|그렇[지다]|응|네|넵|예',
    'GREETING': r'안녕|하이|헬로|반갑|좋은 아침|좋은 저녁|잘 가|바이|수고',
    'THANKS': r'고마[워운]|감사|ㄱㅅ|땡큐|쌩유|thank',
    'APOLOGY': r'미안|죄송|사과|sorry|ㅁㅇ',
}


def extract_span_hints(normalized_text: str) -> list[SpanHint]:
    """L0 Span 힌트 추출. — Appendix G §G.3"""
    hints: list[SpanHint] = []
    for hint_type, pattern in SPAN_PATTERNS.items():
        for m in re.finditer(pattern, normalized_text, re.IGNORECASE):
            hints.append(SpanHint(
                hint_type=hint_type,
                span_start=m.start(),
                span_end=m.end(),
                matched_text=m.group(),
            ))
    return hints


# ═══════════════════════════════════════════════════════════════
# L0 Processor — 통합 처리
# ═══════════════════════════════════════════════════════════════

class L0Processor:
    """L0 계측 프로세서. 순수 함수. 외부 의존성 없음. 예외 발생 금지."""

    def process(self, turn_id: str, raw_text: str,
                metadata: dict | None = None) -> L0Output:
        """단일 턴 L0 처리. — PART 6 §4.1, Appendix G §G.5

        안정성 계약:
        - 예외를 발생시키지 않는다.
        - 빈 입력 → is_empty_after_norm=True, 모든 피처 0/False.
        - 이전 턴을 참조하지 않는다 (stateless).
        - 동일 입력이면 항상 동일 출력 (결정론).
        """
        try:
            normalized = normalize(raw_text)
            is_empty = len(normalized.strip()) == 0

            if is_empty:
                features = SurfaceFeatures(is_empty_after_norm=True)
                hints: list[SpanHint] = []
            else:
                features = extract_surface_features(normalized)
                hints = extract_span_hints(normalized)

            return L0Output(
                turn_id=turn_id,
                raw_text=raw_text,
                normalized_text=normalized,
                surface_features=features,
                span_hints=hints,
                is_empty_after_norm=is_empty,
                metadata=metadata,
            )
        except Exception:
            # L0는 예외를 발생시키지 않는다. — Appendix G §G.5
            return L0Output(
                turn_id=turn_id,
                raw_text=raw_text,
                normalized_text="",
                surface_features=SurfaceFeatures(is_empty_after_norm=True),
                span_hints=[],
                is_empty_after_norm=True,
                metadata=metadata,
            )
