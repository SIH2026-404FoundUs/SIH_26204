from app.services.backend_client import get

def estimate_local_transport(city: str, mode: str, distance_km: float, duration_min: float = 0) -> dict:
    """Estimate the cost of local transport for a given distance.

    Args:
        city: City name, e.g. "hyderabad".
        mode: Transport mode - auto, cab, metro, or bus.
        distance_km: Distance in kilometers.
        duration_min: Trip duration in minutes. Required for an accurate "cab"
            estimate - cabs charge a per-minute time component on top of the
            per-km rate, so leaving this at 0 under-quotes a cab fare. Always
            supply the expected ride duration when the mode is "cab" and a
            duration is known or can be reasonably estimated. Ignored for
            auto, metro, and bus, which are not time-priced.

    Returns:
        A dict with the estimated fare in INR, in the standard envelope shape:
        {"ok": True, "data": {"mode", "distanceKm", "fareINR"}, "meta": {...}},
        or {"ok": False, "error": str, "meta": {...}} when no rates exist for
        the city or mode.

        meta carries "durationIncluded": False when mode is "cab" and no
        duration was supplied. That marks the fare as a distance-only floor
        with the per-minute component missing — the real fare is higher. Do
        not present such a number as the expected cab fare without saying it
        excludes the time component. The field is absent otherwise.
    """
    return get("/api/fare", {
        "city": city,
        "mode": mode,
        "distanceKm": distance_km,
        "durationMin": duration_min,
    })
