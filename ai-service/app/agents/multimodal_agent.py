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
from app.tools.alternate_tools import get_alternate, get_alternate_dates, get_alternate_tools
from app.tools.places import search_places as search_places_backend
from app.tools.pressure import get_pressure


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


multimodal_agent = Agent(
    name="multimodal_tourism_agent",
    model=_model(),
    instruction="""You are Sahyatri's focused multimodal tourism agent.

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
""",
    tools=[
        plan_trip,
        search_hotels,
        search_places,
        get_pressure,
        *get_alternate_tools(),
    ],
)


def tool_inventory() -> list[dict[str, Any]]:
    """Small introspection helper used by health/tests, not by the model."""
    return [
        {"name": "plan_trip", "kind": "core"},
        {"name": "search_hotels", "kind": "core"},
        {"name": "search_places", "kind": "core"},
        {"name": "get_pressure", "kind": "pressure"},
        {"name": "get_alternate", "kind": "alternative"},
        {"name": "get_alternate_dates", "kind": "alternative"},
    ]
