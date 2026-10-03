# ai-service/app/agents/travel_agent.py
from pydantic import BaseModel, Field
from typing import List, Optional
import os
from google.adk.agents import Agent, SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from app.tools.weather import get_weather
from app.tools.transport.trains import get_train_availability
from app.tools.places import search_places
from app.tools.transport.routes import calculate_route
from app.tools.transport.fare import estimate_local_transport
from app.tools.transport.road import search_road_services
from app.tools.pressure.pressure import get_pressure
from app.tools.pressure.alternatives import find_alternatives, find_alternative_dates
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


# The ADK talks to Gemini natively and to every other provider through LiteLLM.
# MODEL is therefore a LiteLLM model id ("<provider>/<model>"). Vertex AI is
# configured with Application Default Credentials from the local gcloud CLI.
#
# Gemini supports the agent's tool-calling and structured-output stages without
# local CPU inference or the previous Groq/Ollama limits.
DEFAULT_MODEL = "vertex_ai/gemini-2.5-flash"

_MODEL_ID = os.environ.get("MODEL", DEFAULT_MODEL)


def _make_model() -> LiteLlm:
    """Build the LiteLlm model, applying provider-specific options only.

    Groq's gpt-oss-120b is a reasoning model: by default (and
    unavoidably once tools are involved) Groq returns the model's reasoning
    as a separate field on the assistant message. ADK's multi-turn tool loop
    replays that assistant message back to Groq on the next call, and Groq
    rejects it -- 400 "property 'reasoning_content' is unsupported" -- because
    Groq (unlike DeepSeek/Anthropic reasoning models) does not accept
    reasoning content being echoed back in message history.
    reasoning_format="hidden" is a Groq-specific request parameter, so it is
    only sent when the selected model uses the Groq provider. Vertex AI and
    other providers receive their default LiteLLM options.
    """
    if _MODEL_ID.startswith("groq/"):
        return LiteLlm(model=_MODEL_ID, reasoning_format="hidden")
    return LiteLlm(model=_MODEL_ID)


# Groq's API rejects any request that sets response_format (json_object /
# json_schema) together with `tools` -- a hard platform rule, not a
# per-model limitation (see: "json mode cannot be combined with tool/function
# calling"). Google ADK's LlmAgent, when given both `tools` and
# `output_schema`, sends response_format on every call including the
# tool-calling ones, so a single agent with both attributes 400s on every
# turn against Groq.
#
# The fix is to split the work into two agents run in sequence:
#   1. `_tool_agent` -- has all the data-gathering tools, no output_schema.
#      Its calls never carry response_format, so tool use works normally.
#      It writes its plain-text findings into session state under
#      "raw_findings" (via output_key).
#   2. `_formatter_agent` -- has output_schema=TripSummary, no tools. Its
#      calls never carry `tools`, so response_format works normally. It
#      reads {raw_findings} from state and emits the strict TripSummary
#      JSON that main.py parses.
#
# This mirrors the "separate finalization" pattern other Groq-facing SDKs
# (e.g. TanStack AI's Groq adapter) use for the same platform restriction.

_tool_agent = Agent(
    name="travel_data_gatherer",
    model=_make_model(),
    instruction="""You help plan trips in India. Use the available tools to
    get real data. Never invent prices, distances, durations, availability, or
    waitlist numbers.

    calculate_trip_cost only adds up numbers you already have. Call the fare,
    train, hotel and other data tools FIRST, then pass their real values into
    it -- never invent a component value or a grand total yourself.

    When you have gathered everything you can (or a tool tells you data
    isn't available), write a plain-text summary of every real value you
    found: weather, route, hotels, train status, fares, road options,
    crowding pressure, alternatives, cost breakdown, itinerary, and relevant
    businesses. Be explicit about which fields you have no real data for --
    say so rather than omitting them, so the next step knows to leave them
    null rather than guessing.""",
    tools=[
        get_weather,
        get_train_availability,
        search_places,
        calculate_route,
        estimate_local_transport,
        search_road_services,
        get_pressure,
        find_alternatives,
        find_alternative_dates,
        get_verified_alerts,
        search_businesses,
        get_user_preferences,
        calculate_trip_cost,
        optimize_itinerary,
    ],
    output_key="raw_findings",
)

_formatter_agent = Agent(
    name="travel_formatter",
    model=_make_model(),
    instruction="""You convert trip-planning findings into a strict TripSummary
    JSON object. Here are the findings gathered by data-gathering tools:

    {raw_findings}

    Only fill in the schema fields the findings above give you real data for
    -- leave every other field null rather than guessing or inventing a
    plausible-sounding value. Do not invent prices, distances, durations,
    availability, or waitlist numbers that weren't in the findings.""",
    output_schema=TripSummary,
)

travel_agent = SequentialAgent(
    name="travel_planner",
    sub_agents=[_tool_agent, _formatter_agent],
)
