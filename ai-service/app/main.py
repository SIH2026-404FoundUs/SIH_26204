# ai-service/app/main.py
import asyncio
import json
import logging
import os
import re
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from google import genai
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import BaseModel, Field, field_validator, model_validator
from starlette.exceptions import HTTPException as StarletteHTTPException

# Load the service-local .env before importing the agent. The Agent is created
# at import time and the Google SDK reads its credentials during construction.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.agents.travel_agent import PROVIDER_CHAIN
from app.services import trip_drafts
from app.tools.alternatives import find_alternatives
from app.tools.pressure import get_pressure

logger = logging.getLogger(__name__)

APP_NAME = "travel_planner"

# What a traveller (or a judge watching the demo) is shown when a plan cannot be
# produced. The technical cause still travels in "detail" so a captured response
# is debuggable, but it is never the headline.
PLAN_FAILED_MESSAGE = (
    "We couldn't generate your trip plan right now. Please try again in a moment."
)

# At or above this pressure score the traveller is shown alternatives before a
# plan is built. The gate is applied here, in Python, rather than being left to
# the agent: an agent could reason its way out of offering alternatives, and
# redistributing demand away from crowded destinations is the product's whole
# point, so it has to fire on every request that crosses the line.
PRESSURE_GATE = 0.60

# QA finding (brutal-qa-report.md, P0): a full agent run makes several
# backend-dependent tool calls, each individually bounded to 5s
# (backend_client.py), but nothing previously bounded the run AS A WHOLE --
# confirmed live, a run degraded into a 30s+, then a further 15s+, hang with
# zero response when its backend dependency dropped mid-run. This is a hard
# ceiling on the entire agent execution, independent of and in addition to
# the per-call timeouts and the Connection: close fix in backend_client.py --
# whatever the exact internal cause, a request must fail by this deadline
# rather than hang indefinitely.
AGENT_RUN_TIMEOUT_S = 45

# The frontend dev server origin, as documented by CLIENT_URL in
# backend/.env.example (Vite's default 5173). Overridable so a deployed
# frontend doesn't need a code change. Comma-separated to match the Express
# backend's own CLIENT_URL handling (a single deployed URL, or that plus
# localhost for testing a deployed service from a local frontend).
CLIENT_URLS = [
    origin.strip()
    for origin in os.environ.get("CLIENT_URL", "http://localhost:5173").split(",")
    if origin.strip()
]

app = FastAPI(title="AI Travel Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CLIENT_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Render's health check (and anyone's uptime monitor)."""
    return {"status": "ok"}


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc: StarletteHTTPException):
    """Let an error carry a user-facing message alongside a technical detail.

    A dict detail is already the response body ({"error": ..., "detail": ...}),
    so it is emitted as-is; every other detail keeps FastAPI's default
    {"detail": ...} envelope.
    """
    body = exc.detail if isinstance(exc.detail, dict) else {"detail": exc.detail}
    return JSONResponse(status_code=exc.status_code, content=body, headers=exc.headers)


# One runner per configured LLM provider (not one runner overall) -- ADK ties
# a runner to a single fixed agent/model, and trying Gemini, then Grok, then
# Mistral in turn (see run_travel_agent below) means each needs its own
# runner+agent pair. Sessions are still created per-request, so concurrent
# plans never share conversation history regardless of which provider they
# land on. RUNNERS is in the same fallback order as PROVIDER_CHAIN.
RUNNERS = [(name, InMemoryRunner(agent=agent, app_name=APP_NAME)) for name, agent in PROVIDER_CHAIN]

# The overall per-plan budget (AGENT_RUN_TIMEOUT_S) split evenly across
# however many providers are actually configured, so a single-provider setup
# keeps the full budget on that one provider (no behaviour change from before
# this feature existed) while a 3-provider chain gives each attempt a fair
# slice instead of letting one hang eat the whole budget.
PROVIDER_TIMEOUT_S = AGENT_RUN_TIMEOUT_S / max(1, len(RUNNERS))


