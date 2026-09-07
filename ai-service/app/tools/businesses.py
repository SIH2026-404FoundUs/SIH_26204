# app/tools/businesses.py
from app.services.backend_client import get

def search_businesses(dest_id: str, type: str = "") -> dict:
    """Find onboarded local businesses in a destination, ranked by Bharani's
    growth formula (favors WhatsApp-onboarded, verified, low-pressure supply
    over established chains). This tool wraps that ranking directly — it does
    not re-rank or re-score results itself.

    Args:
        dest_id: Destination id slug, e.g. "manali".
        type: Optional business type filter, e.g. "homestay", "guide",
          "driver", "cook", "guesthouse". Leave empty to return all types.

    Returns:
        On success, a list of businesses ordered by growthRank (descending),
        each carrying its normal fields plus growthRank and
        growthMultipliers. An empty list means no businesses are onboarded
        for that destination/type yet — a real state, not an error.
    """
    params = {"destId": dest_id}
    if type:
        params["type"] = type
    return get("/api/v1/businesses/search", params)
