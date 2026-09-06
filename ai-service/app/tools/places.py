from app.services.backend_client import get

def search_places(query: str, lat: float, lng: float, radius_meters: int = 20000) -> dict:
    """Search for places (hotels, attractions, restaurants) near a location.

    Args:
        query: Text search query, e.g. "hotels in Manali".
        lat: Latitude to search near.
        lng: Longitude to search near.
        radius_meters: Search radius in meters, defaults to 20000.

    Returns:
        A dict with a list of matching places (name, placeId, lat, lng, rating).
    """
    return get("/api/places", {"query": query, "lat": lat, "lng": lng, "radiusMeters": radius_meters})