# QA findings (brutal-qa-report.md):
# - travellers<=0 reached the full agent pipeline (and burned an LLM call)
#   before failing with a 503 -- ge=1 rejects it at the request boundary
#   instead, as a fast, free 422.
# - travellers=999999 was accepted outright; the run "succeeded" but with no
#   costBreakdown and an LLM-authored "not feasible" summary standing in for
#   real validation. le=20 is a generous but real ceiling for a single trip
#   booking, not a load-bearing business rule -- raise it if a real use case
#   needs more.
# - budgetINR<=0 hit the same masked-by-quota 500 path as the above; gt=0
#   makes the rejection explicit and immediate regardless of quota state.
# - startDate/endDate were plain strings with no format check at all --
#   "notadate" reached the pressure gate and got a fabricated-looking 200
#   back from the backend (see pressure.controller.js's own fix), which then
#   persisted a corrupted TRIPS draft. Validated here too so the rejection
#   happens before any backend call, not just after.
_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _parse_calendar_date(value: str, field_name: str) -> str:
    if not _DATE_RE.match(value):
        raise ValueError(f"{field_name} must be in YYYY-MM-DD format")
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        raise ValueError(f"{field_name} must be a real calendar date")
    if parsed.isoformat() != value:
        raise ValueError(f"{field_name} must be a real calendar date")
    return value


class PlanTripRequest(BaseModel):
    userId: str
    origin: str
    destId: str
    startDate: str
    endDate: str
    travellers: int = Field(ge=1, le=20)
    budgetINR: float = Field(gt=0)
    interests: Dict[str, float] = Field(default_factory=dict)

    @field_validator("startDate", "endDate")
    @classmethod
    def _valid_calendar_date(cls, value: str, info) -> str:
        return _parse_calendar_date(value, info.field_name)

    @model_validator(mode="after")
    def _end_not_before_start(self):
        if date.fromisoformat(self.endDate) < date.fromisoformat(self.startDate):
            raise ValueError("endDate must not be before startDate")
        return self


class ChosenAlternative(BaseModel):
    """The alternative the traveller picked, as identified by the client.

    Only the identifying fields are read. A place option is identified by
    destId, a date option by startDate; everything else about the offer
    (pressure, savingINR) is taken from the stored draft rather than from here,
    so a client cannot claim a saving or a destination that was never offered.
    """

    destId: Optional[str] = None
    startDate: Optional[str] = None


class ConfirmTripRequest(BaseModel):
    tripDraftId: str
    decision: Literal["accept", "decline"]
    chosenAlternative: Optional[ChosenAlternative] = None


def pressure_score(pressure: Any) -> Optional[float]:
    """Return the comparable score from a get_pressure response, else None.

    None covers every case where there is no number to test against the gate:
    an explicitly null score (all components failed), an untracked destination
    or bad date (a "message" body with no score key), and a transport failure
    ({"ok": False, "error": ...}). None is never treated as low pressure — it
    means the gate cannot be evaluated, so planning proceeds as it did before
    gating existed rather than blocking the traveller on a reading we
    do not have.
    """
    if not isinstance(pressure, dict):
        return None
    score = pressure.get("score")
    # bool is an int subclass; a True here would otherwise compare as 1.0.
    if isinstance(score, bool) or not isinstance(score, (int, float)):
        return None
    return float(score)


def build_prompt(req: PlanTripRequest) -> str:
    if req.interests:
        interests = ", ".join(
            f"{name} (weight {weight})" for name, weight in req.interests.items()
        )
    else:
        interests = "none specified"

    return (
        f"Plan a trip from {req.origin} to destination ID {req.destId}, "
        f"travelling from {req.startDate} to {req.endDate} for {req.travellers} "
        f"traveller(s) with a total budget of INR {req.budgetINR}. "
        f"Traveller interests: {interests}. "
        "Use the tools to gather real data and fill in the trip summary."
    )


def extract_structured_output(event: Any) -> Optional[dict]:
    """Return the TripSummary payload carried by a final response event.

    The agent has an output_schema, so its final event carries the summary as
    a JSON text part. Non-final events (tool calls, tool results, partial
    streaming chunks) carry no structured output and yield None.
    """
    if not event.is_final_response():
        return None

    content = getattr(event, "content", None)
    if content is None or not getattr(content, "parts", None):
        return None

    for part in content.parts:
        text = getattr(part, "text", None)
        if not text:
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


async def _run_with_runner(runner: InMemoryRunner, req: PlanTripRequest) -> dict:
    """Run one provider's agent to completion and return its structured TripSummary.

    Raises LookupError if the run finished without producing structured output.
    """
    session = await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id=req.userId,
    )

    message = types.Content(
        role="user",
        parts=[types.Part(text=build_prompt(req))],
    )

    result: Optional[dict] = None
    async for event in runner.run_async(
        user_id=req.userId,
        session_id=session.id,
        new_message=message,
    ):
        # Keep the last structured payload: a run can emit more than one final
        # response, and the latest one is the completed summary.
        structured = extract_structured_output(event)
        if structured is not None:
            result = structured

    if result is None:
        raise LookupError("agent run produced no structured TripSummary output")

    return result


