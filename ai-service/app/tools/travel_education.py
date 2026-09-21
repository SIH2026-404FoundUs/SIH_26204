# app/tools/travel_education.py
from app.services.backend_client import get

def get_destination_education(dest_id: str) -> dict:
    """Read a destination's Travel Education content -- overview, best time,
    getting there/around, culture, safety, packing, food, and live pressure
    context, merged read-only from the existing Pressure Engine.

    Args:
        dest_id: The canonical destination slug (e.g. "manali"), the SAME
            identifier used everywhere else in this platform (pressure,
            alternatives, trip planning) -- never a different id scheme.

    Returns:
        {"education": {...} | None, "pressureContext": {...}, "safetyAlerts": [...]}.
        education is None when no content has been authored for this
        destination yet -- an honest "not available yet" state, never
        fabricated. Always pass this through to the traveller as-is; never
        invent overview/safety/packing facts this call didn't return.
    """
    return get(f"/api/v1/destinations/{dest_id}/education", {})

def get_personalized_destination_education(dest_id: str) -> dict:
    """A shorter, Data-Saver-friendly summary of a destination's Travel
    Education content -- overview, best time, budget context, travel style
    tags, and live pressure score only. Prefer this over
    get_destination_education when the traveller just wants a quick read,
    not the full breakdown.

    Args:
        dest_id: The canonical destination slug.

    Returns:
        {"education": {...} | None, "pressureContext": {...}}.
    """
    return get(f"/api/v1/destinations/{dest_id}/education/summary", {})
