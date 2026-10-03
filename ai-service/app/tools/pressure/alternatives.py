# app/tools/pressure/alternatives.py
from datetime import date

from app.services.backend_client import post


def _trip_value(trip, key, default=None):
    if isinstance(trip, dict):
        return trip.get(key, default)
    return getattr(trip, key, default)


def _shifted_end(start, end, new_start):
    try:
        duration = date.fromisoformat(end) - date.fromisoformat(start)
        return (date.fromisoformat(new_start) + duration).isoformat()
    except (TypeError, ValueError):
        return new_start


def _money_delta(candidate):
    """The public swap contract uses negative numbers for savings."""
    saving = candidate.get("savingINR") if isinstance(candidate, dict) else None
    return -round(float(saving)) if isinstance(saving, (int, float)) else 0


def _travel_time_change(candidate):
    if not isinstance(candidate, dict):
        return "Unavailable"
    current = candidate.get("requestedTimeHours")
    alternative = candidate.get("travelTimeHours", candidate.get("travelTime"))
    if not isinstance(current, (int, float)) or not isinstance(alternative, (int, float)):
        return "Unavailable"
    minutes = round((alternative - current) * 60)
    return f"{minutes:+d} min"


def _destination_reasons(candidate):
    reasons = []
    if isinstance(candidate, dict) and isinstance(candidate.get("pressure"), (int, float)):
        reasons.append("Lower crowd")
    if isinstance(candidate, dict) and candidate.get("stayCost") is not None:
        reasons.append("Higher hotel availability")
    reasons.append("Similar trekking experience")
    return reasons


def _date_reasons(candidate):
    reasons = ["Avoid peak-period rush"]
    if isinstance(candidate, dict) and candidate.get("savingINR") is not None:
        reasons.append("More hotel availability")
    return reasons


def find_alternative(trip: dict) -> dict | None:
    """Return the first verified lower-pressure destination swap for ``trip``.

    This is a thin adapter over the existing backend alternatives/Pressure Engine
    pipeline. It does not calculate crowding itself.
    """
    result = find_alternatives(
        _trip_value(trip, "origin"),
        _trip_value(trip, "destId"),
        _trip_value(trip, "startDate"),
        _trip_value(trip, "endDate"),
        int(_trip_value(trip, "travellers", 1) or 1),
        float(_trip_value(trip, "budgetINR", 0) or 0),
        _trip_value(trip, "interests", {}) or {},
    )
    places = result.get("places") if isinstance(result, dict) else None
    candidate = places[0] if isinstance(places, list) and places else None
    if not candidate:
        return None
    return {
        "original_destination": _trip_value(trip, "destId"),
        "original_name": result.get("requested", {}).get("displayName"),
        "alternative_destination": candidate.get("destId"),
        "alternative_name": candidate.get("displayName"),
        "pressure_before": result.get("requested", {}).get("pressure"),
        "pressure_after": candidate.get("pressure"),
        "travel_time_change": _travel_time_change(candidate),
        "budget_difference": _money_delta(candidate),
        "reason": _destination_reasons(candidate),
        "candidate": candidate,
    }


def _find_alternative_dates_for_trip(trip: dict) -> dict | None:
    """Return the first verified lower-pressure date swap for ``trip``."""
    result = find_alternatives(
        _trip_value(trip, "origin"),
        _trip_value(trip, "destId"),
        _trip_value(trip, "startDate"),
        _trip_value(trip, "endDate"),
        int(_trip_value(trip, "travellers", 1) or 1),
        float(_trip_value(trip, "budgetINR", 0) or 0),
        _trip_value(trip, "interests", {}) or {},
    )
    dates = result.get("dates") if isinstance(result, dict) else None
    candidate = dates[0] if isinstance(dates, list) and dates else None
    if not candidate:
        return None
    new_start = candidate.get("startDate")
    return {
        "original_dates": [_trip_value(trip, "startDate"), _trip_value(trip, "endDate")],
        "alternative_dates": [new_start, _shifted_end(_trip_value(trip, "startDate"), _trip_value(trip, "endDate"), new_start)],
        "pressure_before": result.get("requested", {}).get("pressure"),
        "pressure_after": candidate.get("pressure"),
        "budget_difference": _money_delta(candidate),
        "reason": _date_reasons(candidate),
        "candidate": candidate,
    }

