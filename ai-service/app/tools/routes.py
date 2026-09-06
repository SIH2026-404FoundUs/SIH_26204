from app.services.backend_client import post

def calculate_route(origin_lat: float, origin_lng: float, dest_lat: float, dest_lng: float, mode: str = "DRIVE") -> dict:
    """Calculate distance and travel time between two points.

    Args:
        origin_lat: Origin latitude.
        origin_lng: Origin longitude.
        dest_lat: Destination latitude.
        dest_lng: Destination longitude.
        mode: Travel mode - DRIVE, WALK, BICYCLE, or TRANSIT.

    Returns:
        A dict with distanceKm and durationMinutes.
    """
    return post("/api/routes", {
        "originLat": origin_lat, "originLng": origin_lng,
        "destLat": dest_lat, "destLng": dest_lng,
        "mode": mode
    })