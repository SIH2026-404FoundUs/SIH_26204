# ai-service/app/onboarding/test_transcribe_sarvam.py
#
# Automated unit tests for Sarvam Saaras v4 STT integration (app.onboarding.transcribe).
# Mocks all external HTTP calls to Sarvam AI.

import os
import unittest
from unittest.mock import MagicMock, patch

from app.onboarding.transcribe import (
    SARVAM_MODEL,
    SARVAM_STT_URL,
    detect_audio_mime,
    normalize_language_code,
    run_transcription,
)


class NormalizeLanguageCodeTest(unittest.TestCase):
    """Verifies language code normalization for all 23 Sarvam Saaras v4 languages."""

    def test_all_23_saaras_languages_normalized(self):
        expected_mappings = {
            "hi-IN": "hi",
            "te-IN": "te",
            "ta-IN": "ta",
            "kn-IN": "kn",
            "ml-IN": "ml",
            "bn-IN": "bn",
            "mr-IN": "mr",
            "gu-IN": "gu",
            "pa-IN": "pa",
            "od-IN": "od",
            "or-IN": "od",
            "as-IN": "as",
            "ur-IN": "ur",
            "ne-IN": "ne",
            "kok-IN": "kok",
            "ks-IN": "ks",
            "sd-IN": "sd",
            "sa-IN": "sa",
            "sat-IN": "sat",
            "mni-IN": "mni",
            "brx-IN": "brx",
            "mai-IN": "mai",
            "doi-IN": "doi",
            "en-IN": "en",
            "en-US": "en",
            "en-GB": "en",
        }
        for bcp47, short_code in expected_mappings.items():
            self.assertEqual(
                normalize_language_code(bcp47),
                short_code,
                f"Failed for language code: {bcp47}",
            )

    def test_case_insensitivity_and_whitespace(self):
        self.assertEqual(normalize_language_code("HI-in"), "hi")
        self.assertEqual(normalize_language_code("  te-IN  "), "te")

    def test_unrecognized_or_empty_language_fallback(self):
        self.assertEqual(normalize_language_code(None), "unknown")
        self.assertEqual(normalize_language_code(""), "unknown")
        self.assertEqual(normalize_language_code("unknown"), "unknown")
        self.assertEqual(normalize_language_code("fr-FR"), "fr")


class DetectAudioMimeTest(unittest.TestCase):
    """Verifies MIME detection via caller type or magic bytes."""

    def test_preserves_caller_content_type_when_specific(self):
        mime, fname = detect_audio_mime(b"dummybytes", content_type="audio/ogg; codecs=opus", filename="voice.ogg")
        self.assertEqual(mime, "audio/ogg")
        self.assertEqual(fname, "voice.ogg")

        mime2, fname2 = detect_audio_mime(b"dummybytes", content_type="audio/mp4", filename=None)
        self.assertEqual(mime2, "audio/mp4")
        self.assertEqual(fname2, "audio.mp4")

    def test_detects_magic_bytes(self):
        # OGG Opus
        mime, fname = detect_audio_mime(b"OggS\x00\x02something")
        self.assertEqual(mime, "audio/ogg")
        self.assertEqual(fname, "audio.ogg")

        # WAV RIFF
        mime, fname = detect_audio_mime(b"RIFF$\x00\x00\x00WAVE")
        self.assertEqual(mime, "audio/wav")
        self.assertEqual(fname, "audio.wav")

        # MP3 ID3
        mime, fname = detect_audio_mime(b"ID3\x03\x00\x00\x00")
        self.assertEqual(mime, "audio/mpeg")
        self.assertEqual(fname, "audio.mp3")

        # MP4 / M4A (ftyp)
        mime, fname = detect_audio_mime(b"\x00\x00\x00 ftypM4A ")
        self.assertEqual(mime, "audio/mp4")
        self.assertEqual(fname, "audio.m4a")

        # FLAC
        mime, fname = detect_audio_mime(b"fLaC\x00\x00\x00")
        self.assertEqual(mime, "audio/flac")
        self.assertEqual(fname, "audio.flac")

        # AMR
        mime, fname = detect_audio_mime(b"#!AMR\n")
        self.assertEqual(mime, "audio/amr")
        self.assertEqual(fname, "audio.amr")

    def test_defaults_to_audio_ogg_for_unrecognized(self):
        mime, fname = detect_audio_mime(b"random-unrecognized-bytes")
        self.assertEqual(mime, "audio/ogg")
        self.assertEqual(fname, "audio.ogg")