def find_alternatives(origin: str, dest_id: str, start_date: str, end_date: str,
                      travellers: int, budget_inr: float, interests: dict) -> dict:
    """Find less-crowded substitutes for a planned trip: other places, other dates.

    One call returns both kinds of alternative. There is no separate date-only
    lookup — `places` and `dates` are computed together and come back together.

    Args:
        origin: Where the traveller starts from, e.g. "New Delhi".
        dest_id: Destination id slug they are planning on, e.g. "manali".
        start_date: Trip start in YYYY-MM-DD format.
        end_date: Trip end in YYYY-MM-DD format.
        travellers: Number of people travelling.
        budget_inr: Total trip budget in INR.
        interests: Interest weights 0..1, e.g. {"snow": 0.8, "trek": 0.6}.

    Returns:
        On success, a dict with:
          requested: the pressure reading for the destination they asked about
            (destId, displayName, pressure, breakdown).
          places: alternative destinations. This list may legitimately come
            back EMPTY. An empty `places` is a real, current, known state of
            this system — it means no candidate destination cleared the
            similarity and relief thresholds. It is NOT an error, NOT a
            failed call, and NOT something to retry or work around. Report it
            as "no better destination found", never as a broken lookup.
          dates: alternative dates for the SAME destination. This is a
            separate fallback and must still be checked even when `places` is
            empty — the two are independent, and a date-shift option very
            often exists when a place-swap one does not. Never conclude "there
            are no alternatives" from an empty `places` alone; only say that
            when `dates` is also empty.
          relaxedRelief: True when the relief threshold had to be loosened to
            produce any candidates at all, so the suggestions are weaker
            improvements than usual and should be reported with that caveat.

        On failure the call returns {"ok": False, "error": ...} instead —
        that, not an empty list, is what an actual error looks like.
    """
    return post("/api/alternatives", timeout=60, body={
        "origin": origin,
        "destId": dest_id,
        "startDate": start_date,
        "endDate": end_date,
        "travellers": travellers,
        "budgetINR": budget_inr,
        "interests": interests,
    })


def _find_alternative_dates_legacy(dest_id: str, start: str, end: str, origin: str,
                           travellers: int = 1, budget_inr: float = 0.0) -> dict:
    """Find less-crowded dates for the SAME destination, without changing the place.

    This is not a second implementation — Madhuri's alternatives engine always
    computes place-swaps and date-shifts together in one pass (see
    find_alternatives' docstring), so this tool calls the identical backend
    endpoint and simply narrows the summary to the date-shift half. Prefer
    find_alternatives when you also want place alternatives; use this one when
    the traveller specifically wants to keep the destination and only move the
    date. `origin` is required because the underlying endpoint scores date
    options using the same reachability/cost inputs as place options — pass the
    traveller's actual starting point even though this call never returns a
    different destination.

    Args:
        dest_id: Destination id slug they are planning on, e.g. "manali".
        start: Trip start in YYYY-MM-DD format.
        end: Trip end in YYYY-MM-DD format.
        origin: Where the traveller starts from, e.g. "New Delhi".
        travellers: Number of people travelling. Defaults to 1.
        budget_inr: Total trip budget in INR. Defaults to 0 (unconstrained).

    Returns:
        On success, a dict with `requested` (the pressure reading for the
        date(s) asked about) and `dates` (alternative dates for this same
        destination — may legitimately be empty, meaning no better date was
        found, not an error). `places` is also present (from the shared
        endpoint) but should be ignored by callers of this tool.
        On failure: {"ok": False, "error": ...}.
    """
    return post("/api/alternatives", timeout=60, body={
        "origin": origin,
        "destId": dest_id,
        "startDate": start,
        "endDate": end,
        "travellers": travellers,
        "budgetINR": budget_inr,
        "interests": {},
    })


def find_alternative_dates(trip_or_dest, start=None, end=None, origin=None,
                           travellers: int = 1, budget_inr: float = 0.0):
    """Support both the new trip-object contract and the existing agent tool.

    ``find_alternative_dates(trip)`` returns the normalized Swap Card object.
    The positional form remains available for the older travel-agent tool,
    which expects the raw alternatives response.
    """
    if isinstance(trip_or_dest, dict) and start is None:
        return _find_alternative_dates_for_trip(trip_or_dest)
    return _find_alternative_dates_legacy(
        trip_or_dest, start, end, origin, travellers, budget_inr
    )
