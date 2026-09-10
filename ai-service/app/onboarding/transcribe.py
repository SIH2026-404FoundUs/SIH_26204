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
# "Usable" is verified, not assumed from construction succeeding: CTranslate2
# defers binding CUDA runtime libraries (e.g. cuBLAS) until the first real
# compute call, not model construction (confirmed against a real production
# failure — WhisperModel(..., device="cuda") constructed and the service
# started fine, but the first actual transcribe() call threw "Library
# cublas64_12.dll is not found or cannot be loaded", entirely outside this
# function's original try/except). So after constructing the CUDA candidate,
# _load_model() now forces one throwaway transcription (1 second of silence,
# no network/file dependency) to trigger that same encode step immediately,
# while still inside the try/except — a broken CUDA runtime is caught here,
# once, at import time, rather than surfacing as a 500 on a real request.
#
# Endpoint registration lives in app/main.py as a direct @app.post
# decorator (matching that file's convention for /api/plan-trip and
# /api/plan-trip/confirm) — this module exposes only the model and the
# plain transcription function main.py's endpoint calls into, not a router.

import io
import logging

import numpy as np
from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

MODEL_NAME = "large-v3-turbo"

# 1 second of silence at 16kHz (Whisper's expected sample rate) — enough to
# force the model's encode/language-detection step without needing any real
# audio file or network call.
_PROBE_AUDIO = np.zeros(16000, dtype=np.float32)


def _load_model() -> WhisperModel:
    try:
        import ctranslate2

        if ctranslate2.get_cuda_device_count() > 0:
            logger.info("onboarding.transcribe: loading %s on CUDA (float16)", MODEL_NAME)
            candidate = WhisperModel(MODEL_NAME, device="cuda", compute_type="float16")

            # Construction succeeding does not prove CUDA actually works —
            # see module docstring. Force the real encode step now, still
            # inside this try/except, so a broken CUDA runtime falls through
            # to the CPU branch below instead of only failing later, on a
            # real request, outside this function entirely.
            segments, _info = candidate.transcribe(_PROBE_AUDIO)
            list(segments)  # segments is a lazy generator; force full consumption

            return candidate
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
