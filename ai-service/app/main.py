# ai-service/app/main.py
import asyncio
from io import BytesIO
import json
import logging
import os
import re
import requests
import time
from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Literal, Optional, Tuple
from urllib.parse import quote

import litellm
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import (
    BaseModel,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from starlette.exceptions import HTTPException as StarletteHTTPException

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DEFAULT_MODEL = "vertex_ai/gemini-2.5-flash"


# Keep the response contract local so importing this API does not construct
# the optional ADK agent.
class WeatherInfo(BaseModel):
    maxTemp: Optional[float] = None
    precipProb: Optional[int] = None
    # Beyond Open-Meteo's ~16-day forecast horizon there is no forecast to
    # serve, so the provider falls back to the climate model's value for that
    # calendar date. source says which one this is ("forecast" or
    # "seasonal-normal") so the UI can caveat an expectation rather than
    # presenting it as a prediction. precipMm carries the climate model's
    # rainfall, which is millimetres and NOT interchangeable with precipProb.
    precipMm: Optional[float] = None
    source: Optional[str] = None


class RouteInfo(BaseModel):
    distanceKm: Optional[float] = None
    durationMinutes: Optional[int] = None


class HotelOption(BaseModel):
    name: str
    rating: Optional[float] = None
    photoUrl: Optional[str] = None
    # placeId is Google's stable identifier for the place, carried through from
    # the Places text search so the frontend can deep-link or re-query without
    # a second search. photoReference is the raw "places/<id>/photos/<id>" name
    # that photoUrl is built from; both stay None when Places returned neither.
    placeId: Optional[str] = None
    photoReference: Optional[str] = None


class RoadInfo(BaseModel):
    corridor: Optional[str] = None
    frequencyPerDay: Optional[int] = None


class PressureInfo(BaseModel):
    score: Optional[float] = None
    # The pressure service returns per-signal detail keyed by component name,
    # not a list of names: {"access": {"value": ..., "source": ...}, ...}.
    components: Dict[str, Any] = Field(default_factory=dict)
    dropped: List[str] = Field(default_factory=list)
    degraded: List[str] = Field(default_factory=list)
    lowConfidence: Optional[bool] = None
    stale: Optional[bool] = None


class ItineraryDay(BaseModel):
    day: Optional[int] = None
    stops: List[dict] = Field(default_factory=list)


class ItineraryInfo(BaseModel):
    days: List[ItineraryDay] = Field(default_factory=list)


class BusinessInfo(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    growthRank: Optional[float] = None
    growthMultipliers: Optional[dict] = None


class TripSummary(BaseModel):
    weather: Optional[WeatherInfo] = None
    route: Optional[RouteInfo] = None
    hotels: List[HotelOption] = Field(default_factory=list)
    train: Optional[dict] = None
    fare: Optional[dict] = None
    road: Optional[RoadInfo] = None
    pressure: Optional[PressureInfo] = None
    alternatives: Optional[dict] = None
    costBreakdown: Optional[dict] = None
    itinerary: Optional[ItineraryInfo] = None
    businesses: List[BusinessInfo] = Field(default_factory=list)
    alerts: List[dict] = Field(default_factory=list)
    # Why a section of this trip is empty, when it is empty for a reason the
    # traveller should see. An exhausted Places quota and a destination that
    # genuinely has no listed stays both produce hotels: [] -- without this the
    # UI cannot tell them apart and shows "no listings" for both.
    dataIssues: List[str] = Field(default_factory=list)
    summary: str
    # One short practical paragraph for the whole trip, written by the LLM from
    # the deterministic data below. None whenever that call failed, timed out,
    # or was skipped — never a placeholder string, so the UI can tell "no tips"
    # apart from "tips that happen to be empty".
    travel_tips: Optional[str] = None


from app.onboarding.extraction_prompt import build_extraction_prompt
from app.onboarding.transcribe import run_transcription
from app.services import trip_drafts
from app.tools.alternatives import find_alternative, find_alternative_dates, find_alternatives
from app.tools.alerts import get_verified_alerts
from app.tools.businesses import search_businesses
from app.tools.places import search_places
from app.tools.pressure import get_pressure
from app.tools.road import search_road_services
from app.tools.routes import calculate_route
from app.tools.weather import get_weather
from app.tools.fare import estimate_local_transport
from app.services.backend_client import get as backend_get, post as backend_post
from app.tools.itinerary import optimize_itinerary
from app.pdf_builder import build_travel_brief_pdf

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
#
# Keep a hard ceiling around the deterministic backend/tool fan-out as well as
# the confirmation path. Every individual backend client call is also bounded.
AGENT_RUN_TIMEOUT_S = 180

def _authenticate_with_backend(cookie_header: str) -> Optional[str]:
    if not cookie_header:
        return None
    try:
        response = requests.get(
            f"{os.environ.get('BACKEND_URL', 'http://localhost:5001')}/api/auth/check",
            headers={"Cookie": cookie_header, "Connection": "close"},
            timeout=5,
        )
        if response.status_code == 200:
            user_id = response.json().get("_id")
            if user_id:
                return str(user_id)
    except requests.RequestException:
        pass
    return None

async def authenticated_user_id(request: Request) -> Optional[str]:
    return await run_in_threadpool(_authenticate_with_backend, request.headers.get("cookie", ""))

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


def _response_data(response: Any) -> Any:
    """Unwrap the backend's {ok, data, meta} envelope when present."""
    if not isinstance(response, dict):
        return None
    if response.get("ok") is False:
        return None
    return response.get("data", response)


def _normalise_weather(value: Any) -> Optional[dict]:
    """Return the PDF/UI weather contract from provider or legacy shapes.

    Open-Meteo is exposed by Express as ``{ok, data: {maxTemp, precipProb}}``.
    Older saved plans and a few provider adapters used ``temperature`` or
    ``maxTemperature`` instead.  Normalising once here prevents a valid
    forecast from disappearing when it crosses a service boundary.
    """
    value = _response_data(value)
    if not isinstance(value, dict):
        return None
    max_temp = next((value.get(key) for key in (
        "maxTemp", "max_temp", "maxTemperature", "temperature", "temperatureMax"
    ) if value.get(key) is not None), None)
    precip = next((value.get(key) for key in (
        "precipProb", "precip_prob", "precipitationProbability", "precipitation_probability"
    ) if value.get(key) is not None), None)
    if max_temp is None and precip is None:
        return None
    return {
        "maxTemp": max_temp,
        "precipProb": precip,
        # Carried through so the UI can label a climate-model expectation as
        # such instead of presenting it as a forecast. Absent on legacy saved
        # plans, which is why both default to None rather than to "forecast".
        "precipMm": value.get("precipMm"),
        "source": value.get("source"),
    }


def _place_items(value: Any) -> list:
    # Callers pass either the raw {ok, data, meta} envelope or the already
    # unwrapped payload, so this has to be idempotent. _response_data returns
    # None for a non-dict, which means unwrapping an already-unwrapped list
    # silently threw the whole list away: the planner did exactly that for
    # attractions (_place_items(_response_data(...))) and every trip came back
    # with zero stops while hotels -- which use inline list handling -- worked
    # fine. Take the list branch before unwrapping.
    if isinstance(value, list):
        return value
    value = _response_data(value)
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        items = value.get("places", value.get("results", []))
        return items if isinstance(items, list) else []
    return []


def _search_places_with_fallback(queries: list, lat: float, lng: float) -> dict:
    """Try equivalent Places queries until one returns actual places.

    Google Text Search can return zero results for a grammatically valid query
    such as ``hotels in Nagarjuna Sagar, Nalgonda, Telangana``.  That is a
    search-result miss, not proof that the destination has no stays.  Keep the
    provider response shape intact while trying narrower/alternate wording.

    Only a genuine zero-result answer is worth rewording. When the provider
    itself fails -- an exhausted daily quota, a key blocked for the Places API,
    a network error -- every reworded variant will fail identically, so trying
    them just burns three times the quota (or three times the latency) to
    arrive at the same failure. Bail on the first hard failure instead and let
    the caller report it as "lookup unavailable" rather than "no results".
    """
    last = {"ok": True, "data": [], "meta": {"source": "googlemaps", "confidence": "low"}}
    for query in queries:
        result = search_places(query, lat, lng)
        last = result if isinstance(result, dict) else last
        if isinstance(result, dict) and result.get("ok") is False:
            return result
        items = _place_items(result)
        if items:
            return result
    return last


def _curated_fallback_stops(dest_id: str, destination: dict, lat: float, lng: float) -> list:
    """Return named, destination-specific stops only when Places is unavailable.

    These are not invented anonymous map pins: they are the well-known
    attractions used by the product's destination catalogue. Coordinates are
    deliberately kept at the destination anchor when no verified place
    coordinates are available, so the PDF remains useful without claiming a
    false route geometry.

    A destination with no curated entry gets an EMPTY list, not a generated
    one. The previous default produced names like "Manali, Himachal Pradesh
    main attractions" and "... local food stop" -- strings that read like real
    stops in the itinerary and the PDF but name no actual place, pinned at the
    destination centroid. An honest empty day the UI can explain beats a plan
    full of places that do not exist.
    """
    curated = {
        "nagarjuna-sagar": [
            "Nagarjuna Sagar Dam",
            "Nagarjunakonda Island Museum",
            "Buddhavanam Buddhist Heritage Park",
            "Ethipothala Waterfall",
            "Krishna river sunset viewpoint",
            "Local Telangana lunch near Nagarjuna Sagar",
            "Nagarjuna Sagar reservoir boat-viewing area",
            "Nagarjuna Sagar local market and breakfast stop",
            "Evening riverside dinner near the dam",
        ],
    }.get(dest_id, [])
    return [{"name": name, "lat": lat, "lng": lng, "source": "destination-catalogue"} for name in curated]


def _destination(dest_id: str) -> Optional[dict]:
    result = _response_data(backend_get("/api/destinations", {}))
    if not isinstance(result, list):
        return None
    return next((item for item in result if item.get("_id") == dest_id or item.get("id") == dest_id), None)


def _location(destination: dict) -> Optional[Tuple[float, float]]:
    location = destination.get("location") or {}
    lat, lng = location.get("lat"), location.get("lng")
    if lat is None or lng is None:
        coordinates = location.get("coordinates") or []
        if len(coordinates) >= 2:
            lng, lat = coordinates[:2]
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return float(lat), float(lng)
    return None


# One LLM call per trip, hard-bounded. _deterministic_summary is otherwise
# entirely LLM-free by design, so this budget is deliberately tight: travel
# tips are a garnish on a plan that must still be served if the model is slow
# or down. Well under AGENT_RUN_TIMEOUT_S so a slow model degrades this one
# field rather than the whole request.
TRAVEL_TIPS_TIMEOUT_S = 12

# The recommendation overlay is interactive — the traveller is looking at the
# card while this resolves — so it gets a shorter leash than the tips call.
RECOMMENDATION_TIMEOUT_S = 10

# Ask AI is intentionally stateless at the service layer. The browser sends
# the current trip plus a small local conversation window on every request.
# This process-local limiter protects a demo deployment from accidental loops
# and keeps one user from exhausting the model quota.
CHAT_RATE_WINDOW_S = 10 * 60
CHAT_RATE_LIMIT = 20
CHAT_MAX_MESSAGE_CHARS = 500
CHAT_MAX_HISTORY_MESSAGES = 8
CHAT_TIMEOUT_S = 15
_chat_rate_buckets: Dict[str, List[float]] = {}


class TravelTipsResult(BaseModel):
    """A single practical paragraph for the whole trip."""

    travel_tips: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=CHAT_MAX_MESSAGE_CHARS)


class ChatRequest(BaseModel):
    request: Dict[str, Any] = Field(default_factory=dict)
    trip: Dict[str, Any]
    question: str = Field(min_length=1, max_length=CHAT_MAX_MESSAGE_CHARS)
    history: List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    answer: str


def _chat_rate_key(request: Request, authenticated_id: Optional[str]) -> str:
    if authenticated_id:
        return f"user:{authenticated_id}"
    return f"ip:{request.client.host if request.client else 'unknown'}"


def _check_chat_rate_limit(key: str) -> None:
    now = time.monotonic()
    recent = [stamp for stamp in _chat_rate_buckets.get(key, []) if now - stamp < CHAT_RATE_WINDOW_S]
    if len(recent) >= CHAT_RATE_LIMIT:
        _chat_rate_buckets[key] = recent
        raise HTTPException(
            status_code=429,
            detail="Ask AI is temporarily rate-limited. Please try again in a few minutes.",
            headers={"Retry-After": str(int(CHAT_RATE_WINDOW_S))},
        )
    recent.append(now)
    _chat_rate_buckets[key] = recent


def _trip_chat_context(req: ChatRequest) -> str:
    """Serialize only the supplied trip data; the model must not fetch/invent."""
    context = {
        "request": req.request,
        "trip": req.trip,
    }
    return json.dumps(context, ensure_ascii=False, default=str)


async def _generate_travel_tips(
    destination_name: str,
    req: PlanTripRequest,
    itinerary: dict,
    weather: Any,
    pressure: Any,
) -> Optional[str]:
    """Write one short practical paragraph for the trip, or None on any failure.

    Called once per plan — never once per stop or per day — and every number it
    is allowed to mention is supplied here. EXTRACTION_MODEL is defined further
    down with the other LLM endpoints; it is read at call time, not import time.
    """
    prompt = (
        "You are a practical Indian travel advisor. Write ONE short paragraph "
        "(45-70 words) of practical advice for this specific trip: what to "
        "pack, the best time of day to start, any weather-related caution, and "
        "a brief budget note. Use only the supplied data. Never invent a "
        "temperature, price, crowd level, place, or opening time that is not "
        "given below. If the weather or crowding data is missing, simply do "
        "not mention it. Plain prose, no bullet points, no headings.\n\n"
        f"Destination: {destination_name}\n"
        f"Dates: {req.startDate} to {req.endDate}\n"
        f"Travellers: {req.travellers}\n"
        f"Total budget (INR): {req.budgetINR}\n"
        f"Weather: {weather}\n"
        f"Crowd pressure (0-1, higher is busier): {pressure_score(pressure)}\n"
        f"Day-by-day itinerary: {itinerary}"
    )
    try:
        response = await asyncio.wait_for(
            litellm.acompletion(
                model=EXTRACTION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format=TravelTipsResult,
                temperature=0.3,
            ),
            timeout=TRAVEL_TIPS_TIMEOUT_S,
        )
        parsed = TravelTipsResult.model_validate_json(
            response.choices[0].message.content
        )
        return parsed.travel_tips.strip() or None
    except asyncio.TimeoutError:
        logger.warning("travel tips timed out after %ss; continuing without them", TRAVEL_TIPS_TIMEOUT_S)
        return None
    except Exception:
        # Every failure mode is the same failure mode here: the trip is built
        # and valid, it just has no tips. Logged, never raised.
        logger.warning("travel tips generation failed; continuing without them", exc_info=True)
        return None


# Fallback nightly rate when a destination carries no seeded baseline. Same
# value the Express alternatives route falls back to (alternatives.route.js
# budgetFn), so a cost quoted on the swap card and a cost quoted on the trip
# card cannot disagree.
DEFAULT_HOTEL_MEDIAN_INR = 3500
DEFAULT_FOOD_PER_PERSON_PER_DAY_INR = 600
# Road transport is estimated from the route distance actually computed for
# this trip rather than from a flat guess, at a per-km rate that covers fuel
# plus the usual hill-road surcharge. Round trip, hence the doubling.
TRANSPORT_INR_PER_KM = 9


async def _build_cost_breakdown(
    req: PlanTripRequest,
    destination: dict,
    hotels: List[dict],
    route: Any,
    trip_days: int,
) -> Optional[dict]:
    """Price the trip through the backend's own budget service.

    Every category is sent with an explicit `source` so the breakdown says
    where each number came from rather than presenting estimates as quotes.
    The hotel line is the real shortlisted stay's name when Places returned
    one, priced off the destination's seeded median (Places does not return
    room rates), so an empty shortlist degrades the label but not the maths.

    Returns None on any failure — a trip with no costing is still a trip, and
    this must never be the reason a plan fails.
    """
    try:
        nights = max(1, trip_days - 1)
        # Two to a room is the standard assumption the seeded baselines are
        # built around; 3 travellers therefore need 2 rooms, not 1.5.
        rooms = max(1, -(-req.travellers // 2))
        baseline = destination.get("baseline") if isinstance(destination.get("baseline"), dict) else {}
        price_per_night = baseline.get("hotelMedianINR") or DEFAULT_HOTEL_MEDIAN_INR

        distance_km = route.get("distanceKm") if isinstance(route, dict) else None
        transport_total = (
            round(float(distance_km) * TRANSPORT_INR_PER_KM * 2)
            if isinstance(distance_km, (int, float)) and distance_km > 0
            else None
        )

        body = {
            "destId": req.destId,
            "travellers": req.travellers,
            "days": trip_days,
            "budgetINR": req.budgetINR,
            "hotel": {
                "pricePerNight": price_per_night,
                "nights": nights,
                "rooms": rooms,
                "name": hotels[0]["name"] if hotels else None,
                "source": "seeded",
            },
            "food": {
                "pricePerPersonPerDay": DEFAULT_FOOD_PER_PERSON_PER_DAY_INR,
                "source": "estimated",
            },
        }
        if transport_total is not None:
            body["transport"] = {"totalCost": transport_total, "source": "estimated"}

        result = await run_in_threadpool(backend_post, "/api/v1/budget/calculate", body)
        if not isinstance(result, dict) or result.get("error"):
            logger.warning("budget calculation returned no usable result: %s", result)
            return None
        return result
    except Exception:
        logger.warning("budget calculation failed; serving trip without a cost breakdown", exc_info=True)
        return None


# Hill and small-town roads, with stops, average well below highway speed.
# Used only to turn a local sightseeing distance into a ride duration for the
# cab fare, which is time-priced as well as distance-priced -- fareEstimator
# explicitly asks callers to supply a duration rather than let it default to
# 0, which would quote a floor instead of a fare.
LOCAL_AVERAGE_SPEED_KMH = 25


def _haversine_km(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    """Great-circle distance in km between two (lat, lng) pairs."""
    from math import asin, cos, radians, sin, sqrt

    lat1, lng1 = radians(a[0]), radians(a[1])
    lat2, lng2 = radians(b[0]), radians(b[1])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * 6371.0088 * asin(sqrt(h))


def _stop_coordinates(stop: Any) -> Optional[Tuple[float, float]]:
    """Pull (lat, lng) off either itinerary entry shape, or None."""
    if not isinstance(stop, dict):
        return None
    source = stop.get("location") if isinstance(stop.get("location"), dict) else stop
    lat, lng = source.get("lat"), source.get("lng")
    if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
        return float(lat), float(lng)
    return None


def _local_travel_km(itinerary: dict) -> float:
    """Total on-the-ground km across the itinerary, hotel-to-stop-to-hotel.

    This is deliberately NOT the origin-to-destination route distance. The
    fare seeds price auto/cab/metro/bus at city rates; applying those to a
    537km intercity leg would produce a wildly wrong number. Local transport
    means the daily loop out from the stay and back, which is exactly what
    each day's stop sequence already describes.
    """
    total = 0.0
    for day in (itinerary or {}).get("days") or []:
        if not isinstance(day, dict):
            continue
        points = [c for c in (_stop_coordinates(s) for s in day.get("stops") or []) if c]
        total += sum(_haversine_km(points[i], points[i + 1]) for i in range(len(points) - 1))
    return total


async def _build_local_fare(dest_id: str, itinerary: dict) -> Optional[dict]:
    """Estimate local transport cost for the whole trip's ground movement.

    Returns None when there is nothing to price -- with no verified stops the
    daily loop has zero length, and a 0 fare would read as "local transport is
    free" rather than "we do not know your stops yet".
    """
    try:
        distance_km = _local_travel_km(itinerary)
        if distance_km <= 0:
            return None
        duration_min = round(distance_km / LOCAL_AVERAGE_SPEED_KMH * 60)
        result = await run_in_threadpool(
            estimate_local_transport, dest_id, "cab", round(distance_km, 1), duration_min
        )
        data = _response_data(result)
        if not isinstance(data, dict):
            return None
        # Keep the provider's own honesty flags (generic-rate fallback,
        # duration-included) travelling with the number.
        meta = result.get("meta") if isinstance(result, dict) else None
        return {**data, "assumedDurationMin": duration_min, "meta": meta}
    except Exception:
        logger.warning("local fare estimate failed; serving trip without one", exc_info=True)
        return None


def _build_access_info(destination: dict) -> Optional[dict]:
    """Seeded rail/air access context for the destination.

    This is NOT seat availability. RailRadar's endpoint prices a *specific
    train number* between two station codes, and nothing in this system knows
    which trains serve a given corridor -- there is no train-search API here
    and no seeded train numbers. Rather than invent a train, report the access
    facts the destination seed genuinely has and say plainly that availability
    was not checked.
    """
    railhead = destination.get("nearestRailhead")
    airport = destination.get("nearestAirport")
    if not railhead and not airport:
        return None
    return {
        "nearestRailhead": railhead,
        "railheadDistanceKm": destination.get("railheadDistanceKm"),
        "nearestAirport": airport,
        "seatAvailabilityChecked": False,
        "note": (
            "Seat availability needs a specific train number; this service can "
            "only report the nearest railhead."
        ),
    }


def _photo_url(photo_name: Any) -> Optional[str]:
    """Build the backend photo-proxy URL for a Places photo name.

    Returns None — never raises and never invents a URL — when Places gave us
    no photo for this place. Callers store the None as-is: the PDF builder's
    _image() and the frontend both already treat a missing photo as "render
    the placeholder", so an absent photo degrades to a layout gap, not an
    error. The name is percent-encoded because it contains slashes and
    provider-generated tokens; places.route.js decodes it before its
    "places/" prefix check.
    """
    if not isinstance(photo_name, str) or not photo_name.startswith("places/"):
        return None
    return f"/api/places/photo?name={quote(photo_name, safe='')}"


def _photo_fields(item: dict) -> dict:
    """The placeId/photo trio to merge onto a hotel, stop or itinerary entry."""
    photo_name = item.get("photoName")
    return {
        "placeId": item.get("placeId"),
        "photoReference": photo_name if isinstance(photo_name, str) else None,
        "photoUrl": _photo_url(photo_name),
    }


def _attach_photos(itinerary: dict, photos_by_name: Dict[str, dict]) -> dict:
    """Merge photo/placeId fields onto every itinerary entry, in place.

    Deliberately a post-pass over optimize_itinerary's output rather than a
    change to the itinerary engine itself: the engine builds each visit from a
    fixed field list and drops anything else, so enriching here keeps day
    splitting untouched and keeps this feature to one file. Entries come in two
    shapes — a visit carries its own name, a hotel anchor nests it under
    "location" — so both are looked up. An entry whose place has no photo is
    left exactly as it was.
    """
    if not isinstance(itinerary, dict):
        return itinerary
    for day in itinerary.get("days") or []:
        if not isinstance(day, dict):
            continue
        for entry in day.get("stops") or []:
            if not isinstance(entry, dict):
                continue
            location = entry.get("location")
            name = (
                location.get("name")
                if isinstance(location, dict)
                else entry.get("name")
            )
            fields = photos_by_name.get(name) if isinstance(name, str) else None
            if not fields:
                continue
            # Only write keys that actually carry a value, so an entry for a
            # place with no photo keeps the shape it had before this pass.
            entry.update({key: value for key, value in fields.items() if value is not None})
    return itinerary


async def _deterministic_summary(req: PlanTripRequest) -> dict:
    """Build a TripSummary from backend/tool results without an LLM."""
    destination = _destination(req.destId)
    if destination is None:
        raise LookupError(f"destination {req.destId!r} was not found")
    coordinates = _location(destination)
    if coordinates is None:
        raise LookupError(f"destination {req.destId!r} has no coordinates")

    lat, lng = coordinates
    origin_result = _response_data(backend_get("/api/geocode", {"address": req.origin}))
    if not isinstance(origin_result, dict):
        raise LookupError(f"could not geocode origin {req.origin!r}")
    origin_lat, origin_lng = origin_result.get("lat"), origin_result.get("lng")

    destination_name = destination.get('displayName', req.destId)
    calls = [
        run_in_threadpool(get_weather, lat, lng, req.startDate),
        run_in_threadpool(
            _search_places_with_fallback,
            [
                f"hotels in {destination_name}",
                f"hotels near {destination_name}",
                f"guest houses near {destination_name}",
            ],
            lat,
            lng,
        ),
        run_in_threadpool(
            _search_places_with_fallback,
            [
                f"tourist attractions in {destination_name}",
                f"places to visit near {destination_name}",
                f"landmarks near {destination_name}",
            ],
            lat,
            lng,
        ),
        run_in_threadpool(search_road_services, req.destId),
        run_in_threadpool(search_businesses, req.destId),
        run_in_threadpool(get_verified_alerts, req.destId, req.startDate, req.endDate),
    ]
    if isinstance(origin_lat, (int, float)) and isinstance(origin_lng, (int, float)):
        calls.append(run_in_threadpool(calculate_route, origin_lat, origin_lng, lat, lng))
    results = await asyncio.gather(*calls, return_exceptions=True)

    weather = _normalise_weather(results[0]) if not isinstance(results[0], Exception) else None
    hotels_raw = _response_data(results[1]) if not isinstance(results[1], Exception) else None
    stops_raw = _response_data(results[2]) if not isinstance(results[2], Exception) else None
    road = _response_data(results[3]) if not isinstance(results[3], Exception) else None
    businesses = _response_data(results[4]) if not isinstance(results[4], Exception) else None
    alerts = _response_data(results[5]) if not isinstance(results[5], Exception) else None
    route_index = 6
    route = _response_data(results[route_index]) if len(results) > route_index and not isinstance(results[route_index], Exception) else None

    # Places normally returns a list through the backend envelope, but keep the
    # planner tolerant of provider adapters that return {places: [...]} or
    # {results: [...]} so a valid response is not silently rendered as zero.
    hotel_items = hotels_raw if isinstance(hotels_raw, list) else (
        hotels_raw.get("places", hotels_raw.get("results", []))
        if isinstance(hotels_raw, dict) else []
    )
    hotels = [
        {
            "name": item.get("name", ""),
            "rating": item.get("rating"),
            **_photo_fields(item),
        }
        for item in hotel_items
        if isinstance(item, dict)
        if item.get("name")
    ]
    # A provider failure and a genuine empty result both arrive as an empty
    # list further down, so capture the distinction here while the envelope
    # is still intact.
    data_issues: List[str] = []

    def _note_lookup_failure(raw_result: Any, label: str) -> None:
        if isinstance(raw_result, Exception):
            data_issues.append(f"{label} lookup failed: {raw_result}")
            return
        if isinstance(raw_result, dict) and raw_result.get("ok") is False:
            reason = raw_result.get("error") or "provider unavailable"
            if "Quota exceeded" in str(reason):
                reason = "the daily Google Places quota is exhausted"
            elif "blocked" in str(reason):
                reason = "this API key is not authorised for the Places API"
            data_issues.append(f"{label} could not be loaded: {reason}")

    _note_lookup_failure(results[1], "Stays")
    _note_lookup_failure(results[2], "Attractions")

    stop_items = _place_items(stops_raw)
    stops = [
        {
            "name": item.get("name"),
            "lat": item.get("lat"),
            "lng": item.get("lng"),
            **_photo_fields(item),
        }
        for item in stop_items
        if isinstance(item, dict)
        if item.get("name") and isinstance(item.get("lat"), (int, float)) and isinstance(item.get("lng"), (int, float))
    ]
    # Dates are inclusive in the UI: Dec 26-28 is a three-day trip, not two.
    trip_days = max(1, (date.fromisoformat(req.endDate) - date.fromisoformat(req.startDate)).days + 1)
    # Keep enough attractions for morning/afternoon/evening blocks. The old
    # one-stop-per-day cap was the reason a three-day trip could only ever show
    # start/end plus one visit per day.
    stops = stops[:trip_days * 3]
    if not stops:
        stops = _curated_fallback_stops(req.destId, destination, lat, lng)
    # Always return a day-by-day itinerary. A missing hotel result should not
    # erase the itinerary; use the destination as the day anchor and keep the
    # hotels list empty so the UI can truthfully say that stays were unavailable.
    stay_anchor = {
        "name": hotels[0]["name"] if hotels else destination.get("displayName", req.destId),
        "lat": lat,
        "lng": lng,
    }
    itinerary = optimize_itinerary(stops, stay_anchor, trip_days)
    if "error" in itinerary:
        itinerary = {"days": []}

    # The photo for every place in this trip was already returned by the two
    # Places searches above (the field mask asks for places.photos), so this
    # index costs no extra API call — it just stops the itinerary from throwing
    # away identity the search already paid for. Hotels are indexed after stops
    # so the stay's own photo wins for the day-anchor entries.
    photos_by_name = {
        place["name"]: {
            "placeId": place.get("placeId"),
            "photoReference": place.get("photoReference"),
            "photoUrl": place.get("photoUrl"),
        }
        for place in [*stops, *hotels]
        if isinstance(place.get("name"), str)
    }
    itinerary = _attach_photos(itinerary, photos_by_name)

    pressure = await run_in_threadpool(get_pressure, req.destId, req.startDate)
    score = pressure_score(pressure)
    if score is None:
        summary = f"A trip to {destination.get('displayName', req.destId)} was prepared, but crowding data is unavailable."
    else:
        level = "high" if score >= PRESSURE_GATE else "low"
        summary = f"A trip to {destination.get('displayName', req.destId)} was prepared with {level} crowd pressure ({score:.2f})."

    cost_breakdown = await _build_cost_breakdown(req, destination, hotels, route, trip_days)
    local_fare = await _build_local_fare(req.destId, itinerary)
    access = _build_access_info(destination)

    travel_tips = await _generate_travel_tips(
        destination.get("displayName", req.destId), req, itinerary, weather, pressure
    )

    payload = {
        "weather": weather,
        "route": route,
        "hotels": hotels,
        "train": access,
        "fare": local_fare,
        "road": road,
        "pressure": pressure,
        "alerts": alerts if isinstance(alerts, list) else [],
        "alternatives": None,
        "costBreakdown": cost_breakdown,
        "itinerary": itinerary,
        "businesses": businesses if isinstance(businesses, list) else [],
        "dataIssues": data_issues,
        "summary": summary,
        "travel_tips": travel_tips,
    }
    return TripSummary.model_validate(payload).model_dump()


async def plan_or_500(req: PlanTripRequest) -> dict:
    """Run deterministic planning, translating failures into HTTP errors."""
    try:
        return await asyncio.wait_for(_deterministic_summary(req), timeout=AGENT_RUN_TIMEOUT_S)
    except asyncio.TimeoutError as exc:
        logger.warning("deterministic plan timed out after %ss", AGENT_RUN_TIMEOUT_S)
        raise HTTPException(
            status_code=503,
            detail={
                "error": PLAN_FAILED_MESSAGE,
                "detail": f"planning exceeded {AGENT_RUN_TIMEOUT_S}s and was cancelled",
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
        logger.exception("deterministic plan failed")
        raise HTTPException(
            status_code=500,
            detail={
                "error": PLAN_FAILED_MESSAGE,
                "detail": f"planning failed: {type(exc).__name__}: {exc}",
            },
        ) from exc


async def _build_swap_offers(req: PlanTripRequest) -> Optional[dict]:
    """Build non-blocking swap-card data after a valid trip has been generated.

    Destination and date checks intentionally use the original request in
    parallel. If both produce a candidate, the combined pressure is read once
    for that candidate pair; it is never calculated by subtracting two scores.
    """
    try:
        destination_pressure_task = run_in_threadpool(get_pressure, req.destId, req.startDate)
        date_pressure_task = run_in_threadpool(get_pressure, req.destId, req.startDate)
        destination_pressure, date_pressure = await asyncio.gather(
            destination_pressure_task, date_pressure_task
        )
        destination_score = pressure_score(destination_pressure)
        date_score = pressure_score(date_pressure)

        destination_task = (
            run_in_threadpool(find_alternative, req.model_dump())
            if destination_score is not None and destination_score >= PRESSURE_GATE
            else None
        )
        date_task = (
            run_in_threadpool(find_alternative_dates, req.model_dump())
            if date_score is not None and date_score >= PRESSURE_GATE
            else None
        )
        destination_swap, date_swap = await asyncio.gather(
            destination_task or asyncio.sleep(0, result=None),
            date_task or asyncio.sleep(0, result=None),
        )
        if not destination_swap and not date_swap:
            return None

        combined = None
        if destination_swap and date_swap:
            combined_start = date_swap["alternative_dates"][0]
            combined_dest = destination_swap["alternative_destination"]
            combined_reading = await run_in_threadpool(
                get_pressure, combined_dest, combined_start
            )
            combined_after = pressure_score(combined_reading)
            combined = {
                "budget_difference": destination_swap["budget_difference"] + date_swap["budget_difference"],
                "pressure_before": destination_swap["pressure_before"],
                "pressure_after": combined_after,
                "reason": list(dict.fromkeys(destination_swap["reason"] + date_swap["reason"])),
            }

        return {
            "destination_swap": destination_swap,
            "date_swap": date_swap,
            "combined": combined,
        }
    except Exception:
        # A swap suggestion is optional enrichment. A provider timeout must not
        # turn an otherwise valid generated trip into a failed trip.
        logger.warning("swap offer generation failed; serving trip without swaps", exc_info=True)
        return None
async def _run_plan_trip(req: PlanTripRequest) -> dict:
    # Always finish the requested trip first. Swap suggestions are optional,
    # dismissible enrichment and must never block the map or force a decision.
    trip = await plan_or_500(req)
    swap_offers = await _build_swap_offers(req)
    if swap_offers:
        trip["alternatives"] = {"swapOffers": swap_offers}
    try:
        trip_id = await run_in_threadpool(
            trip_drafts.save_completed, req.model_dump(), trip
        )
        if trip_id:
            trip["tripId"] = trip_id
    except Exception:
        # History persistence must not make a valid plan unavailable.
        logger.warning("completed trip persistence failed; returning plan", exc_info=True)
    return trip


@app.post("/api/plan-trip")
async def plan_trip(req: PlanTripRequest, authenticated_id: Optional[str] = Depends(authenticated_user_id)):
    if authenticated_id:
        req = req.model_copy(update={"userId": authenticated_id})
    elif not req.userId:
        req = req.model_copy(update={"userId": "guest"})
    try:
        return await asyncio.wait_for(_run_plan_trip(req), timeout=AGENT_RUN_TIMEOUT_S)
    except asyncio.TimeoutError as exc:
        logger.warning("plan-trip deterministic phase exceeded %ss", AGENT_RUN_TIMEOUT_S)
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
async def confirm_trip(req: ConfirmTripRequest, authenticated_id: Optional[str] = Depends(authenticated_user_id)):
    draft = await run_in_threadpool(trip_drafts.get_draft, req.tripDraftId)
    if draft is None:
        raise HTTPException(
            status_code=404, detail=f"no trip draft {req.tripDraftId!r}"
        )

    original = PlanTripRequest(**draft["request"])
    if authenticated_id and original.userId not in ("guest", authenticated_id):
        raise HTTPException(status_code=403, detail="This trip draft belongs to another user")
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
# JSON object out), not a multi-step tool-calling run, so a direct LiteLLM
# call is the right-sized tool here. It goes through LiteLLM rather than a
# provider SDK so this endpoint and the agent stay on one model string and
# one set of credentials. It has no `tools`, so provider-specific
# response_format + tools restrictions do not apply here.
#
# Passing the pydantic class itself as response_format is what LiteLLM
# documents for JSON mode, and was verified against this repo's installed
# litellm 1.95.0: type_to_response_format_param() turns ExtractionResult
# into a strict json_schema payload (additionalProperties: false, every
# property required, $ref siblings stripped) that xAI accepts. Building
# that payload by hand from .model_json_schema() would NOT be strict-valid.


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
    # Name of the REQUIRED_FIELDS_FOR_LIVE field (Node's stateMachine.js)
    # a FOLLOWUP question was just asked about, if this transcript is a
    # reply to one -- e.g. "capacity". None for a spontaneous message with
    # no pending question (the existing, unchanged contract). See
    # build_extraction_prompt()'s docstring for why this matters: a terse
    # reply like "Six" has no stated subject in isolation, and without
    # this hint the "return null if in doubt" rule below means it's
    # likely to extract nothing at all.
    pendingField: Optional[str] = None


class RecommendationRequest(BaseModel):
    trip: Dict[str, Any]
    pressure: Dict[str, Any] = Field(default_factory=dict)
    alternatives: Dict[str, Any] = Field(default_factory=dict)
    weather: Optional[Dict[str, Any]] = None
    hotels: List[Dict[str, Any]] = Field(default_factory=list)
    businesses: List[Dict[str, Any]] = Field(default_factory=list)
    interests: Dict[str, float] = Field(default_factory=dict)


class RecommendationResult(BaseModel):
    explanation: str
    advice: List[str] = Field(default_factory=list)
    reason: str
    # Added alongside the three original fields rather than replacing them:
    # existing consumers of explanation/advice/reason keep working, and a
    # client that cannot render bullets is unaffected. 3-5 short phrases, each
    # quoting a number this service supplied — see _recommendation_facts.
    reasons: List[str] = Field(default_factory=list)


class TravelBriefRequest(BaseModel):
    request: Dict[str, Any] = Field(default_factory=dict)
    trip: Dict[str, Any]


class TravelBriefResult(BaseModel):
    title: str
    summary: str
    explanation: str
    packingChecklist: List[str] = Field(default_factory=list)
    weatherAdvice: List[str] = Field(default_factory=list)
    emergencyContacts: List[str] = Field(default_factory=list)
    safetyTips: List[str] = Field(default_factory=list)
    localEtiquette: List[str] = Field(default_factory=list)
    hiddenGems: List[str] = Field(default_factory=list)
    dayWisePlan: List[str] = Field(default_factory=list)
    thingsToRemember: List[str] = Field(default_factory=list)


# Same model string as the agent (see travel_agent.DEFAULT_MODEL), routed
# through LiteLLM. With the default Vertex AI model, authentication comes from
# Google Application Default Credentials rather than a provider API key.
EXTRACTION_MODEL = os.environ.get("MODEL", DEFAULT_MODEL)

# The critical rule from the spec, stated explicitly rather than left
# implicit: an LLM asked to "extract details" will happily infer a
# plausible capacity or price range from context/typical-homestay
# knowledge unless told not to. checkExtractionHonesty() on the Node side
# exists to catch exactly this if it slips through, but the prompt itself
# should already be trying hard not to need that safety net.
@app.post("/onboarding/extract")
async def extract_endpoint(req: ExtractRequest) -> dict:
    """
    bharani-tasks.md Section 1.3 -- real contract this must satisfy,
    matching backend/src/services/onboarding/extraction.js's extractFn:
    given a transcript (+ detected language, + optional pendingField
    context), return the strict JSON object shape ExtractionResult above.
    """
    prompt = build_extraction_prompt(req.transcript, req.language, req.pendingField)
    try:
        # acompletion() is LiteLLM's natively async entry point, so unlike
        # run_transcription() above this needs no threadpool hop to stay off
        # the event loop.
        response = await litellm.acompletion(
            model=EXTRACTION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            response_format=ExtractionResult,
            temperature=0,
        )
        parsed = ExtractionResult.model_validate_json(
            response.choices[0].message.content
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                f"extraction failed: {EXTRACTION_MODEL}'s output did not match "
                f"the expected schema: {exc}"
            ),
        ) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"extraction failed: {exc}") from exc

    return parsed.model_dump()


def _number(value: Any) -> Optional[float]:
    """Return value as a float, or None if it is not a usable number."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value)


def _recommendation_facts(req: RecommendationRequest) -> List[str]:
    """Flatten the request into a list of already-computed, quotable numbers.

    This is the whole anti-hallucination mechanism for the reasons bullets:
    instead of handing the model raw nested dicts and hoping, every comparison
    the bullets are allowed to make is computed HERE, in Python, from values
    the platform's own services returned. The model's job is reduced to
    phrasing these lines — if a number is not in this list, it does not exist
    as far as the prompt is concerned, and the prompt says so explicitly.

    Any missing input simply produces fewer lines, never a guessed one.
    """
    facts: List[str] = []

    requested = req.alternatives.get("requested") if isinstance(req.alternatives, dict) else None
    requested_name = (
        (requested or {}).get("displayName")
        or (requested or {}).get("destId")
        or req.trip.get("destId")
        or "the requested destination"
    )
    requested_pressure = _number(req.pressure.get("score")) if isinstance(req.pressure, dict) else None
    if requested_pressure is None and isinstance(requested, dict):
        requested_pressure = _number(requested.get("pressure"))
    if requested_pressure is not None:
        facts.append(f"{requested_name} crowd pressure: {round(requested_pressure * 100)}%")

    places = req.alternatives.get("places") or [] if isinstance(req.alternatives, dict) else []
    place = places[0] if places and isinstance(places[0], dict) else None
    if place:
        name = place.get("displayName") or place.get("destId") or "the alternative"
        facts.append(f"Alternative destination: {name}")

        alt_pressure = _number(place.get("pressure"))
        if alt_pressure is not None:
            facts.append(f"{name} crowd pressure: {round(alt_pressure * 100)}%")
            if requested_pressure is not None and requested_pressure > 0:
                # An alternative can legitimately score higher than the
                # original (the engine ranks on similarity and cost too, not
                # crowding alone). Say so plainly rather than emitting a
                # negative "less crowded", which the model would read as a
                # positive.
                drop = requested_pressure - alt_pressure
                relative = round(abs(drop) / requested_pressure * 100)
                if drop > 0:
                    facts.append(
                        f"Crowding difference: {round(drop * 100)} percentage points lower, "
                        f"which is {relative}% less crowded"
                    )
                elif drop < 0:
                    facts.append(
                        f"Crowding difference: {round(-drop * 100)} percentage points higher, "
                        f"which is {relative}% MORE crowded than the original"
                    )
                else:
                    facts.append("Crowding is the same as the original destination")

        saving = _number(place.get("savingINR"))
        if saving is not None and saving != 0:
            direction = "cheaper" if saving > 0 else "more expensive"
            facts.append(f"Cost difference: Rs {abs(round(saving))} {direction} in total")
        for label, key in (("Estimated total cost", "totalCost"), ("Stay cost", "stayCost"), ("Transport cost", "transportCost")):
            amount = _number(place.get(key))
            if amount is not None and amount > 0:
                facts.append(f"{label} at {name}: Rs {round(amount)}")

        hours = _number(place.get("travelTimeHours"))
        if hours is not None and hours > 0:
            facts.append(f"Travel time to {name}: {hours:.1f} hours")
        ratio = _number(place.get("travelTimeRatio"))
        if ratio is not None and ratio > 0:
            if ratio < 0.98:
                facts.append(f"Journey is {round((1 - ratio) * 100)}% shorter than the original")
            elif ratio > 1.02:
                facts.append(f"Journey is {round((ratio - 1) * 100)}% longer than the original")
            else:
                facts.append("Journey length is about the same as the original")

    dates = req.alternatives.get("dates") or [] if isinstance(req.alternatives, dict) else []
    date_option = dates[0] if dates and isinstance(dates[0], dict) else None
    if date_option and date_option.get("startDate"):
        date_pressure = _number(date_option.get("pressure"))
        line = f"Alternative date for the same destination: {date_option['startDate']}"
        if date_pressure is not None:
            line += f" at {round(date_pressure * 100)}% crowd pressure"
        facts.append(line)

    if isinstance(req.weather, dict):
        max_temp = _number(req.weather.get("maxTemp"))
        if max_temp is not None:
            facts.append(f"Forecast high: {max_temp}C")
        precip = _number(req.weather.get("precipProb"))
        if precip is not None:
            facts.append(f"Chance of precipitation: {round(precip)}%")

    if req.hotels:
        facts.append(f"Verified stays found near the alternative: {len(req.hotels)}")
    if req.businesses:
        facts.append(f"Local businesses listed at the alternative: {len(req.businesses)}")

    ranked_interests = sorted(
        ((name, weight) for name, weight in req.interests.items() if _number(weight) is not None),
        key=lambda pair: pair[1],
        reverse=True,
    )
    if ranked_interests:
        facts.append(
            "Traveller interests (0-1): "
            + ", ".join(f"{name} {weight}" for name, weight in ranked_interests[:5])
        )

    return facts


@app.post("/internal/ai/recommendation", response_model=RecommendationResult)
async def recommendation_endpoint(req: RecommendationRequest) -> RecommendationResult:
    """Generate human-facing recommendation copy from deterministic trip data.

    The browser calls this service, never Gemini directly. No routing, weather,
    pressure, price, or business values are generated here; the prompt only
    asks the model to explain values already returned by platform services.
    """
    facts = _recommendation_facts(req)
    prompt = (
        "You are a careful tourism assistant. Explain the recommendation using "
        "ONLY the verified figures listed below. These figures were computed by "
        "the platform's own services. Never invent, estimate, extrapolate or "
        "round differently any price, temperature, crowd level, distance, "
        "travel time, or count. If something is not in the list, do not "
        "mention it at all.\n\n"
        "VERIFIED FIGURES:\n"
        + ("\n".join(f"- {fact}" for fact in facts) if facts else "- (none available)")
        + "\n\nReturn JSON with:\n"
        "- reasons: 3 to 5 very short bullet phrases (max 8 words each) giving "
        "the case for the alternative, e.g. \"60% less crowded\", "
        "\"Rs 1200 cheaper\", \"similar weather\". Every bullet that states a "
        "number must use a number from the list above, unchanged. If fewer "
        "than three figures are available, return only the bullets you can "
        "actually support.\n"
        "- explanation: one sentence of context.\n"
        "- advice: 2-4 short practical tips.\n"
        "- reason: one sentence on why the alternative fits this traveller.\n\n"
        f"Additional context (do not quote numbers from here): trip {req.trip}, "
        f"interests {req.interests}"
    )
    try:
        response = await asyncio.wait_for(
            litellm.acompletion(
                model=EXTRACTION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format=RecommendationResult,
                temperature=0.2,
            ),
            # The overlay renders its deterministic numbers immediately and
            # only swaps in this copy when it arrives, so a slow model must
            # give up rather than leave that request hanging.
            timeout=RECOMMENDATION_TIMEOUT_S,
        )
        return RecommendationResult.model_validate_json(response.choices[0].message.content)
    except asyncio.TimeoutError as exc:
        logger.warning("recommendation timed out after %ss", RECOMMENDATION_TIMEOUT_S)
        raise HTTPException(
            status_code=503,
            detail=f"recommendation unavailable: timed out after {RECOMMENDATION_TIMEOUT_S}s",
        ) from exc
    except Exception as exc:
        logger.exception("recommendation generation failed")
        raise HTTPException(status_code=503, detail=f"recommendation unavailable: {exc}") from exc


@app.post("/internal/ai/chat", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    request: Request,
    authenticated_id: Optional[str] = Depends(authenticated_user_id),
) -> ChatResponse:
    """Answer one trip-aware question using the current trip as grounded context.

    Conversation history is deliberately supplied by the browser and is not
    persisted. The endpoint never calls travel tools: it only explains values
    already present in the current trip payload, which keeps the demo fast and
    prevents a chat question from triggering additional provider costs.
    """
    _check_chat_rate_limit(_chat_rate_key(request, authenticated_id))
    history = req.history[-CHAT_MAX_HISTORY_MESSAGES:]
    messages = [
        {
            "role": "system",
            "content": (
                "You are Sahyatri's trip-aware travel assistant. Answer the user's "
                "question using only the supplied trip context and conversation. "
                "You may compare itinerary timing, hotels, weather, pressure, "
                "route, budget, alerts, and named places that appear in that "
                "context. Do not invent prices, opening hours, restaurant names, "
                "distances, safety conditions, availability, or bookings. If the "
                "context is insufficient, say so clearly and suggest what the "
                "traveller can check next. Keep the answer plain text, practical, "
                "and concise (2-6 sentences).\n\n"
                f"CURRENT TRIP CONTEXT:\n{_trip_chat_context(req)}"
            ),
        },
        *[{"role": item.role, "content": item.content} for item in history],
        {"role": "user", "content": req.question},
    ]
    try:
        response = await asyncio.wait_for(
            litellm.acompletion(
                model=EXTRACTION_MODEL,
                messages=messages,
                temperature=0.3,
            ),
            timeout=CHAT_TIMEOUT_S,
        )
        answer = (response.choices[0].message.content or "").strip()
        if not answer:
            raise ValueError("the model returned an empty answer")
        return ChatResponse(answer=answer)
    except asyncio.TimeoutError as exc:
        logger.warning("chat generation timed out after %ss", CHAT_TIMEOUT_S)
        raise HTTPException(status_code=503, detail="Ask AI took too long to respond. Please try again.") from exc
    except Exception as exc:
        logger.exception("chat generation failed")
        raise HTTPException(status_code=503, detail="Ask AI is temporarily unavailable. Please try again.") from exc


async def _generate_travel_brief(req: TravelBriefRequest) -> TravelBriefResult:
    prompt = (
        # Without this the model writes "weather forecasts indicate 7.3C" for a
        # date months out, where the number is a climate-model normal and no
        # forecast exists. The distinction has to be stated, not inferred from
        # a source field buried in the trip JSON.
        "If trip.weather.source is 'seasonal-normal', the temperature is a "
        "typical seasonal value for that date, NOT a forecast: describe it as "
        "'typical for late December' or 'seasonal average', and never write "
        "'the forecast says'. Only call it a forecast when source is "
        "'forecast'. Note that precipMm is millimetres of rainfall, not a "
        "percentage chance of rain.\n\n"
        "Create a professional, concise travel brief using only the supplied "
        "verified trip data. Never invent a hotel, restaurant, attraction, "
        "business, emergency number, weather value, or itinerary stop. If a "
        "category has no data, return an empty list. Return strict JSON with "
        "title, summary, explanation, packingChecklist, weatherAdvice, "
        "emergencyContacts, safetyTips, localEtiquette, hiddenGems, "
        "dayWisePlan, and thingsToRemember. thingsToRemember should contain "
        "short, actionable reminders grounded only in the trip data, such as "
        "check-in times, time-sensitive visits, weather clothing advice, "
        "cash guidance, closing times, or return-day traffic. Never invent "
        "a fact that is not present or directly supported by the supplied data.\n\n"
        f"Original request: {req.request}\nFinal trip data: {req.trip}"
    )
    response = await litellm.acompletion(
        model=EXTRACTION_MODEL,
        messages=[{"role": "user", "content": prompt}],
        response_format=TravelBriefResult,
        temperature=0.2,
    )
    return TravelBriefResult.model_validate_json(response.choices[0].message.content)


@app.post("/internal/ai/travel-brief", response_model=TravelBriefResult)
async def travel_brief_endpoint(req: TravelBriefRequest) -> TravelBriefResult:
    try:
        return await _generate_travel_brief(req)
    except Exception as exc:
        logger.exception("travel brief generation failed")
        raise HTTPException(status_code=503, detail=f"travel brief unavailable: {exc}") from exc


def _draw_brief_pdf(brief: TravelBriefResult, req: TravelBriefRequest) -> BytesIO:
    """Render a compact, printable travel brief with a trip QR code."""
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.graphics.barcode import qr
    from reportlab.graphics.shapes import Drawing
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    output = BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=16 * mm, leftMargin=16 * mm, topMargin=14 * mm, bottomMargin=14 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle('BriefTitle', parent=styles['Title'], alignment=TA_CENTER, textColor=colors.HexColor('#0f172a'), spaceAfter=6)
    section = ParagraphStyle('BriefSection', parent=styles['Heading2'], textColor=colors.HexColor('#4338ca'), spaceBefore=9, spaceAfter=4)
    body = ParagraphStyle('BriefBody', parent=styles['BodyText'], leading=15, fontSize=9.5, textColor=colors.HexColor('#334155'))
    small = ParagraphStyle('BriefSmall', parent=body, fontSize=8, leading=11, textColor=colors.HexColor('#64748b'))
    story = [Paragraph(brief.title, title), Paragraph(brief.summary, body), Spacer(1, 4)]
    story.append(Paragraph(brief.explanation, body))

    sections = [
        ('Day-wise itinerary', brief.dayWisePlan),
        ('Packing checklist', brief.packingChecklist),
        ('Weather advice', brief.weatherAdvice),
        ('Hotels and hidden gems', brief.hiddenGems),
        ('Safety tips', brief.safetyTips),
        ('Local etiquette', brief.localEtiquette),
        ('Emergency contacts', brief.emergencyContacts),
    ]
    for heading, items in sections:
        if items:
            story.append(Paragraph(heading, section))
            story.append(Paragraph('<br/>'.join(f'- {item}' for item in items), body))

    qr_payload = req.request.get('tripUrl') or f"{CLIENT_URLS[0]}/map?destId={req.request.get('destId', '')}"
    qr_code = qr.QrCodeWidget(qr_payload)
    bounds = qr_code.getBounds()
    qr_drawing = Drawing(28 * mm, 28 * mm, transform=[28 * mm / (bounds[2] - bounds[0]), 0, 0, 28 * mm / (bounds[3] - bounds[1]), 0, 0])
    qr_drawing.add(qr_code)
    footer = Table([[Paragraph('Open this trip in Sahyatri', small), qr_drawing]], colWidths=[135 * mm, 28 * mm])
    footer.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (1, 0), (1, 0), 'RIGHT'), ('TOPPADDING', (0, 0), (-1, -1), 8)]))
    story.extend([Spacer(1, 8), footer])
    doc.build(story)
    output.seek(0)
    return output


# Keep the existing endpoint contract while delegating layout to the reusable
# premium guide builder. The old renderer remains above as a safe local
# fallback/reference during rollout.
def _draw_premium_brief_pdf(brief: TravelBriefResult, req: TravelBriefRequest) -> BytesIO:
    return build_travel_brief_pdf(brief, req.request, req.trip)


@app.post("/internal/travel-brief/pdf")
async def travel_brief_pdf_endpoint(req: TravelBriefRequest):
    try:
        brief = await _generate_travel_brief(req)
        pdf = await run_in_threadpool(_draw_premium_brief_pdf, brief, req)
        return StreamingResponse(pdf, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=sahyatri-travel-brief.pdf"})
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("travel brief PDF generation failed")
        raise HTTPException(status_code=503, detail=f"travel brief PDF unavailable: {exc}") from exc