class RunTranscriptionTest(unittest.TestCase):
    """Verifies run_transcription calling Sarvam REST API."""

    def setUp(self):
        self._orig_key = os.environ.get("SARVAM_API_KEY")
        os.environ["SARVAM_API_KEY"] = "test-sarvam-api-key"

    def tearDown(self):
        if self._orig_key is not None:
            os.environ["SARVAM_API_KEY"] = self._orig_key
        else:
            os.environ.pop("SARVAM_API_KEY", None)

    def test_missing_api_key_raises_runtime_error(self):
        os.environ.pop("SARVAM_API_KEY", None)
        with self.assertRaises(RuntimeError) as ctx:
            run_transcription(b"audio data")
        self.assertIn("SARVAM_API_KEY is not set", str(ctx.exception))

    @patch("requests.post")
    def test_successful_transcription_returns_contract(self, mock_post):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "request_id": "req-12345",
            "transcript": "ये मेरा होमस्टे है, तीन कमरे हैं।",
            "language_code": "hi-IN",
        }
        mock_post.return_value = mock_response

        audio_bytes = b"OggS-fake-audio-stream"
        result = run_transcription(audio_bytes, content_type="audio/ogg", filename="whatsapp.ogg")

        self.assertEqual(result, {
            "transcript": "ये मेरा होमस्टे है, तीन कमरे हैं।",
            "detectedLanguage": "hi",
        })

        # Verify call arguments
        mock_post.assert_called_once()
        call_args, call_kwargs = mock_post.call_args
        self.assertEqual(call_args[0], SARVAM_STT_URL)
        self.assertEqual(call_kwargs["headers"], {"api-subscription-key": "test-sarvam-api-key"})
        self.assertEqual(call_kwargs["data"], {
            "model": SARVAM_MODEL,
            "language_code": "unknown",
            "mode": "transcribe",
        })
        files = call_kwargs["files"]
        self.assertIn("file", files)
        filename, data_bytes, mime = files["file"]
        self.assertEqual(filename, "whatsapp.ogg")
        self.assertEqual(data_bytes, audio_bytes)
        self.assertEqual(mime, "audio/ogg")

    @patch("requests.post")
    def test_preserves_original_spoken_language_text(self, mock_post):
        mock_response = MagicMock()
        mock_response.ok = True
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "request_id": "req-telugu",
            "transcript": "మా హోమ్‌స్టేలో మూడు గదులు ఉన్నాయి.",
            "language_code": "te-IN",
        }
        mock_post.return_value = mock_response

        result = run_transcription(b"OggS-telugu-audio")
        self.assertEqual(result["transcript"], "మా హోమ్‌స్టేలో మూడు గదులు ఉన్నాయి.")
        self.assertEqual(result["detectedLanguage"], "te")

    @patch("requests.post")
    def test_sarvam_api_error_raises_runtime_error_without_leaking_key(self, mock_post):
        mock_response = MagicMock()
        mock_response.ok = False
        mock_response.status_code = 400
        mock_response.json.return_value = {"detail": "Audio duration exceeds 30 seconds limit"}
        mock_response.text = '{"detail": "Audio duration exceeds 30 seconds limit"}'
        mock_post.return_value = mock_response

        with self.assertRaises(RuntimeError) as ctx:
            run_transcription(b"long audio")
        err_msg = str(ctx.exception)
        self.assertIn("Audio duration exceeds 30 seconds limit", err_msg)
        self.assertNotIn("test-sarvam-api-key", err_msg)


if __name__ == "__main__":
    unittest.main()
