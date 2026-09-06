# app/tools/pressure.py
from app.services.backend_client import get

def get_pressure(dest_id: str, date: str) -> dict:
    """Get the crowding/pressure reading for a tracked destination on a date.

    The score is a 0..1 blend of access, stay, calendar, weather and capacity
    signals. Higher means more crowded.

    Args:
        dest_id: Destination id slug, e.g. "manali" or "shimla".
        date: Date in YYYY-MM-DD format.

    Returns:
        On success, a dict with:
          score: float 0..1, OR None. None is a real, expected outcome — it
            means every pressure component failed to compute, so there is no
            score at all. It does NOT mean zero crowding. Never compare,
            round, or describe it as a number without checking for None
            first; if it is None, say the crowding level is unknown.
          components: per-signal detail, only for signals that computed.
          dropped: list of component names that could not be computed. When
            this lists all five, score is None.
          degraded: components computed from a weaker fallback source (e.g.
            ["road"] when only schedule frequency, not seat data, was
            available). The score is still usable but less date-sensitive.
          lowConfidence: True when enough weight was dropped that the score
            should be reported with a caveat.
          stale: True when live computation timed out and an older stored row
            was served instead.

        A destination that is not tracked at all is a distinct failure, not a
        null score: the backend answers 404 and this returns
        {"message": "unknown destId and no stored row"} with no score key.
        A missing date returns a 400 {"message": ...} the same way. Treat any
        response with no "score" key as "no data for this destination",
        separately from a present-but-None score.
    """
    return get(f"/api/v1/pressure/{dest_id}", {"date": date})
