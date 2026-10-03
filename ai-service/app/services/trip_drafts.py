# ai-service/app/services/trip_drafts.py
"""Real persistence for trip drafts/confirmations, backed by the TRIPS
collection (spec §6) via the Express backend's /api/v1/trips endpoints.

This used to be a process-local dict store (lost on restart, not shared
between workers) -- exactly the seam its own docstring called out: "swap the
body for a DB call and the callers in main.py do not change." That swap is
this file. main.py's calls are unchanged; only what's behind them differs, so
wrap them in run_in_threadpool same as any other blocking network call.
"""

import logging
from typing import Any, Dict, Optional

from app.services.backend_client import get, patch, post

logger = logging.getLogger(__name__)


def get_draft(trip_draft_id: str) -> Optional[Dict[str, Any]]:
    """Return the stored draft in the {request, pressure, alternatives} shape
    main.py's confirm handler expects, or None if there is no such trip.
    """
    trip = get(f"/api/v1/trips/{trip_draft_id}", {})
    if not isinstance(trip, dict) or not trip.get("_id"):
        return None
    # Rebuilt as PlanTripRequest(**draft["request"]) in main.py, so these keys
    # must match that model's actual (camelCase) field names.
    return {
        "request": {
            "userId": trip.get("userId"),
            "origin": trip.get("origin"),
            "destId": trip.get("requestedDestId"),
            "startDate": (trip.get("requestedDates") or {}).get("startDate"),
            "endDate": (trip.get("requestedDates") or {}).get("endDate"),
            "travellers": trip.get("travellers"),
            "budgetINR": trip.get("budgetINR"),
            "interests": trip.get("interests") or {},
        },
        "pressure": trip.get("_draftPressure"),
        "alternatives": trip.get("_draftAlternatives"),
    }


def save_trip(trip_draft_id: str, trip: Dict[str, Any]) -> None:
    """Attach the confirmed plan to the existing TRIPS document."""
    redistribution = trip.get("redistribution") or {"kind": "none"}
    update = {
        "redirectedToDestId": trip.get("destId") if redistribution.get("kind") != "none" else None,
        "finalDates": {"startDate": trip.get("startDate"), "endDate": trip.get("endDate")},
        "itinerary": trip.get("trip"),
        "redistribution": redistribution,
        "alternativesOffered": trip.get("alternativesOffered", True),
        "state": "planned",
    }
    result = patch(f"/api/v1/trips/{trip_draft_id}", update)
    logger.info(
        "trip %s written (destId=%s startDate=%s redistribution=%s)",
        trip_draft_id,
        trip.get("destId"),
        trip.get("startDate"),
        redistribution,
    )
    if not isinstance(result, dict) or not result.get("_id"):
        logger.warning("trip %s update may not have persisted: %s", trip_draft_id, result)


def save_completed(request: Dict[str, Any], trip: Dict[str, Any]) -> Optional[str]:
    """Persist a normally generated plan so it appears in My Trips.

    Pressure-gated plans use save_trip. Plans that do not require a
    decision previously skipped persistence entirely; this creates the same
    TRIPS record and immediately marks it planned.
    """
    body = {
        "userId": request.get("userId"),
        "origin": request.get("origin"),
        "requestedDestId": request.get("destId"),
        "requestedDates": {
            "startDate": request.get("startDate"),
            "endDate": request.get("endDate"),
        },
        "travellers": request.get("travellers"),
        "budgetINR": request.get("budgetINR"),
        "interests": request.get("interests") or {},
    }
    created = post("/api/v1/trips", body)
    trip_id = created.get("_id") if isinstance(created, dict) else None
    if not trip_id:
        raise RuntimeError(f"failed to create completed trip: {created}")

    itinerary = trip.get("itinerary") if isinstance(trip.get("itinerary"), dict) else {}
    saved_stops = [
        stop
        for day in itinerary.get("days", [])
        if isinstance(day, dict)
        for stop in day.get("stops", [])
    ]

    patch(
        f"/api/v1/trips/{trip_id}",
        {
            "finalDates": {
                "startDate": request.get("startDate"),
                "endDate": request.get("endDate"),
            },
            "itinerary": trip.get("itinerary"),
            "transport": trip.get("route"),
            "costBreakdown": trip.get("costBreakdown"),
            "selectedHotel": (trip.get("hotels") or [None])[0],
            "stops": saved_stops,
            "alternativesOffered": bool(trip.get("alternatives")),
            "state": "planned",
        },
    )
    logger.info("completed trip %s persisted (destId=%s)", trip_id, request.get("destId"))
    return trip_id
