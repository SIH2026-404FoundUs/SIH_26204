# app/main.py
#
# The orchestration entrypoint the spec describes: parse preferences -> get
# pressure -> gate on >=0.60 -> offer alternatives and WAIT for a decision ->
# on accept rebuild against the chosen alternative, on decline keep the
# original destination -> run the LLM-driven planner for the rest of the
# itinerary -> validate its output -> return.
#
# The pressure gate itself is deterministic Python code, not something the
# LLM is trusted to reliably enforce from a prompt instruction alone — this
# mirrors the same philosophy the spec already applies to calculate_trip_cost
# (arithmetic the model must never be asked to do). The LLM is only ever
# invoked for the parts that genuinely need language understanding and tool
# orchestration (search/compare/summarize), never for the redirect decision.
#
# "WAIT for user decision" is realized as two HTTP calls against one stateless
# endpoint: the first call (no `decision` field) returns the pressure reading
# and alternatives and stops there; the caller resubmits with `decision` and,
# if accepting, `selected_dest_id`/`selected_date` to continue.

import json
import os
import uuid
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.agents.travel_agent import travel_agent, TripSummary
from app.tools.pressure import get_pressure
from app.tools.alternatives import find_alternatives

load_dotenv()

app = FastAPI(title="Travel Planner Agent")

# The frontend (Vite dev server) calls this service directly from the
# browser, not proxied through the Express backend -- without this the
# browser blocks every /plan request as a cross-origin failure.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("CLIENT_URL", "http://localhost:5173")],
    allow_methods=["*"],
    allow_headers=["*"],
)

_genai_client = None
def _client():
    global _genai_client
    if _genai_client is None:
        _genai_client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
    return _genai_client

PRESSURE_GATE = 0.60


class PlanRequest(BaseModel):
    user_id: str
    dest_id: str
    start_date: str
    end_date: str
    origin: str
    travellers: int = 1
    budget_inr: float = 0.0
    interests: dict = {}
    # Second call only, after the caller has seen alternatives:
    decision: Optional[str] = None  # "accept" | "decline"
    selected_dest_id: Optional[str] = None
    selected_date: Optional[str] = None


def _redistribution(kind: str, from_dest: str, to_dest: str = None, to_date: str = None) -> dict:
    row = {"kind": kind}
    if kind != "none":
        row["from"] = from_dest
        row["to"] = to_dest
        if to_date:
            row["toDate"] = to_date
    return row


async def _run_agent_once(prompt: str, user_id: str, extra_message: str = None) -> tuple[Optional[dict], list]:
    """Runs the LLM planner once and returns (parsed_json_or_None, raw_events).
    Never raises on bad model output OR a transient upstream failure (e.g. a
    503 from the model API) -- both are "this attempt didn't produce usable
    output" and are handled identically by the caller's retry/fallback logic,
    per spec section 3. A crashed attempt must not crash the whole request."""
    runner = InMemoryRunner(agent=travel_agent, app_name="travel_planner")
    session = await runner.session_service.create_session(
        app_name=runner.app_name, user_id=user_id
    )
    full_prompt = prompt if not extra_message else f"{prompt}\n\n{extra_message}"
    events = []
    final_text = None
    try:
        async for event in runner.run_async(
            user_id=user_id,
            session_id=session.id,
            new_message=types.Content(role="user", parts=[types.Part(text=full_prompt)]),
        ):
            events.append(event)
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if getattr(part, "text", None):
                        final_text = part.text
    except Exception as e:
        print(f"[agent] attempt failed: {type(e).__name__}: {e}")
        return None, events

    if final_text is None:
        return None, events
    try:
        parsed = json.loads(final_text)
    except (json.JSONDecodeError, TypeError):
        return None, events
    return parsed, events


def _validate(parsed: Optional[dict]) -> tuple[Optional[TripSummary], Optional[str]]:
    """Returns (TripSummary, None) on success or (None, error_message) on failure."""
    if parsed is None:
        return None, "model did not return valid JSON"
    try:
        return TripSummary.model_validate(parsed), None
    except ValidationError as e:
        return None, str(e)


