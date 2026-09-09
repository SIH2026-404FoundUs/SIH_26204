# ai-service/app/onboarding/extraction_prompt.py
#
# bharani-tasks.md Section 1.3 -- extraction prompt construction, kept
# separate from main.py (no genai/ADK dependency here, pure string logic)
# so it can be imported and unit-tested cheaply without a live Gemini
# call, a FastAPI test client, or GOOGLE_API_KEY -- the same reason
# app/onboarding/transcribe.py lives apart from main.py rather than
# inline in the endpoint.

from typing import Optional

# The critical rule from the spec, stated explicitly rather than left
# implicit: an LLM asked to "extract details" will happily infer a
# plausible capacity or price range from context/typical-homestay
# knowledge unless told not to. checkExtractionHonesty() on the Node side
# exists to catch exactly this if it slips through, but the prompt itself
# should already be trying hard not to need that safety net.
EXTRACTION_PROMPT_TEMPLATE = """You are extracting structured business-listing details from a transcript of a homestay/guesthouse/guide/driver/cook owner describing their business, for bharani-tasks.md Section 1.3's voice onboarding flow.

Transcript language: {language}
Transcript: {transcript}
{pending_field_note}
Extract ONLY what is explicitly and unambiguously stated in the transcript above. Return null (or an empty list, for list fields) for anything not explicitly stated in the transcript -- do not infer, guess, estimate, or fill in a plausible-sounding value for any field, even if it seems like a reasonable assumption for this kind of business. The transcript is the ONLY source of truth; do not use outside knowledge of typical homestays/guesthouses/guides to fill gaps. If in doubt about whether something was actually said, return null rather than a guess."""

# Only inserted when pendingField is set -- a spontaneous message (no
# pending question) gets the exact same prompt as before this addition,
# with this section rendering as an empty string. Scoped explicitly to
# the ONE named field so it cannot be read as license to relax the
# "return null if in doubt" rule for anything else -- an invented value
# on any other field is still exactly what checkExtractionHonesty() on
# the Node side exists to catch.
PENDING_FIELD_NOTE_TEMPLATE = """
IMPORTANT CONTEXT: This transcript is very likely a direct reply to a follow-up question that was just asked, specifically about the "{pending_field}" field (see the response schema for what that field represents). If the transcript's content plausibly answers that field -- even a short or terse reply with no stated subject, like a bare number or short phrase -- extract it into "{pending_field}". This context applies ONLY to that one field: every other field must still strictly follow the "return null unless explicitly and unambiguously stated" rule below, with no loosening for related guesses.
"""


def build_extraction_prompt(transcript: str, language: Optional[str], pending_field: Optional[str] = None) -> str:
    """
    Pure string construction, no network/model dependency. `pending_field`
    is the REQUIRED_FIELDS_FOR_LIVE field name (Node's stateMachine.js) a
    FOLLOWUP question was just asked about, if this transcript is a reply
    to one -- None for a spontaneous message, which gets exactly the same
    prompt as before this parameter existed.
    """
    pending_field_note = PENDING_FIELD_NOTE_TEMPLATE.format(pending_field=pending_field) if pending_field else ""
    return EXTRACTION_PROMPT_TEMPLATE.format(
        language=language or "unknown",
        transcript=transcript,
        pending_field_note=pending_field_note,
    )
