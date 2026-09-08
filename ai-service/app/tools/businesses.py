# app/tools/businesses.py
from app.services.backend_client import get

def search_businesses(dest_id: str, type: str = "") -> dict:
    """Find onboarded local businesses in a destination, ranked by Bharani's
    growth formula (favors WhatsApp-onboarded, verified, low-pressure supply
    over established chains). This tool wraps that ranking directly — it does
    not re-rank or re-score results itself.

    Every business name returned here is a real onboarded listing. Only ever
    name a local business that appears in this tool's output — never invent,
    substitute, or pad the list with plausible-sounding homestays, guides or
    operators, and never fall back to generic names when the list is empty.

    Args:
        dest_id: Destination id slug, e.g. "manali".
        type: Optional business type filter, e.g. "homestay", "guide",
          "driver", "cook", "guesthouse". Leave empty to return all types.

    Returns:
        On success, a list of businesses ordered by growthRank (descending),
        each carrying its normal fields plus growthRank and
        growthMultipliers. An empty list means no businesses are onboarded
        for that destination/type yet — a real state, not an error.

        growthRank and growthMultipliers are computed SERVER-SIDE and arrive
        already final. Report them as-is. Do not recompute, re-derive,
        re-weight, second-guess or "correct" them, and do not reorder the
        list by your own judgement — the returned order IS the ranking. Ties
        are normal and meaningful (equal growthRank means equally promoted);
        do not invent a tiebreak to make the list look sorted.
    """
    params = {"destId": dest_id}
    if type:
        params["type"] = type
    return get("/api/v1/businesses/search", params)
