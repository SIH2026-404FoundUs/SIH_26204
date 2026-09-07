# app/tools/alerts.py
from app.services.backend_client import get

def get_verified_alerts(dest_id: str, start: str, end: str) -> dict:
    """Get sourced safety/travel advisories for a destination. Wraps Pranay's
    alerts endpoint directly — this tool does not compute or invent advisories.

    Note on start/end: the backend endpoint only returns alerts that are
    active RIGHT NOW (validFrom <= now <= validTo) — it does not filter by an
    arbitrary future trip date range. start/end are accepted here to match
    the planner's call signature but currently have no effect server-side;
    treat the result as "what's active today", not "what will be active
    during the trip".

    Args:
        dest_id: Destination id slug, e.g. "manali".
        start: Trip start date, YYYY-MM-DD (currently unused by the backend).
        end: Trip end date, YYYY-MM-DD (currently unused by the backend).

    Returns:
        On success, a list of alerts, each with destId, kind, severity, body,
        sourceUrl, sourceName, validFrom, validTo, fetchedAt. Every alert is
        guaranteed to carry a real sourceUrl and sourceName — never present
        one without attribution. An empty list is a real, common state (no
        active advisories), not an error.
    """
    return get("/api/v1/alerts", {"destId": dest_id})
