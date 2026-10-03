"""Focused Phase 1 tourism agent.

This is intentionally separate from the existing full trip planner.  The MVP
root agent has three user-facing capabilities (plan, hotels, places) and can
also call the existing pressure/alternative tools when a question needs them.
"""

import os
from typing import Any

from google.adk.agents import Agent
from google.adk.models.lite_llm import LiteLlm

from app.services.backend_client import get as backend_get
from app.tools.pressure.alternate_tools import get_alternate, get_alternate_dates, get_alternate_tools
from app.tools.places import search_places as search_places_backend
from app.tools.pressure.pressure import get_pressure
from app.tools.user_preferences import get_user_preferences as _get_user_preferences_raw
from app.tools.travel_education import get_destination_education, get_personalized_destination_education
from app.tools.group_travel import (
    search_group_trips as _search_group_trips_raw,
    get_group_trip,
    get_group_match_reasons as _get_group_match_reasons_raw,
    create_group_trip as _create_group_trip_raw,
    join_group_trip as _join_group_trip_raw,
)


DEFAULT_MODEL = "vertex_ai/gemini-2.5-flash"
_MODEL_ID = os.environ.get("MODEL", DEFAULT_MODEL)


def _model() -> LiteLlm:
    if _MODEL_ID.startswith("groq/"):
        return LiteLlm(model=_MODEL_ID, reasoning_format="hidden")
    return LiteLlm(model=_MODEL_ID)


def _destination(dest_id: str) -> dict | None:
    response = backend_get("/api/destinations", {})
    items = response.get("data") if isinstance(response, dict) else response
    if not isinstance(items, list):
        return None
    needle = str(dest_id or "").strip().casefold()
    return next(
        (
            item for item in items
            if str(item.get("_id") or item.get("id") or "").casefold() == needle
            or str(item.get("displayName") or "").casefold() == needle
            or str(item.get("displayName") or "").casefold().startswith(f"{needle},")
        ),
        None,
    )


def _resolve_location(location: str) -> tuple[float, float] | None:
    """Resolve a human place name through destinations, then backend geocoding."""
    destination = _destination(location)
    if destination:
        destination_location = destination.get("location") or {}
        lat, lng = destination_location.get("lat"), destination_location.get("lng")
        if lat is not None and lng is not None:
            return float(lat), float(lng)
        coordinates = destination_location.get("coordinates") or []
        if len(coordinates) >= 2:
            return float(coordinates[1]), float(coordinates[0])

    response = backend_get("/api/geocode", {"address": location})
    payload = response.get("data") if isinstance(response, dict) else None
    if isinstance(payload, dict) and payload.get("lat") is not None and payload.get("lng") is not None:
        return float(payload["lat"]), float(payload["lng"])
    return None


def _search_at(query: str, location: str, radius_meters: int) -> dict:
    coordinates = _resolve_location(location)
    if not coordinates:
        return {"ok": False, "error": f"Could not locate {location!r}."}
    lat, lng = coordinates
    return search_places_backend(query, lat, lng, radius_meters)


def search_hotels(query: str, location: str, radius_meters: int = 20000) -> dict:
    """Find hotels near a normal place name; users never provide coordinates."""
    return _search_at(query or "hotels", location, radius_meters)


def search_places(query: str, location: str, radius_meters: int = 5000) -> dict:
    """Find tourist attractions, restaurants or nearby places by place name."""
    return _search_at(query or "tourist attractions", location, radius_meters)


def plan_trip(
    destination: str,
    start_date: str,
    end_date: str,
    origin: str = "",
    travellers: int = 1,
    budget_inr: float = 0,
    interests: dict | None = None,
) -> dict:
    """Gather the minimum grounded data needed for an MVP trip answer.

    The model receives the result as facts. It must not invent an itinerary,
    hotel price or pressure number when one of these providers has no data.
    """
    destination_row = _destination(destination)
    tracked_destination = bool(destination_row)
    if not destination_row:
        geocode_response = backend_get("/api/geocode", {"address": destination})
        geocoded = geocode_response.get("data") if isinstance(geocode_response, dict) else None
        if not isinstance(geocoded, dict) or geocoded.get("lat") is None or geocoded.get("lng") is None:
            return {"ok": False, "error": f"Could not locate destination: {destination}"}
        destination_row = {
            "id": str(destination).strip().casefold().replace(" ", "-"),
            "displayName": geocoded.get("formattedAddress") or destination,
            "location": {"lat": geocoded["lat"], "lng": geocoded["lng"]},
        }
    location = destination_row.get("displayName") or destination

    trip = {
        "origin": origin,
        "destId": destination,
        "startDate": start_date,
        "endDate": end_date,
        "travellers": travellers,
        "budgetINR": budget_inr,
        "interests": interests or {},
    }
    pressure = get_pressure(destination_row.get("id"), start_date) if tracked_destination else None
    hotels = search_hotels(f"hotels in {location}", location)
    places = search_places("tourist attractions", location)
    destination_swap = get_alternate(trip) if tracked_destination else None
    date_swap = get_alternate_dates(trip) if tracked_destination else None
    return {
        "ok": True,
        "destination": destination_row,
        "pressure": pressure,
        "hotels": hotels,
        "places": places,
        "alternatives": {"destination": destination_swap, "dates": date_swap},
    }


