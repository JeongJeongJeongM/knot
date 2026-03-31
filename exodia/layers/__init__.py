"""
⚠️ DEPRECATED: v2 레거시 레이어.
v3 파이프라인은 api/pipeline.py → preprocess/, kernel/, labeling/,
stats/, synthesis/, projection/, integrity/ 를 직접 호출한다.
이 디렉토리의 코드는 구현 근거로 사용하지 않는다.
"""
import warnings

warnings.warn(
    "exodia.layers is deprecated. Use exodia.api.pipeline for v3.",
    DeprecationWarning,
    stacklevel=2,
)
