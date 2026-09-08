# ai-service/app/onboarding/transcribe.py
#
# bharani-tasks.md Section 1.2 — real faster-whisper transcription backend.
#
# Loads distil-large-v3 once, when this module is first imported (i.e. once
# per running ai-service process), never per-request — reloading a model
# this size on every call would turn the spec's own "1-3x realtime on CPU"
# warning into something far worse during a demo.
#
# Device selection follows Section 1.2 directly: "Do not use large-v3 on
# CPU... Use a GPU if at all available." Tries CUDA first (float16, the
# standard high-throughput CTranslate2 quantization for GPU); falls back to
# CPU (int8) if CUDA isn't usable for any reason, rather than failing to
# start the service entirely.
#
# Endpoint registration lives in app/main.py as a direct @app.post
# decorator (matching that file's convention for /api/plan-trip and
# /api/plan-trip/confirm) — this module exposes only the model and the
# plain transcription function main.py's endpoint calls into, not a router.

import io
import logging

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

MODEL_NAME = "distil-large-v3"


def _load_model() -> WhisperModel:
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            logger.info("onboarding.transcribe: loading %s on CUDA (float16)", MODEL_NAME)
            return WhisperModel(MODEL_NAME, device="cuda", compute_type="float16")
    except Exception as exc:  # pragma: no cover - depends on the runtime GPU/driver
        logger.warning("onboarding.transcribe: GPU path unavailable (%s), falling back to CPU int8", exc)

    logger.info(
        "onboarding.transcribe: loading %s on CPU (int8) — Section 1.2: expect ~1-3x realtime",
        MODEL_NAME,
    )
    return WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")


# Loaded at import time, not lazily on first request — see module docstring.
_model = _load_model()


def run_transcription(audio_bytes: bytes) -> dict:
    """
    Real contract this must satisfy, matching
    backend/src/services/onboarding/transcription.js's transcribeFn:
    given raw audio bytes, return { transcript: string, detectedLanguage: string }.
    """
    # language=None (the default) -> auto-detect, per Section 1.2.
    segments, info = _model.transcribe(io.BytesIO(audio_bytes))
    transcript = "".join(segment.text for segment in segments).strip()
    return {"transcript": transcript, "detectedLanguage": info.language}
