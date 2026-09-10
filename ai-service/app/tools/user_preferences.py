# app/tools/user_preferences.py
from app.services.backend_client import get

def get_user_preferences(user_id: str) -> dict:
    """Read a traveller's saved preferences (interests, budget band, languages).

    Args:
        user_id: The traveller's account id.

    Returns:
        On success, {"interests": {...}, "budgetBand": str|None, "languages": [...]}.
        On a user with no saved preferences yet, the fields come back empty/None
        — that's a real state (new account), not an error. On an unknown
        user_id the backend returns 404, surfaced here as a dict with no
        recognizable preference keys; treat that as "no preferences available"
        rather than retrying.
    """
    return get(f"/api/v1/users/{user_id}/preferences", {})
