# ai-service/app/agents/travel_agent.py
from pydantic import BaseModel, Field
from typing import List, Optional, Tuple
import logging
import os
from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm
from app.tools.weather import get_weather
from app.tools.trains import get_train_availability
from app.tools.places import search_places
from app.tools.routes import calculate_route
from app.tools.fare import estimate_local_transport
from app.tools.road import search_road_services
from app.tools.pressure import get_pressure
from app.tools.alternatives import find_alternatives, find_alternative_dates
from app.tools.trip_cost import calculate_trip_cost
from app.tools.itinerary import optimize_itinerary
from app.tools.alerts import get_verified_alerts
from app.tools.businesses import search_businesses
from app.tools.user_preferences import get_user_preferences


class WeatherInfo(BaseModel):
    maxTemp: Optional[float] = None
    precipProb: Optional[int] = None

class RouteInfo(BaseModel):
    distanceKm: Optional[float] = None
    durationMinutes: Optional[int] = None

class HotelOption(BaseModel):
    name: str
    rating: Optional[float] = None

class TrainInfo(BaseModel):
    trainNumber: Optional[str] = None
    waitlistDepth: Optional[int] = None
    status: Optional[str] = None

class FareInfo(BaseModel):
    mode: Optional[str] = None
    fareINR: Optional[float] = None

class RoadInfo(BaseModel):
    corridor: Optional[str] = None
    frequencyPerDay: Optional[int] = None

class PressureInfo(BaseModel):
    # None means every component failed to compute -> crowding unknown.
    # Not the same as zero crowding; leave it None rather than guessing.
    score: Optional[float] = None
    components: List[str] = Field(default_factory=list)
    dropped: List[str] = Field(default_factory=list)
    degraded: List[str] = Field(default_factory=list)
    lowConfidence: Optional[bool] = None
    stale: Optional[bool] = None

class AlternativesInfo(BaseModel):
    # An empty `places` is a real state, not a failure -> keep it an empty
    # list and let `dates` still carry a fallback option.
    requested: Optional[dict] = None
    places: List[dict] = Field(default_factory=list)
    dates: List[dict] = Field(default_factory=list)
    relaxedRelief: Optional[bool] = None

class CostBreakdown(BaseModel):
    # Always a computed estimate summed from earlier tool results, never a
    # live quoted price -> `estimate` stays True whenever this is filled in.
    intercity: Optional[float] = None
    accommodation: Optional[float] = None
    food: Optional[float] = None
    activities: Optional[float] = None
    localTransport: Optional[float] = None
    subtotal: Optional[float] = None
    contingency: Optional[float] = None
    grandTotal: Optional[float] = None
    estimate: Optional[bool] = None

class ItineraryDay(BaseModel):
    # An empty stop list for a day is a real result (more days than stops),
    # not a gap to fill in.
    day: Optional[int] = None
    stops: List[dict] = Field(default_factory=list)

class ItineraryInfo(BaseModel):
    days: List[ItineraryDay] = Field(default_factory=list)

class BusinessInfo(BaseModel):
    # growthRank/growthMultipliers come back already computed by the backend
    # ranking -> copy them through untouched, don't recompute or reorder.
    # An empty `businesses` list is a real state (none onboarded there yet),
    # not a gap to fill with invented names.
    name: Optional[str] = None
    type: Optional[str] = None
    growthRank: Optional[float] = None
    growthMultipliers: Optional[dict] = None

class TripSummary(BaseModel):
    weather: Optional[WeatherInfo] = None
    route: Optional[RouteInfo] = None
    hotels: List[HotelOption] = Field(default_factory=list)
    train: Optional[TrainInfo] = None
    fare: Optional[FareInfo] = None
    road: Optional[RoadInfo] = None
    pressure: Optional[PressureInfo] = None
    alternatives: Optional[AlternativesInfo] = None
    costBreakdown: Optional[CostBreakdown] = None
    itinerary: Optional[ItineraryInfo] = None
    businesses: List[BusinessInfo] = Field(default_factory=list)
    summary: str = Field(description="One or two sentence plain-language summary")


logger = logging.getLogger(__name__)

_TOOLS = [get_weather, get_train_availability, search_places, calculate_route, estimate_local_transport, search_road_services, get_pressure, find_alternatives, find_alternative_dates, get_verified_alerts, search_businesses, get_user_preferences, calculate_trip_cost, optimize_itinerary]