def _deterministic_fallback(dest_id: str, events: list) -> TripSummary:
    """Assembles a TripSummary purely from tool results already returned in
    this conversation -- never asks the model again, never fabricates a
    number or fact that didn't come from a real tool call. Section 3: 'must
    be deterministic and must not fabricate information.'"""
    collected = {}
    for event in events:
        if not event.content or not event.content.parts:
            continue
        for part in event.content.parts:
            fr = getattr(part, "function_response", None)
            if fr and isinstance(fr.response, dict) and fr.response.get("ok"):
                collected[fr.name] = fr.response.get("data")

    weather = collected.get("get_weather")
    route = collected.get("calculate_route")
    cost = collected.get("calculate_trip_cost")
    itinerary = collected.get("optimize_itinerary")

    return TripSummary(
        weather={"maxTemp": weather.get("maxTemp"), "precipProb": weather.get("precipProb")} if weather else None,
        route={"distanceKm": route.get("distanceKm"), "durationMinutes": route.get("durationMinutes")} if route else None,
        costBreakdown=cost if cost else None,
        itinerary={"days": itinerary.get("days", [])} if itinerary else None,
        summary=(
            f"Automated summary for {dest_id}: the planner's narrative output "
            f"could not be validated twice in a row, so this is assembled "
            f"directly from the tool results that did come back successfully. "
            f"Some fields may be empty if that tool wasn't reached."
        ),
    )


@app.post("/plan")
async def plan_trip(req: PlanRequest):
    pressure_row = get_pressure(req.dest_id, req.start_date)
    score = pressure_row.get("score") if isinstance(pressure_row, dict) else None
    gate_triggered = isinstance(score, (int, float)) and score >= PRESSURE_GATE

    target_dest_id = req.dest_id
    target_date = req.start_date
    redistribution = {"kind": "none"}
    alternatives_offered = False

    if gate_triggered:
        alternatives_offered = True
        if req.decision is None:
            # WAIT: hand back the reading + alternatives, do not proceed further.
            alts = find_alternatives(
                origin=req.origin, dest_id=req.dest_id,
                start_date=req.start_date, end_date=req.end_date,
                travellers=req.travellers, budget_inr=req.budget_inr,
                interests=req.interests,
            )
            return {
                "status": "awaiting_decision",
                "pressure": pressure_row,
                "alternatives": alts,
                "alternativesOffered": True,
                "message": (
                    f"{req.dest_id} is at pressure {score:.2f} (>= {PRESSURE_GATE} threshold). "
                    "Resubmit this request with decision:'accept' (+ selected_dest_id/selected_date) "
                    "or decision:'decline' to continue anyway."
                ),
            }
        if req.decision == "accept":
            if not req.selected_dest_id:
                return {"status": "error", "message": "selected_dest_id is required when decision='accept'"}
            redistribution = _redistribution(
                "date" if req.selected_dest_id == req.dest_id else "place",
                req.dest_id, req.selected_dest_id, req.selected_date,
            )
            target_dest_id = req.selected_dest_id
            target_date = req.selected_date or req.start_date
        elif req.decision == "decline":
            redistribution = {"kind": "none"}
            target_dest_id = req.dest_id
            target_date = req.start_date
        else:
            return {"status": "error", "message": "decision must be 'accept' or 'decline'"}

    prompt = (
        f"Plan a trip to destination id '{target_dest_id}' from {target_date} to "
        f"{req.end_date}, starting from '{req.origin}', for {req.travellers} traveller(s), "
        f"budget INR {req.budget_inr}. Interests: {json.dumps(req.interests)}. "
        f"Use the available tools to gather real weather, route, cost, and itinerary data, "
        f"then produce the structured TripSummary output."
    )

    parsed, events = await _run_agent_once(prompt, req.user_id)
    result, error = _validate(parsed)

    if result is None:
        # Retry ONCE, with the validation error appended (spec section 3).
        parsed, events = await _run_agent_once(
            prompt, req.user_id,
            extra_message=f"Your previous response failed schema validation: {error}. "
                          f"Return ONLY valid JSON matching the TripSummary schema.",
        )
        result, error = _validate(parsed)

    used_fallback = False
    if result is None:
        result = _deterministic_fallback(target_dest_id, events)
        used_fallback = True

    return {
        "status": "ok",
        "destId": target_dest_id,
        "date": target_date,
        "pressureAtRequest": pressure_row,
        "redistribution": redistribution,
        "alternativesOffered": alternatives_offered,
        "usedDeterministicFallback": used_fallback,
        "plan": result.model_dump(),
    }