async def run_travel_agent(req: PlanTripRequest) -> dict:
    """Run the trip-planning agent, falling through RUNNERS in order
    (Gemini -> Grok -> Mistral, whichever are configured) until one succeeds.

    A provider "fails" for this purpose if it raises anything at all (bad/
    missing API key, rate limit, provider-side 5xx, malformed response...) or
    exceeds its PROVIDER_TIMEOUT_S slice -- either way it's logged and the
    next provider gets a turn with a fresh session. Only once every configured
    provider has failed does this raise, re-raising whichever exception the
    LAST attempt produced so plan_or_500's existing error translation
    (TimeoutError/LookupError -> 503, anything else -> 500) still applies
    unchanged to a fully-exhausted chain.
    """
    last_exc: Optional[BaseException] = None
    for name, runner in RUNNERS:
        try:
            result = await asyncio.wait_for(_run_with_runner(runner, req), timeout=PROVIDER_TIMEOUT_S)
        except Exception as exc:  # noqa: BLE001 -- deliberately broad: any provider failure falls through
            logger.warning("plan-trip: provider %r failed (%s: %s), trying next", name, type(exc).__name__, exc)
            last_exc = exc
            continue
        if name != RUNNERS[0][0]:
            logger.warning("plan-trip: recovered via provider %r after an earlier provider failed", name)
        return result

    raise last_exc if last_exc is not None else LookupError("no LLM provider configured")


async def plan_or_500(req: PlanTripRequest) -> dict:
    """Run the agent, translating its failures into HTTP errors."""
    try:
        return await asyncio.wait_for(run_travel_agent(req), timeout=AGENT_RUN_TIMEOUT_S)
    except asyncio.TimeoutError as exc:
        logger.warning("plan timed out after %ss", AGENT_RUN_TIMEOUT_S)
        raise HTTPException(
            status_code=503,
            detail={
                "error": PLAN_FAILED_MESSAGE,
                "detail": f"agent run exceeded {AGENT_RUN_TIMEOUT_S}s and was cancelled",
            },
        ) from exc
    except LookupError as exc:
        # The run completed but produced nothing usable: a transient dead end,
        # not a broken request, so 503 rather than 500.
        logger.warning("plan failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail={"error": PLAN_FAILED_MESSAGE, "detail": str(exc)},
        ) from exc
    except Exception as exc:
        # Unclassified, so it may well be our own defect: 500 stays. The full
        # traceback goes to the server log; the response keeps only the one-line
        # cause, behind the same user-facing message.
        logger.exception("agent run failed")
        raise HTTPException(
            status_code=500,
            detail={
                "error": PLAN_FAILED_MESSAGE,
                "detail": f"agent run failed: {type(exc).__name__}: {exc}",
            },
        ) from exc


async def _run_plan_trip(req: PlanTripRequest) -> dict:
    # get_pressure and find_alternatives are blocking `requests` calls, so they
    # go to a worker thread instead of stalling the event loop for every other
    # in-flight plan.
    pressure = await run_in_threadpool(get_pressure, req.destId, req.startDate)
    score = pressure_score(pressure)

    if score is None or score < PRESSURE_GATE:
        return await plan_or_500(req)

    alternatives = await run_in_threadpool(
        find_alternatives,
        req.origin,
        req.destId,
        req.startDate,
        req.endDate,
        req.travellers,
        req.budgetINR,
        req.interests,
    )

    # The agent is deliberately not run on this branch. Building a plan for a
    # destination we are about to suggest replacing wastes a full agent run,
    # and the traveller's answer decides what gets planned.
    trip_draft_id = await run_in_threadpool(
        trip_drafts.save_draft,
        request=req.model_dump(),
        pressure=pressure,
        alternatives=alternatives,
    )

    return {
        "status": "awaiting_decision",
        "tripDraftId": trip_draft_id,
        "pressure": pressure,
        "alternatives": alternatives,
    }


