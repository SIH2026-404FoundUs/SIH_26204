# ai-service/app/services/trip_drafts.py
"""Stand-in storage for the two trip records that have no model yet.

Both stores are plain process-local dicts. They are lost on restart and are not
shared between workers, so this is only good enough to build and exercise the
plan/confirm handshake before the real trips model lands. Every function here
is a seam: swap the body for a DB call and the callers in main.py do not change.

A draft is written when pressure gating pauses a plan to offer alternatives. It
holds the original request and what was offered, so that /api/plan-trip/confirm
can rebuild the plan without trusting the client to echo any of it back.
"""

import logging
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# tripDraftId -> {request, pressure, alternatives}
_DRAFTS: Dict[str, Dict[str, Any]] = {}

# tripDraftId -> the confirmed trip record
_TRIPS: Dict[str, Dict[str, Any]] = {}


def save_draft(
    request: Dict[str, Any],
    pressure: Dict[str, Any],
    alternatives: Dict[str, Any],
) -> str:
    """Store a paused plan and return its tripDraftId."""
    trip_draft_id = str(uuid.uuid4())
    _DRAFTS[trip_draft_id] = {
        "request": request,
        "pressure": pressure,
        "alternatives": alternatives,
    }
    logger.info(
        "trip draft %s saved (destId=%s startDate=%s)",
        trip_draft_id,
        request.get("destId"),
        request.get("startDate"),
    )
    return trip_draft_id


def get_draft(trip_draft_id: str) -> Optional[Dict[str, Any]]:
    """Return a stored draft, or None if there is no draft with that id."""
    return _DRAFTS.get(trip_draft_id)


def save_trip(trip_draft_id: str, trip: Dict[str, Any]) -> None:
    """Persist a confirmed trip.

    STUB: writes to a dict and logs. Replace with the real trips-model write
    once that model exists; the redistribution block is the field the impact
    reporting will read, so it is logged explicitly here.
    """
    _TRIPS[trip_draft_id] = trip
    logger.info(
        "trip %s written (destId=%s startDate=%s redistribution=%s)",
        trip_draft_id,
        trip.get("destId"),
        trip.get("startDate"),
        trip.get("redistribution"),
    )
