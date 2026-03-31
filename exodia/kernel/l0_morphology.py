"""EXODIA v3.0 — L0 Morphological Analysis (MeCab-Ko + regex fallback).

100 % deterministic.  Never raises; returns default MorphologyOutput on failure.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    pass

from exodia.models.outputs import MorphologyOutput

# ═══════════ POS tag sets (Sejong tagset) ═══════════

CONTENT_POS: frozenset[str] = frozenset({
    "NNG", "NNP", "NNB", "NR",
    "VV", "VA", "VX",
    "MAG", "MAJ", "IC",
})

FUNCTION_POS: frozenset[str] = frozenset({
    "JKS", "JKC", "JKG", "JKO", "JKB", "JKV", "JKQ", "JX", "JC",
    "EP", "EF", "EC", "ETN", "ETM",
    "XPN", "XSN", "XSV", "XSA", "XR",
})

# ═══════════ Emoji regex (Unicode blocks) ═══════════

_EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F"
    "\U0001F300-\U0001F5FF"
    "\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF"
    "\U00002702-\U000027B0"
    "\U000024C2-\U0001F251"
    "\U0001F900-\U0001F9FF"
    "\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF"
    "\U00002600-\U000026FF"
    "\U0000FE00-\U0000FE0F"
    "\U0000200D"
    "]+",
    flags=re.UNICODE,
)

# ═══════════ MeCab lazy singleton ═══════════

_mecab_instance: object | None = None
_mecab_checked: bool = False


def _get_mecab():
    """Return a MeCab tagger or *None* if the library is unavailable."""
    global _mecab_instance, _mecab_checked
    if _mecab_checked:
        return _mecab_instance
    _mecab_checked = True
    try:
        from mecab import MeCab  # mecab-python3
        _mecab_instance = MeCab()
    except Exception:
        try:
            import MeCab as _MeCab
            _mecab_instance = _MeCab.Tagger()
        except Exception:
            _mecab_instance = None
    return _mecab_instance


# ═══════════ Internal helpers ═══════════

def _count_emojis(text: str) -> int:
    return sum(len(m.group()) for m in _EMOJI_RE.finditer(text))


def _parse_mecab(text: str) -> list[tuple[str, str]]:
    """Return list of (surface, POS-tag) via MeCab.  Empty list on failure."""
    tagger = _get_mecab()
    if tagger is None:
        return []
    try:
        parsed = tagger.parse(text)
        if parsed is None:
            return []

        morphemes: list[tuple[str, str]] = []

        # python-mecab-ko returns list of Morpheme objects
        if isinstance(parsed, list):
            for morph_obj in parsed:
                surface = getattr(morph_obj, 'surface', '')
                feature = getattr(morph_obj, 'feature', None)
                if feature is not None:
                    pos = getattr(feature, 'pos', 'UNK') or 'UNK'
                else:
                    pos = 'UNK'
                if surface:
                    morphemes.append((surface, pos))
            return morphemes

        # Legacy MeCab (string output)
        if not isinstance(parsed, str):
            return []
        for line in parsed.strip().split("\n"):
            if line == "EOS" or line == "":
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            surface = parts[0]
            feature = parts[1]
            pos = feature.split(",")[0] if feature else "UNK"
            morphemes.append((surface, pos))
        return morphemes
    except Exception:
        return []


def _is_oov(pos_tag: str) -> bool:
    """MeCab marks unknown words via special tags or the 'UNKNOWN' feature."""
    if pos_tag in ("UNK", "UNKNOWN"):
        return True
    if pos_tag.startswith("UNK"):
        return True
    return False


def _compute_repetition(surfaces: list[str]) -> float:
    if len(surfaces) <= 1:
        return 0.0
    pairs = sum(1 for i in range(len(surfaces) - 1) if surfaces[i] == surfaces[i + 1])
    return pairs / (len(surfaces) - 1)


# ═══════════ Fallback (regex) ═══════════

def _fallback_analysis(text: str) -> MorphologyOutput:
    tokens = re.split(r"\s+", text.strip())
    tokens = [t for t in tokens if t]
    token_count = len(tokens)
    morpheme_count = token_count
    unique = len(set(tokens))
    unique_ratio = unique / max(1, token_count)
    emoji_count = _count_emojis(text)
    emoji_density = emoji_count / max(1, morpheme_count)
    repetition = _compute_repetition(tokens)

    return MorphologyOutput(
        morpheme_count=morpheme_count,
        token_count=token_count,
        unique_token_ratio=round(unique_ratio, 6),
        pos_distribution={},
        function_content_ratio=0.0,
        proper_noun_list=[],
        oov_ratio=0.0,
        emoji_density=round(emoji_density, 6),
        repetition_score=round(repetition, 6),
        mecab_available=False,
    )


# ═══════════ Public API ═══════════

def process_morphology(normalized_text: str) -> MorphologyOutput:
    """Deterministic morphological analysis.

    Returns *MorphologyOutput* — never raises.
    """
    if not normalized_text or not normalized_text.strip():
        return MorphologyOutput()

    text = normalized_text.strip()

    morphemes = _parse_mecab(text)
    if not morphemes:
        return _fallback_analysis(text)

    surfaces = [s for s, _ in morphemes]
    tags = [t for _, t in morphemes]

    morpheme_count = len(morphemes)
    token_count = len(set(surfaces) | set(re.split(r"\s+", text)))

    unique_tokens = set(surfaces)
    unique_token_ratio = len(unique_tokens) / max(1, morpheme_count)

    pos_counter: Counter[str] = Counter(tags)
    pos_total = sum(pos_counter.values()) or 1
    pos_distribution = {k: round(v / pos_total, 6) for k, v in sorted(pos_counter.items())}

    content_count = sum(pos_counter.get(p, 0) for p in CONTENT_POS)
    function_count = sum(pos_counter.get(p, 0) for p in FUNCTION_POS)
    denom = function_count + content_count
    function_content_ratio = function_count / denom if denom > 0 else 0.0

    proper_noun_list = list(dict.fromkeys(
        s for s, t in morphemes if t == "NNP"
    ))

    oov_count = sum(1 for t in tags if _is_oov(t))
    oov_ratio = oov_count / max(1, morpheme_count)

    emoji_count = _count_emojis(text)
    emoji_density = emoji_count / max(1, morpheme_count)

    repetition_score = _compute_repetition(surfaces)

    return MorphologyOutput(
        morpheme_count=morpheme_count,
        token_count=token_count,
        unique_token_ratio=round(unique_token_ratio, 6),
        pos_distribution=pos_distribution,
        function_content_ratio=round(function_content_ratio, 6),
        proper_noun_list=proper_noun_list,
        oov_ratio=round(oov_ratio, 6),
        emoji_density=round(emoji_density, 6),
        repetition_score=round(repetition_score, 6),
        mecab_available=True,
    )