@app.post("/api/plan-trip")
async def plan_trip(req: PlanTripRequest):
    try:
        return await asyncio.wait_for(_run_plan_trip(req), timeout=AGENT_RUN_TIMEOUT_S)
    except asyncio.TimeoutError as exc:
        logger.warning("plan-trip pre-agent phase exceeded %ss", AGENT_RUN_TIMEOUT_S)
        raise HTTPException(
            status_code=503,
            detail={
                "error": PLAN_FAILED_MESSAGE,
                "detail": f"request exceeded {AGENT_RUN_TIMEOUT_S}s and was cancelled",
            },
        ) from exc


def match_offer(
    alternatives: Any,
    chosen: ChosenAlternative,
    original_dest_id: str,
) -> Tuple[str, dict]:
    """Find the stored offer the traveller picked.

    Returns (kind, offer) where kind is "place" or "date". Raises HTTPException
    400 when the pick does not correspond to something that was actually
    offered, so a confirm cannot plan against a destination or date this draft
    never proposed.
    """
    places = alternatives.get("places") or [] if isinstance(alternatives, dict) else []
    dates = alternatives.get("dates") or [] if isinstance(alternatives, dict) else []

    if chosen.destId and chosen.destId != original_dest_id:
        for place in places:
            if place.get("destId") == chosen.destId:
                return "place", place
        raise HTTPException(
            status_code=400,
            detail=f"destId {chosen.destId!r} was not among the offered places",
        )

    if chosen.startDate:
        for option in dates:
            if option.get("startDate") == chosen.startDate:
                return "date", option
        raise HTTPException(
            status_code=400,
            detail=f"startDate {chosen.startDate!r} was not among the offered dates",
        )

    raise HTTPException(
        status_code=400,
        detail=(
            "chosenAlternative must name a different destId, or a startDate "
            "from the offered dates"
        ),
    )


def shift_end_date(start: str, end: str, new_start: str) -> str:
    """Move the trip window to new_start, preserving its length.

    Date options change only the start date, so the end date has to follow or
    the traveller silently gets a shorter or longer trip.
    """
    try:
        length = date.fromisoformat(end) - date.fromisoformat(start)
        return (date.fromisoformat(new_start) + length).isoformat()
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "cannot shift the trip window: startDate and endDate must be "
                f"YYYY-MM-DD ({exc})"
            ),
        ) from exc


@app.post("/api/plan-trip/confirm")
async def confirm_trip(req: ConfirmTripRequest):
    draft = await run_in_threadpool(trip_drafts.get_draft, req.tripDraftId)
    if draft is None:
        raise HTTPException(
            status_code=404, detail=f"no trip draft {req.tripDraftId!r}"
        )

    original = PlanTripRequest(**draft["request"])
    pressure_before = pressure_score(draft["pressure"])

    if req.decision == "decline":
        plan_request = original
        redistribution: Dict[str, Any] = {"kind": "none"}
    else:
        if req.chosenAlternative is None:
            raise HTTPException(
                status_code=400,
                detail="chosenAlternative is required when decision is 'accept'",
            )

        kind, offer = match_offer(
            draft["alternatives"], req.chosenAlternative, original.destId
        )

        if kind == "place":
            plan_request = original.model_copy(update={"destId": offer["destId"]})
        else:
            new_start = offer["startDate"]
            plan_request = original.model_copy(
                update={
                    "startDate": new_start,
                    "endDate": shift_end_date(
                        original.startDate, original.endDate, new_start
                    ),
                }
            )

        # Re-read pressure for what will actually be planned rather than
        # trusting the score quoted in the offer, which was computed when the
        # draft was created and is client-visible in between.
        after_reading = await run_in_threadpool(
            get_pressure, plan_request.destId, plan_request.startDate
        )
        pressure_after = pressure_score(after_reading)
        if pressure_after is None:
            pressure_after = pressure_score(offer)

        redistribution = {
            "kind": kind,
            "pressureBefore": pressure_before,
            "pressureAfter": pressure_after,
            "savingINR": offer.get("savingINR", 0),
        }

    trip = await plan_or_500(plan_request)

    record = {
        **plan_request.model_dump(),
        "tripDraftId": req.tripDraftId,
        "trip": trip,
        "redistribution": redistribution,
        "alternativesOffered": True,
    }
    await run_in_threadpool(trip_drafts.save_trip, req.tripDraftId, record)
    return record


@app.post("/onboarding/transcribe")
async def transcribe_endpoint(audio: UploadFile = File(...)) -> dict:
    """
    bharani-tasks.md Section 1.2/1.6 -- real contract this must satisfy,
    matching backend/src/services/onboarding/transcription.js's
    transcribeFn: given raw audio bytes, return
    { transcript: string, detectedLanguage: string }.
    """
    audio_bytes = await audio.read()
    try:
        # transcribe() is blocking CPU/GPU work — run it off the event loop
        # so one in-flight transcription doesn't stall every other request
        # (plan_trip/confirm_trip already follow this same pattern above).
        return await run_in_threadpool(run_transcription, audio_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"transcription failed: {exc}") from exc


