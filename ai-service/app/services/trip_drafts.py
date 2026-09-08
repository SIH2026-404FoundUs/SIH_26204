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


def save_draft(
    request: Dict[str, Any],
    pressure: Dict[str, Any],
    alternatives: Dict[str, Any],
) -> str:
    """Create a TRIPS document in draft state and return its id.

    The trip's own id (a Mongo ObjectId string) IS the tripDraftId -- there is
    no separate identifier space to keep in sync.
    """
    # request is PlanTripRequest.model_dump() -- that pydantic model's fields
    # are already camelCase (userId, destId, startDate, ...), same as this
    # service's own body, so no case conversion happens here.
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
        "_draftPressure": pressure,
        "_draftAlternatives": alternatives,
    }
    result = post("/api/v1/trips", body)
    trip_id = result.get("_id") if isinstance(result, dict) else None
    if not trip_id:
        raise RuntimeError(f"failed to create trip draft: {result}")
    logger.info(
        "trip draft %s saved (destId=%s startDate=%s)",
        trip_id,
        request.get("destId"),
        request.get("startDate"),
    )
    return trip_id


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