# A smaller toolset for Groq specifically -- every tool's function
# declaration (name, description, parameter schema) is sent on EVERY LLM
# call, and each tool call's result then stays in context for every
# subsequent call in the same run, so a 14-tool roster keeps growing an
# already-tight prompt across a multi-step agentic run. Confirmed live: even
# after shrinking the JSON-shape instruction (~1200 tokens saved -- see
# _JSON_SHAPE_INSTRUCTION), a real run's first call fit under Groq's
# on_demand-tier 7000-input-tokens/minute cap for qwen3.8-27b, but a LATER
# call in the same run (after 1-2 tool results had accumulated in context)
# still went over it ("Requested 7238").
#
# Dropped here, none of which cost this agent a TripSummary field on the
# path main.py actually calls it on (the pressure-gated, low-pressure
# branch -- _run_plan_trip in main.py only invokes the agent at all when
# score < PRESSURE_GATE):
#   - find_alternatives / find_alternative_dates: main.py's own pressure
#     gate already runs BEFORE the agent is invoked and handles the
#     alternatives-offered case itself; the agent is never reached on that
#     path, so these two tools have nothing to do inside it either way.
#   - get_verified_alerts / get_user_preferences: neither one's result maps
#     to a field TripSummary actually renders (no "alerts" or "preferences"
#     field exists on it) -- real tool calls with no schema field to show
#     for the tokens they cost.
# If a future change makes any of these load-bearing for Groq's actual
# output, add it back and re-measure against the 7000 TPM ceiling.
_GROQ_TOOLS = [get_weather, get_train_availability, search_places, calculate_route, estimate_local_transport, search_road_services, get_pressure, search_businesses, calculate_trip_cost, optimize_itinerary]

_BASE_INSTRUCTION = """You help plan trips in India. Use the available tools to
    get real data. Never invent prices, distances, durations, availability, or
    waitlist numbers. Only fill in the schema fields you have real tool data for —
    leave others as null rather than guessing.

    calculate_trip_cost only adds up numbers you already have. Call the fare,
    train, hotel and other data tools FIRST, then pass their real values into
    it — never invent a component value or a grand total yourself."""

# Appended only for providers that can't have output_schema enforced at the
# API level (see _build_agent's enforce_output_schema) -- spells out the same
# shape ADK would otherwise have enforced via response_format, as plain
# prompt text instead. extract_structured_output (main.py) just tries
# json.loads() on the final response text either way, so this only changes
# HOW the model is asked to produce that JSON, not how it's read afterward.
#
# Hand-written and deliberately compact -- NOT TripSummary.model_json_schema().
# That full JSON Schema dump (with every $defs entry, type, title, and
# description) runs ~1500 tokens; this runs ~300. On top of this agent's 14
# tool declarations, the difference is what separated a request Groq's
# on-demand tier accepted from one it rejected outright: confirmed live,
# qwen3.8-27b's 7000 input-tokens/minute cap rejected a 7725-token request
# built from the full schema dump, every single time, deterministically (not
# a transient rate limit). If TripSummary's fields ever change, update this
# by hand to match -- it is intentionally NOT auto-generated from the model.
_JSON_SHAPE_INSTRUCTION = """

    Your FINAL reply (after you are done calling tools) must be ONLY a single
    JSON object matching this shape, with no markdown code fence, no
    preamble, and no text before or after it (any field can be null if you
    have no real data for it; never invent a value):

    {
      "weather": {"maxTemp": number|null, "precipProb": int|null} | null,
      "route": {"distanceKm": number|null, "durationMinutes": int|null} | null,
      "hotels": [{"name": string, "rating": number|null}],
      "train": {"trainNumber": string|null, "waitlistDepth": int|null, "status": string|null} | null,
      "fare": {"mode": string|null, "fareINR": number|null} | null,
      "road": {"corridor": string|null, "frequencyPerDay": int|null} | null,
      "pressure": {"score": number|null, "components": [string], "dropped": [string], "degraded": [string], "lowConfidence": bool|null, "stale": bool|null} | null,
      "alternatives": {"requested": object|null, "places": [object], "dates": [object], "relaxedRelief": bool|null} | null,
      "costBreakdown": {"intercity": number|null, "accommodation": number|null, "food": number|null, "activities": number|null, "localTransport": number|null, "subtotal": number|null, "contingency": number|null, "grandTotal": number|null, "estimate": bool|null} | null,
      "itinerary": {"days": [{"day": int|null, "stops": [object]}]} | null,
      "businesses": [{"name": string|null, "type": string|null, "growthRank": number|null, "growthMultipliers": object|null}],
      "summary": "string, one or two sentences"
    }"""


def _build_agent(name: str, model, enforce_output_schema: bool = True, tools=_TOOLS) -> Agent:
    """One Agent per provider, all sharing the same instruction/schema by
    default -- only the model (and, for Groq, the tool roster) differs.

    enforce_output_schema=False builds the agent WITHOUT ADK's output_schema
    (which asks the underlying API for response_format-enforced JSON). Some
    providers' APIs flatly reject combining tool-calling with response_format
    in the same call regardless of model (confirmed live for Groq -- every
    model tried returned "json mode cannot be combined with tool/function
    calling", a server-side rejection, not a client/litellm quirk). For those,
    the same JSON shape is requested via plain prompt text instead
    (_JSON_SHAPE_INSTRUCTION) and parsed the same way on the way out -- a
    malformed response is then just a normal "provider failed" case that
    falls through to the next provider in PROVIDER_CHAIN, the same as any
    other failure.

    tools defaults to the full _TOOLS roster; Groq is built with the smaller
    _GROQ_TOOLS instead (see its definition for why) to stay under a tight
    per-account token-per-minute ceiling across a multi-tool-call run.
    """
    return Agent(
        name=name,
        model=model,
        instruction=_BASE_INSTRUCTION + ("" if enforce_output_schema else _JSON_SHAPE_INSTRUCTION),
        tools=tools,
        output_schema=TripSummary if enforce_output_schema else None,
    )


