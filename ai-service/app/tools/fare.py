from app.services.backend_client import get

def estimate_local_transport(city: str, mode: str, distance_km: float) -> dict:
    """Estimate the cost of local transport for a given distance.

    Args:
        city: City name, e.g. "hyderabad".
        mode: Transport mode - auto, cab, metro, or bus.
        distance_km: Distance in kilometers.

    Returns:
        A dict with the estimated fare in INR.
    """
    return get("/api/fare", {"city": city, "mode": mode, "distanceKm": distance_km})