# bharani-tasks.md Section 1.3 -- structured extraction from a transcript.
# Deliberately NOT built on the ADK Agent/tools framework travel_agent.py
# uses: this is a single structured-output call (transcript in, one strict
# JSON object out), not a multi-step tool-calling run, so a raw
# google.genai client call is the right-sized tool here.
#
# response_json_schema (not response_schema) + reading response.text is
# the pattern verified directly against this repo's actual pinned
# google-genai==2.22.0 source (github.com/googleapis/python-genai, tag
# v2.22.0) -- response_schema/.parsed exist in some SDK versions/docs but
# were not independently confirmed for this exact pinned version, so this
# uses only what was verified working.


class PriceRangeINR(BaseModel):
    min: int
    max: int


class ExtractionResult(BaseModel):
    """
    Exactly the schema already validated on the Node side by
    validateExtractionShape() (services/onboarding/extraction.js) --
    this is the contract, not a suggestion; keep both sides in sync.
    """

    name: Optional[str] = None
    type: Optional[Literal["homestay", "guesthouse", "guide", "driver", "cook"]] = None
    capacity: Optional[int] = None
    priceRangeINR: Optional[PriceRangeINR] = None
    amenities: List[str] = Field(default_factory=list)
    meals: List[str] = Field(default_factory=list)
    nearestLandmark: Optional[str] = None
    languages: List[str] = Field(default_factory=list)
    seasonalNotes: Optional[str] = None


class ExtractRequest(BaseModel):
    transcript: str
    language: Optional[str] = None


EXTRACTION_MODEL = os.environ.get("MODEL", "gemini-2.5-flash")

# genai.Client() with no args reads GOOGLE_API_KEY (falling back to
# GEMINI_API_KEY) from the environment automatically -- verified against
# the pinned google-genai==2.22.0 source (_api_client.py's
# get_env_api_key()), same as how travel_agent's ADK Agent picks up
# credentials. Constructed once at import time, not per-request, matching
# the `runner` pattern above.
genai_client = genai.Client()

# The critical rule from the spec, stated explicitly rather than left
# implicit: an LLM asked to "extract details" will happily infer a
# plausible capacity or price range from context/typical-homestay
# knowledge unless told not to. checkExtractionHonesty() on the Node side
# exists to catch exactly this if it slips through, but the prompt itself
# should already be trying hard not to need that safety net.
EXTRACTION_PROMPT_TEMPLATE = """You are extracting structured business-listing details from a transcript of a homestay/guesthouse/guide/driver/cook owner describing their business, for bharani-tasks.md Section 1.3's voice onboarding flow.

Transcript language: {language}
Transcript: {transcript}

Extract ONLY what is explicitly and unambiguously stated in the transcript above. Return null (or an empty list, for list fields) for anything not explicitly stated in the transcript -- do not infer, guess, estimate, or fill in a plausible-sounding value for any field, even if it seems like a reasonable assumption for this kind of business. The transcript is the ONLY source of truth; do not use outside knowledge of typical homestays/guesthouses/guides to fill gaps. If in doubt about whether something was actually said, return null rather than a guess."""


@app.post("/onboarding/extract")
async def extract_endpoint(req: ExtractRequest) -> dict:
    """
    bharani-tasks.md Section 1.3 -- real contract this must satisfy,
    matching backend/src/services/onboarding/extraction.js's extractFn:
    given a transcript (+ detected language), return the strict JSON
    object shape ExtractionResult above.
    """
    prompt = EXTRACTION_PROMPT_TEMPLATE.format(
        language=req.language or "unknown",
        transcript=req.transcript,
    )
    try:
        # generate_content() is a blocking network call -- off the event
        # loop, same reasoning as run_transcription() above.
        response = await run_in_threadpool(
            genai_client.models.generate_content,
            model=EXTRACTION_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_json_schema=ExtractionResult.model_json_schema(),
            ),
        )
        parsed = ExtractionResult.model_validate_json(response.text)
    except ValidationError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"extraction failed: Gemini's output did not match the expected schema: {exc}",
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"extraction failed: {exc}") from exc

    return parsed.model_dump()
