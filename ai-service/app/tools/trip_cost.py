# app/tools/trip_cost.py

# Field name -> whether an int is required. Everything here must be a real
# number before any arithmetic happens; a missing or string field is a caller
# bug, not something to coerce silently.
_REQUIRED_NUMBERS = {
    "intercity": False,
    "nights": True,
    "stayPricePerNight": False,
    "rooms": True,
    "days": True,
    "mealsPerDay": False,
    "cityMealIndex": False,
    "travellers": True,
}

_REQUIRED_LISTS = ("activityFees", "localLegEstimates")

CONTINGENCY_RATE = 0.10


def _as_number(value, must_be_int: bool):
    """Return value as a float, or None if it is not a usable number.

    bool is rejected on purpose: it is an int subclass in Python, and
    True silently becoming 1 room / 1 night would produce a wrong total
    instead of a clear error.
    """
    if isinstance(value, bool) or value is None:
        return None
    if must_be_int:
        if not isinstance(value, int):
            return None
        return float(value)
    if not isinstance(value, (int, float)):
        return None
    return float(value)


def calculate_trip_cost(components: dict) -> dict:
    """Add up already-known trip cost components into a total. Pure arithmetic.

    This tool NEVER produces a price of its own. It only sums numbers that
    earlier tool calls already returned — intercity fare from the fare/train
    tools, stay price from a hotel/places search, local leg estimates from
    estimate_local_transport, and so on. Do not invent, guess, or fill in any
    value in `components` yourself: if you do not have a real number for a
    field from a previous tool result, get that number first, or leave the
    cost breakdown out entirely. A total built from made-up inputs is worse
    than no total.

    The formula and the 10% contingency rate are fixed. There are no other
    components and no other weights.

    Args:
        components: A dict with every one of these keys:
          intercity: float, one-time intercity travel cost in INR.
          nights: int, number of nights stayed.
          stayPricePerNight: float, price per room per night in INR.
          rooms: int, number of rooms booked.
          days: int, number of days of the trip.
          mealsPerDay: float, meals eaten per person per day.
          cityMealIndex: float, per-meal cost index for the city in INR.
          travellers: int, number of people travelling.
          activityFees: list of floats, per-activity entry fees. May be
            an empty list — that is a real state (no paid activities),
            not a missing value.
          localLegEstimates: list of floats, per-leg local transport costs.
            May likewise be an empty list.

    Returns:
        On success, a dict with intercity, accommodation, food, activities,
        localTransport, subtotal, contingency (10% of subtotal), grandTotal
        (subtotal + contingency), and estimate: True. `estimate` is always
        True — this is a computed projection, never a live quoted price, and
        should always be reported to the user as an estimate.

        On bad input, {"error": "missing or invalid field: X"} instead. That
        means the field was absent or was not a number (a numeric string
        counts as invalid); fix the input rather than retrying the same call.
    """
    if not isinstance(components, dict):
        return {"error": "missing or invalid field: components (expected a dict)"}

    values = {}
    for field, must_be_int in _REQUIRED_NUMBERS.items():
        number = _as_number(components.get(field), must_be_int)
        if number is None:
            return {"error": f"missing or invalid field: {field}"}
        values[field] = number

    sums = {}
    for field in _REQUIRED_LISTS:
        raw = components.get(field)
        if not isinstance(raw, list):
            return {"error": f"missing or invalid field: {field}"}
        total = 0.0
        for entry in raw:
            number = _as_number(entry, False)
            if number is None:
                return {"error": f"missing or invalid field: {field}"}
            total += number
        sums[field] = total

    intercity = values["intercity"]
    accommodation = values["nights"] * values["stayPricePerNight"] * values["rooms"]
    food = (
        values["days"]
        * values["mealsPerDay"]
        * values["cityMealIndex"]
        * values["travellers"]
    )
    activities = sums["activityFees"]
    local_transport = sums["localLegEstimates"]

    subtotal = intercity + accommodation + food + activities + local_transport
    contingency = subtotal * CONTINGENCY_RATE

    return {
        "intercity": round(intercity, 2),
        "accommodation": round(accommodation, 2),
        "food": round(food, 2),
        "activities": round(activities, 2),
        "localTransport": round(local_transport, 2),
        "subtotal": round(subtotal, 2),
        "contingency": round(contingency, 2),
        "grandTotal": round(subtotal + contingency, 2),
        "estimate": True,
    }