_BASE_INSTRUCTION = """You are Sahyatri's focused multimodal tourism agent.

You support travellers, tourism operators and authorities. Answer in the
language requested by the user: English, Telugu or Hindi. Use tools for real
destination, hotel, attraction, pressure and alternative data. Never invent
hotel prices, ratings, photos, map links, pressure scores, dates, distances or
availability. When data is absent, say it is unavailable.

Use plan_trip for trip-planning requests, search_hotels for stay requests, and
search_places for attractions or nearby places. Pass a human-readable location
such as "Charminar, Hyderabad" or "Hyderabad" to those tools. Never ask the
user for latitude or longitude; the tools resolve coordinates internally using
the backend destination catalogue and geocoding endpoint. Use pressure and the
alternative tools when the user asks why a destination is crowded or whether
another place/date would be better. Keep answers practical and concise.
For nearby-place questions, prefer results within the requested area and
mention only the best 5-8 options instead of dumping the entire provider list.

Travel Education: use get_destination_education (full) or
get_personalized_destination_education (short summary, prefer this one
unless the user clearly wants the full breakdown) when the user asks what a
destination is like, when to go, how to get there, culture/safety/packing
guidance, or budget context. If the response's "education" field is null,
say plainly that no education content has been authored for that
destination yet -- never fill the gap with your own general knowledge
presented as if it were sourced/verified platform content.

Group Travel (only usable when a signed-in traveller's tools are bound --
if get_traveller_preferences/search_group_trips are not available to you,
tell the user this needs an account and to open the app to use it):
read get_traveller_preferences first so matching reflects their real saved
preferences, then search_group_trips for a destination to find compatible
open groups. Describe a match using ONLY the "reasons" strings the tool
returns (e.g. "Same travel style", "Budget ranges overlap") -- never state a
percentage or a reason the tool didn't give you. create_group_trip and
join_group_trip are real, consequential actions: restate exactly what you're
about to do (destination, dates, group size for create; which specific group
for join) and get an explicit yes from the user in this conversation before
calling either -- never call them speculatively while the user is still
exploring options.
"""


def _bind_traveller_tools(user_id: str) -> list:
    """Wraps every tool that must act as a specific traveller so the model
    is never asked to supply (or trusted to correctly state) a user id --
    it's bound here from the session's own authenticated_id (main.py),
    the same value already used for the ADK session itself. Returns an
    empty-tools list of closures, not the raw imported functions, so
    there's no user_id parameter for the LLM to see or fill in at all.
    """

    def get_traveller_preferences() -> dict:
        """Read the current signed-in traveller's own saved preferences --
        travel types, preferred activities, pace, budget range, preferred
        group size/trip duration, languages, interests. Call this before
        search_group_trips so matching reflects their real preferences."""
        return _get_user_preferences_raw(user_id)

    def search_group_trips(dest_id: str, start_date: str = None, end_date: str = None) -> dict:
        """Find open group trips at a destination matching the current
        traveller's own saved preferences. destId is the canonical
        destination slug. Returns ranked matches with real "reasons"
        strings only -- never state a percentage."""
        return _search_group_trips_raw(user_id, dest_id, start_date, end_date)

    def get_group_match_reasons(group_trip_id: str) -> dict:
        """Explain why the current traveller does or doesn't match one
        specific group trip, factor by factor."""
        return _get_group_match_reasons_raw(user_id, group_trip_id)

    def create_group_trip(
        dest_id: str, start_date: str, end_date: str, max_members: int,
        travel_types: list = None, activities: list = None, pace: str = None,
        join_policy: str = "request",
    ) -> dict:
        """Create a new group trip as the current traveller. This is a
        real, persisted action other travellers can discover and request
        to join -- only call this after the user has explicitly confirmed
        the destination, dates, and group size in this conversation."""
        return _create_group_trip_raw(user_id, dest_id, start_date, end_date, max_members, travel_types, activities, pace, join_policy)

    def join_group_trip(group_trip_id: str) -> dict:
        """Request to join a specific group trip as the current traveller.
        A real action the group's creator will see -- only call this after
        the user has explicitly confirmed they want to send this request."""
        return _join_group_trip_raw(user_id, group_trip_id)

    return [get_traveller_preferences, search_group_trips, get_group_match_reasons, create_group_trip, join_group_trip]


def build_agent(user_id: str | None = None) -> Agent:
    """Builds the agent fresh per request so signed-in-only tools (Group
    Travel, preferences) can be bound to this specific request's
    authenticated_id via closure, instead of exposing a user_id parameter
    the model itself would have to state (and could get wrong/spoof).
    Anonymous sessions (user_id=None) get every tool except those."""
    tools = [
        plan_trip,
        search_hotels,
        search_places,
        get_pressure,
        get_destination_education,
        get_personalized_destination_education,
        get_group_trip,
        *get_alternate_tools(),
    ]
    if user_id:
        tools.extend(_bind_traveller_tools(user_id))
    return Agent(name="multimodal_tourism_agent", model=_model(), instruction=_BASE_INSTRUCTION, tools=tools)


# Module-level singleton for anonymous sessions and existing callers
# (tool_inventory below, any test importing `multimodal_agent` directly) --
# main.py's endpoint now calls build_agent(authenticated_id) per request
# instead of using this fixed instance whenever a real user is signed in.
multimodal_agent = build_agent()


def tool_inventory() -> list[dict[str, Any]]:
    """Small introspection helper used by health/tests, not by the model."""
    return [
        {"name": "plan_trip", "kind": "core"},
        {"name": "search_hotels", "kind": "core"},
        {"name": "search_places", "kind": "core"},
        {"name": "get_pressure", "kind": "pressure"},
        {"name": "get_alternate", "kind": "alternative"},
        {"name": "get_alternate_dates", "kind": "alternative"},
        {"name": "get_destination_education", "kind": "education"},
        {"name": "get_personalized_destination_education", "kind": "education"},
        {"name": "get_group_trip", "kind": "group"},
    ]
