# app/tools/weather.py
from app.services.backend_client import get

def get_weather(lat: float, lng: float, date: str) -> dict:
    """Get the weather forecast for a location on a given date.

    Args:
        lat: Latitude of the location.
        lng: Longitude of the location.
        date: Date in YYYY-MM-DD format.

    Returns:
        A dict containing maxTemp and precipProb, or an error if unavailable.
    """
    return get("/api/weather", {"lat": lat, "lng": lng, "date": date})