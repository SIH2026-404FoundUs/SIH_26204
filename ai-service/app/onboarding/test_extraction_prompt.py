# ai-service/app/onboarding/test_extraction_prompt.py
#
# Real, automated test (unittest, stdlib only). NOT a manual demo script
# like ai-service/test_agent.py -- named explicitly to avoid the same
# discovery hazard test_load_model_cuda_fallback.py's own docstring
# describes (a same-named manual script a test runner's default discovery
# pattern picks up and runs for real).
#
# build_extraction_prompt lives in its own module (extraction_prompt.py,
# not main.py) specifically so it can be imported and tested here without
# pulling in google-adk/google-genai or requiring GOOGLE_API_KEY -- pure
# string construction, no network/model dependency.
#
# Run directly: ai-service/venv/Scripts/python.exe -m unittest
#   app.onboarding.test_extraction_prompt -v
# (from the ai-service/ directory, so `app` resolves as a package).

import unittest

from app.onboarding.extraction_prompt import build_extraction_prompt


class BuildExtractionPromptTest(unittest.TestCase):
    def test_spontaneous_message_prompt_is_unchanged_by_the_pendingField_feature(self):
        # pending_field omitted (None): the prompt must be byte-for-byte
        # what it was before this feature existed -- no stray blank
        # section, no leftover template artifact.
        prompt = build_extraction_prompt("This is Green Valley Homestay.", "en")

        self.assertIn("Transcript language: en", prompt)
        self.assertIn("Transcript: This is Green Valley Homestay.", prompt)
        self.assertIn("Extract ONLY what is explicitly and unambiguously stated", prompt)
        self.assertNotIn("IMPORTANT CONTEXT", prompt)
        self.assertNotIn("pendingField", prompt)
        self.assertNotIn("{pending_field", prompt)  # no unformatted template leftover

    def test_pending_field_note_included_and_names_the_correct_field(self):
        prompt = build_extraction_prompt("Six.", "en", pending_field="capacity")

        self.assertIn("IMPORTANT CONTEXT", prompt)
        self.assertIn('specifically about the "capacity" field', prompt)
        self.assertIn('extract it into "capacity"', prompt)
        # The core honesty discipline must still be present, unweakened.
        self.assertIn("return null unless explicitly and unambiguously stated", prompt)
        self.assertIn("Extract ONLY what is explicitly and unambiguously stated", prompt)

    def test_pending_field_note_scopes_the_hint_to_only_the_named_field(self):
        prompt = build_extraction_prompt("Near the market.", "en", pending_field="nearestLandmark")

        self.assertIn('"nearestLandmark"', prompt)
        self.assertIn("applies ONLY to that one field", prompt)
        self.assertNotIn('"capacity"', prompt)

    def test_language_defaults_to_unknown_when_not_supplied(self):
        prompt = build_extraction_prompt("Some transcript.", None)
        self.assertIn("Transcript language: unknown", prompt)

    def test_empty_string_pending_field_is_treated_as_no_context(self):
        # Falsy-but-not-None edge case: an empty string must not produce a
        # malformed "specifically about the "" field" note.
        prompt = build_extraction_prompt("Some transcript.", "en", pending_field="")
        self.assertNotIn("IMPORTANT CONTEXT", prompt)


if __name__ == "__main__":
    unittest.main()
