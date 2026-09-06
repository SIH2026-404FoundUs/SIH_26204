from app.services.backend_client import get

def search_road_services(dest_id: str) -> dict:
    """Get road transport frequency information for a destination.

    Note: this returns schedule frequency only, not live seat availability,
    since no live road-transport API exists for the covered states.

    Args:
        dest_id: The destination's canonical ID.

    Returns:
        A dict with corridor, operators, and frequency data, low confidence.
    """
    return get("/api/road", {"destId": dest_id})