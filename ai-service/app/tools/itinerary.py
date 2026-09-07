# app/tools/itinerary.py

DEFAULT_STOP_MINUTES = 60


def _as_coordinate(value):
    """Return value as a float, or None if it is not a usable coordinate."""
    if isinstance(value, bool) or value is None:
        return None
    if not isinstance(value, (int, float)):
        return None
    return float(value)


def optimize_itinerary(stops: list, hotel: dict, days: int) -> dict:
    """Split a list of stops across trip days, anchored on the hotel. Pure logic.

    This answers "what happens on which day", NOT "in what order should we
    drive between them". Waypoint ordering and travel time are calculate_route's
    job and are already handled there — this tool deliberately does no distance
    math and never reorders stops. It slices the list you give it, in the order
    you give it, into as-even-as-possible day groups, and brackets each day with
    the hotel as the start and end point.

    Args:
        stops: List of dicts, each with name (str), lat (float), lng (float),
          and optionally durationMinutes (int, defaults to 60). Pass them in
          the visiting order you want preserved. May be an empty list.
        hotel: Dict with name (str), lat (float), lng (float). This is the
          anchor every day starts and ends at.
        days: Number of trip days to spread the stops over. Must be at least 1.

    Returns:
        On success, {"days": [...]} where each entry is
        {"day": 1, "stops": [{"time": "start", "location": hotel}, ...visits...,
        {"time": "end", "location": hotel}]}. Each visit carries name, lat, lng
        and estimatedDuration in minutes.

        Days may legitimately hold no visits — with more days than stops, the
        later days come back with only the hotel start/end pair, and with zero
        stops every day does. That is a real, correct result, not a failure;
        report it as a free/unscheduled day.

        On bad input, {"error": ...} instead — for example a days value below 1,
        or a hotel/stop missing its name or coordinates.
    """
    if isinstance(days, bool) or not isinstance(days, int):
        return {"error": "missing or invalid field: days (expected an int)"}
    if days < 1:
        return {"error": "days must be at least 1"}

    if not isinstance(hotel, dict):
        return {"error": "missing or invalid field: hotel (expected a dict)"}
    hotel_lat = _as_coordinate(hotel.get("lat"))
    hotel_lng = _as_coordinate(hotel.get("lng"))
    if not isinstance(hotel.get("name"), str) or hotel_lat is None or hotel_lng is None:
        return {"error": "missing or invalid field: hotel (needs name, lat, lng)"}
    anchor = {"name": hotel["name"], "lat": hotel_lat, "lng": hotel_lng}

    if stops is None:
        stops = []
    if not isinstance(stops, list):
        return {"error": "missing or invalid field: stops (expected a list)"}

    visits = []
    for index, stop in enumerate(stops):
        if not isinstance(stop, dict):
            return {"error": f"missing or invalid field: stops[{index}]"}
        lat = _as_coordinate(stop.get("lat"))
        lng = _as_coordinate(stop.get("lng"))
        if not isinstance(stop.get("name"), str) or lat is None or lng is None:
            return {"error": f"missing or invalid field: stops[{index}] (needs name, lat, lng)"}
        duration = stop.get("durationMinutes", DEFAULT_STOP_MINUTES)
        if isinstance(duration, bool) or not isinstance(duration, (int, float)):
            return {"error": f"missing or invalid field: stops[{index}].durationMinutes"}
        visits.append({
            "name": stop["name"],
            "lat": lat,
            "lng": lng,
            "estimatedDuration": duration,
        })

    # Spread as evenly as possible, front-loading the remainder:
    # 7 stops over 3 days -> 3, 2, 2.
    base, remainder = divmod(len(visits), days)

    plan = []
    cursor = 0
    for day_number in range(1, days + 1):
        count = base + (1 if day_number <= remainder else 0)
        day_visits = visits[cursor:cursor + count]
        cursor += count
        plan.append({
            "day": day_number,
            "stops": (
                [{"time": "start", "location": anchor}]
                + day_visits
                + [{"time": "end", "location": anchor}]
            ),
        })

    return {"days": plan}
