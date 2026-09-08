# app/tools/alternatives.py
from app.services.backend_client import post

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
    return post("/api/alternatives", {
        "origin": origin,
        "destId": dest_id,
        "startDate": start_date,
        "endDate": end_date,
        "travellers": travellers,
        "budgetINR": budget_inr,
        "interests": interests,
    })


def find_alternative_dates(dest_id: str, start: str, end: str, origin: str,
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
    return post("/api/alternatives", {
        "origin": origin,
        "destId": dest_id,
        "startDate": start,
        "endDate": end,
        "travellers": travellers,
        "budgetINR": budget_inr,
        "interests": {},
    })
