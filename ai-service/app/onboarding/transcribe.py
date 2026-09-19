# ai-service/app/onboarding/transcribe.py
#
# Voice Onboarding — Sarvam Saaras v4 STT integration.
#
# Replaces Whisper large-v3-turbo with Sarvam AI's Saaras v4 model via
# synchronous REST API (POST https://api.sarvam.ai/speech-to-text).
#
# Satisfies the contract matching backend/src/services/onboarding/transcription.js:
# given raw audio bytes, returns { "transcript": str, "detectedLanguage": str }.

import logging
import os
from typing import Optional, Tuple

import requests

logger = logging.getLogger(__name__)

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_MODEL = "saaras:v4"

# Explicit 23-language mapping for Sarvam Saaras v4 (22 Indic languages + English).
# Maps Sarvam's BCP-47 language codes to normalized short codes expected by the application.
SARVAM_LANGUAGE_MAP = {
    "hi-IN": "hi",    # Hindi
    "te-IN": "te",    # Telugu
    "ta-IN": "ta",    # Tamil
    "kn-IN": "kn",    # Kannada
    "ml-IN": "ml",    # Malayalam
    "bn-IN": "bn",    # Bengali
    "mr-IN": "mr",    # Marathi
    "gu-IN": "gu",    # Gujarati
    "pa-IN": "pa",    # Punjabi
    "od-IN": "od",    # Odia
    "or-IN": "od",    # Odia (standard ISO alternative)
    "as-IN": "as",    # Assamese
    "ur-IN": "ur",    # Urdu
    "ne-IN": "ne",    # Nepali
    "kok-IN": "kok",  # Konkani
    "ks-IN": "ks",    # Kashmiri
    "sd-IN": "sd",    # Sindhi
    "sa-IN": "sa",    # Sanskrit
    "sat-IN": "sat",  # Santali
    "mni-IN": "mni",  # Manipuri
    "brx-IN": "brx",  # Bodo
    "mai-IN": "mai",  # Maithili
    "doi-IN": "doi",  # Dogri
    "en-IN": "en",    # English (Indian)
    "en-US": "en",    # English (Global)
    "en-GB": "en",    # English (Global)
}


def normalize_language_code(code: Optional[str]) -> str:
    """
    Normalizes Sarvam language codes (e.g. 'hi-IN') to the short code ('hi')
    expected by downstream components.
    """
    if not code or not isinstance(code, str):
        return "unknown"
    cleaned = code.strip()
    if cleaned in SARVAM_LANGUAGE_MAP:
        return SARVAM_LANGUAGE_MAP[cleaned]
    lower = cleaned.lower()
    for k, v in SARVAM_LANGUAGE_MAP.items():
        if k.lower() == lower:
            return v
    # Fallback to language subtag before hyphen (e.g. 'hi-XX' -> 'hi')
    prefix = lower.split("-")[0]
    return prefix if prefix else "unknown"


def detect_audio_mime(
    audio_bytes: bytes,
    content_type: Optional[str] = None,
    filename: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Determines the MIME type and appropriate filename for the audio payload.
    Uses caller-provided content_type if specific, or inspects magic bytes.
    Defaults to audio/ogg (WhatsApp voice note default) if unrecognized.
    """
    # Use caller-provided content_type if it is specific
    if content_type and content_type != "application/octet-stream" and "/" in content_type:
        mime = content_type.split(";")[0].strip().lower()
        ext = mime.split("/")[-1]
        fname = filename or f"audio.{ext}"
        return mime, fname

    # Detect via magic bytes
    if audio_bytes.startswith(b"OggS"):
        return "audio/ogg", filename or "audio.ogg"
    if audio_bytes.startswith(b"RIFF"):
        return "audio/wav", filename or "audio.wav"
    if audio_bytes.startswith(b"ID3") or (len(audio_bytes) > 2 and audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")):
        return "audio/mpeg", filename or "audio.mp3"
    if len(audio_bytes) >= 8 and audio_bytes[4:8] == b"ftyp":
        return "audio/mp4", filename or "audio.m4a"
    if audio_bytes.startswith(b"fLaC"):
        return "audio/flac", filename or "audio.flac"
    if audio_bytes.startswith(b"#!AMR"):
        return "audio/amr", filename or "audio.amr"

    return "audio/ogg", filename or "audio.ogg"


def run_transcription(
    audio_bytes: bytes,
    content_type: Optional[str] = None,
    filename: Optional[str] = None,
) -> dict:
    """
    Transcribes audio using Sarvam Saaras v4 REST API.
    Auto-detects spoken language using language_code='unknown'.
    Keeps the transcript in the original spoken language (mode='transcribe').
    Normalizes detected language code to short format (e.g. 'hi').

    Returns:
        dict: { "transcript": str, "detectedLanguage": str }
    """
    api_key = os.environ.get("SARVAM_API_KEY")
    if not api_key or not api_key.strip():
        raise RuntimeError("SARVAM_API_KEY is not set in the environment.")

    mime_type, file_name = detect_audio_mime(audio_bytes, content_type, filename)

    headers = {
        "api-subscription-key": api_key.strip(),
    }

    data = {
        "model": SARVAM_MODEL,
        "language_code": "unknown",  # Automatic language detection
        "mode": "transcribe",        # Original spoken language, no translation
    }

    files = {
        "file": (file_name, audio_bytes, mime_type),
    }

    logger.info(
        "onboarding.transcribe: sending audio to Sarvam Saaras v4 (mime=%s, size=%d bytes)",
        mime_type,
        len(audio_bytes),
    )

    try:
        response = requests.post(
            SARVAM_STT_URL,
            headers=headers,
            data=data,
            files=files,
            timeout=60,
        )
    except requests.RequestException as exc:
        logger.error("onboarding.transcribe: network error reaching Sarvam API: %s", exc)
        raise RuntimeError(f"Failed to reach Sarvam transcription service: {exc}") from exc

    if not response.ok:
        try:
            err_json = response.json()
            err_detail = err_json.get("detail", str(err_json))
        except Exception:
            err_detail = response.text
        logger.error(
            "onboarding.transcribe: Sarvam API returned HTTP %d: %s",
            response.status_code,
            err_detail,
        )
        raise RuntimeError(f"Sarvam transcription failed with status {response.status_code}: {err_detail}")

    resp_data = response.json()
    transcript = resp_data.get("transcript", "")
    raw_lang = resp_data.get("language_code", "")
    detected_lang = normalize_language_code(raw_lang)

    return {
        "transcript": transcript,
        "detectedLanguage": detected_lang,
    }