@app.get("/health")
async def health():
    return {"ok": True}


# --- Internal AI endpoints consumed by the Node backend's feedback/alerts
# services (backend/src/services/feedback/{feedbackService,translationService}.js).
# "Qwen3" in the original spec text isn't provisioned anywhere in this repo
# (no Qwen SDK, no key, no endpoint) -- these use the Gemini access that IS
# actually wired and working (see travel_agent.py), behind the same clean
# adapter boundary the spec asks for. Each Node-side caller already falls
# back to its own offline heuristic if this service is unreachable, so an
# outage here degrades gracefully rather than breaking feedback processing.

class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "en"
    source_lang: str = "auto"

@app.post("/internal/ai/translate")
async def translate(req: TranslateRequest):
    prompt = (
        f"Translate the following text to language code '{req.target_lang}'. "
        f"Reply with ONLY the translated text, no quotes, no explanation.\n\n{req.text}"
    )
    try:
        response = _client().models.generate_content(model="gemini-3.6-flash", contents=prompt)
        return {"translated_text": (response.text or "").strip(), "detected_source_lang": req.source_lang}
    except Exception as e:
        return {"error": f"AI service call failed: {type(e).__name__}: {e}"}


class FeedbackReview(BaseModel):
    comment: str
    rating: Optional[float] = None

class FeedbackThemesRequest(BaseModel):
    reviews: list[FeedbackReview]

class FeedbackTheme(BaseModel):
    theme: str
    sentiment: str
    mentions: int
    evidenceIdx: list[int]

class FeedbackAction(BaseModel):
    action: str
    effort: str
    impact: str

class FeedbackThemesResponse(BaseModel):
    themes: list[FeedbackTheme]
    actions: list[FeedbackAction]

@app.post("/internal/ai/feedback-themes")
async def feedback_themes(req: FeedbackThemesRequest):
    """Spec §3.2: one LLM call, strict JSON {themes, actions}. Reviews must
    already be in English (translate first) -- this endpoint does not
    translate. evidenceIdx must reference real indices into `reviews`; the
    model is instructed never to invent a comment that isn't there."""
    numbered = "\n".join(f"[{i}] (rating {r.rating}): {r.comment}" for i, r in enumerate(req.reviews))
    prompt = (
        "You are analyzing real tourist feedback for one business. Extract recurring "
        "themes and suggest actions. Rules:\n"
        "- Only include a theme if it is mentioned in 3 or more reviews.\n"
        "- evidenceIdx MUST be the real [index] numbers of reviews that mention the theme -- "
        "never invent an index that isn't in the input, never invent review content.\n"
        "- sentiment is 'positive' or 'negative' based on the reviews mentioning that theme.\n"
        "- actions: effort and impact are each 'low', 'medium', or 'high'.\n\n"
        f"Reviews:\n{numbered}\n\n"
        'Respond with ONLY JSON matching: {"themes":[{"theme":str,"sentiment":str,"mentions":int,"evidenceIdx":[int]}],'
        '"actions":[{"action":str,"effort":str,"impact":str}]}'
    )
    try:
        response = _client().models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        parsed = json.loads(response.text)
        validated = FeedbackThemesResponse.model_validate(parsed)
        return validated.model_dump()
    except (json.JSONDecodeError, ValidationError, TypeError) as e:
        return {"error": f"model output failed validation: {e}"}
    except Exception as e:
        # Covers upstream failures (quota, network, 5xx) -- a clean error
        # response, not a crash, so the Node-side caller's own fallback to
        # the keyword heuristic engages instead of propagating a 500.
        return {"error": f"AI service call failed: {type(e).__name__}: {e}"}