# Multi-provider fallback chain -- Groq is primary; Mistral and Gemini are
# fallbacks, in that order. A provider only joins the chain if its own API
# key is actually set -- never claim a provider is available when it isn't
# configured, the same convention this project already uses for the mailer
# (backend/src/lib/mailer.js's isConfigured check) and the pressure engine's
# degraded-source handling. main.py runs these in order at request time,
# falling through to the next entry on any error, timeout, or empty result
# -- see run_travel_agent there.
#
# Gemini was primary originally but was dropped to a low-priority fallback
# (GOOGLE_API_KEY is unset in this deployment's .env) after repeatedly
# hitting its free-tier's 20-calls/day quota during this feature's own
# testing. Its block stays in the code, last, so re-adding a key later
# brings it back without a code change -- it just won't outrank Groq again
# unless this ordering is deliberately changed.
#
# Non-Gemini models go through ADK's LiteLLM integration
# (google.adk.models.lite_llm.LiteLlm), which needs the `google-adk[extensions]`
# extra (see requirements.txt) rather than the base `google-adk` install.
# LiteLLM's own provider-prefix convention picks the SDK: "groq/..." for Groq
# (reads GROQ_API_KEY), "mistral/..." for Mistral (reads MISTRAL_API_KEY).
#
# This is Groq (groq.com, fast inference hosting for open models), NOT xAI's
# "Grok" model -- confirmed live during this feature's build that a key
# someone had saved as "the Grok key" was actually a Groq key (its gsk_...
# prefix is Groq's own format; it was rejected outright by api.x.ai and
# worked against api.groq.com). The two names are easy to mix up and are
# completely different products/accounts/billing -- if xAI's actual Grok is
# ever wanted instead, that's a different provider prefix ("xai/") and a
# different env var (XAI_API_KEY), not a rename of this block.
#
# Both underlying model names are overridable via env var since provider
# model names change faster than this file should need editing.
PROVIDER_CHAIN: List[Tuple[str, Agent]] = []

if os.environ.get("GROQ_API_KEY"):
    # qwen/qwen3.8-27b, not one of Groq's "reasoning" models (e.g.
    # openai/gpt-oss-*): those emit a `reasoning_content` field on their own
    # assistant turns that Groq's API then rejects when ADK echoes that same
    # turn back as conversation history on the next tool-calling round --
    # confirmed live ("property 'reasoning_content' is unsupported"). Plain
    # instruct models like this one don't have that problem. Not every Groq
    # model supports tool-calling at all (allam-2-7b: "tool calling is not
    # supported with this model") -- confirmed live too.
    groq_model = os.environ.get("GROQ_MODEL", "groq/qwen/qwen3.8-27b")
    # enforce_output_schema=False: Groq's API rejects tools + response_format
    # together on every model tested -- see _build_agent's docstring.
    # tools=_GROQ_TOOLS: the smaller roster, to stay under Groq's tight
    # per-account token-per-minute ceiling -- see _GROQ_TOOLS's definition.
    PROVIDER_CHAIN.append((
        "groq",
        _build_agent("travel_planner_groq", LiteLlm(model=groq_model), enforce_output_schema=False, tools=_GROQ_TOOLS),
    ))
else:
    logger.warning("GROQ_API_KEY not set -- Groq (primary provider) excluded from the trip-planning provider chain")

if os.environ.get("MISTRAL_API_KEY"):
    mistral_model = os.environ.get("MISTRAL_MODEL", "mistral/mistral-small-latest")
    PROVIDER_CHAIN.append((
        "mistral",
        _build_agent("travel_planner_mistral", LiteLlm(model=mistral_model)),
    ))

if os.environ.get("GOOGLE_API_KEY"):
    PROVIDER_CHAIN.append((
        "gemini",
        _build_agent("travel_planner_gemini", os.environ.get("MODEL", "gemini-2.5-flash")),
    ))

if not PROVIDER_CHAIN:
    raise RuntimeError(
        "No LLM provider configured -- set at least one of GROQ_API_KEY, "
        "MISTRAL_API_KEY, GOOGLE_API_KEY in ai-service/.env"
    )

logger.info("Trip-planning provider chain: %s", [name for name, _ in PROVIDER_CHAIN])

# Back-compat: anything importing `travel_agent` directly (test_agent.py's
# manual smoke test) still gets a real Agent -- the highest-priority
# configured provider, i.e. the same one main.py tries first.
travel_agent = PROVIDER_CHAIN[0][1]
