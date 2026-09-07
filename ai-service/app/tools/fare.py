from app.services.backend_client import get

def estimate_local_transport(city: str, mode: str, distance_km: float, duration_min: float = 0) -> dict:
    """Estimate the cost of local transport for a given distance.

    Args:
        city: City name, e.g. "hyderabad".
        mode: Transport mode - auto, cab, metro, or bus.
        distance_km: Distance in kilometers.
        duration_min: Trip duration in minutes. Only affects the "cab" fare
          (formula: base + perKm*distance_km + perMin*duration_min) — auto,
          metro, and bus fares ignore it. Pass the real estimated duration
          when booking a cab; omitting it under-prices longer, slower trips.

    Returns:
        A dict with the estimated fare in INR (always `estimate:true` — never
        a live quoted price). An unknown city falls back to a generic
        labelled rate (confidence:"low") rather than failing outright.
    """
    return get("/api/fare", {"city": city, "mode": mode, "distanceKm": distance_km, "durationMin": duration_min})