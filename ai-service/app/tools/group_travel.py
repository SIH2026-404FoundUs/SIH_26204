# app/tools/group_travel.py
from app.services.backend_client import get, post

def search_group_trips(user_id: str, dest_id: str, start_date: str = None, end_date: str = None) -> dict:
    """Find open group trips at a destination that match the traveller's own
    saved preferences (travel type, activities, budget, pace, group size).
    Ranked internally by fit, but only real, explainable reasons are
    returned -- never a numeric match percentage.

    Args:
        user_id: The traveller's account id (whose saved preferences drive matching).
        dest_id: The canonical destination slug -- destination is a hard filter.
        start_date: Optional "YYYY-MM-DD" to check date overlap against.
        end_date: Optional "YYYY-MM-DD".

    Returns:
        {"matches": [{"groupTrip": {...}, "factors": {...}, "reasons": [...]}]}.
        Describe matches using the "reasons" strings only (e.g. "Same travel
        style", "Budget ranges overlap") -- never invent a percentage or a
        reason not present in the list.
    """
    params = {"userId": user_id, "destId": dest_id}
    if start_date: params["startDate"] = start_date
    if end_date: params["endDate"] = end_date
    return get("/api/v1/group-trips/search/matches", params)

def get_group_trip(group_trip_id: str) -> dict:
    """Read one group trip's full details (destination, dates, travel style,
    budget, capacity, pressure snapshot, itinerary, captain).

    Args:
        group_trip_id: The group trip's id.

    Returns:
        {"groupTrip": {...}}.
    """
    return get(f"/api/v1/group-trips/{group_trip_id}", {})

def get_group_match_reasons(user_id: str, group_trip_id: str) -> dict:
    """Explain why (or why not) a specific traveller matches a specific
    group trip -- the same factor/reason breakdown search_group_trips uses,
    for one group in isolation (e.g. "why did you suggest this one?").

    Args:
        user_id: The traveller's account id.
        group_trip_id: The group trip's id.

    Returns:
        {"factors": {...}, "reasons": [...]}. Only state reasons present in
        the response; if a factor is false, don't claim compatibility on it.
    """
    return get(f"/api/v1/group-trips/{group_trip_id}/matches", {"userId": user_id})

def create_group_trip(user_id: str, dest_id: str, start_date: str, end_date: str, max_members: int,
                       travel_types: list = None, activities: list = None, pace: str = None,
                       join_policy: str = "request") -> dict:
    """Create a new group trip. The creator automatically becomes its first
    member. This is a real, persisted action with real consequences for
    other travellers who may discover and request to join it --
    ONLY call this after the traveller has explicitly confirmed they want
    to create this group (final destination, dates, and group size stated
    back to them and agreed), never speculatively while just exploring options.

    Args:
        user_id: The creator's account id.
        dest_id: The canonical destination slug.
        start_date: "YYYY-MM-DD".
        end_date: "YYYY-MM-DD", must be >= start_date.
        max_members: Integer, at least 2.
        travel_types: Optional list from the travel-types taxonomy (e.g. ["adventure","nature"]).
        activities: Optional list (e.g. ["trekking","photography"]).
        pace: Optional one of "relaxed"|"balanced"|"fast_paced".
        join_policy: "open" (auto-accept) or "request" (creator approves each join). Defaults to "request".

    Returns:
        {"groupTrip": {...}} on success, or {"message": "..."} on a
        validation failure (e.g. unknown destId) -- surface that message to
        the traveller honestly rather than retrying silently.
    """
    body = {
        "userId": user_id, "destId": dest_id, "startDate": start_date, "endDate": end_date,
        "maxMembers": max_members, "joinPolicy": join_policy,
    }
    if travel_types: body["travelTypes"] = travel_types
    if activities: body["activities"] = activities
    if pace: body["pace"] = pace
    return post("/api/v1/group-trips", body)

def join_group_trip(user_id: str, group_trip_id: str) -> dict:
    """Request to join (or, if the group allows open joining, immediately
    join) a group trip. A real action the creator will see and may act on --
    ONLY call this after the traveller has explicitly confirmed they want
    to send this join request, never automatically after just showing them
    search results.

    Args:
        user_id: The traveller's account id.
        group_trip_id: The group trip's id.

    Returns:
        {"member": {...}, "autoAccepted": bool} on success, or
        {"message": "..."} if the group is full, not accepting joins, or
        the traveller already has an active request/membership -- surface
        that message honestly rather than retrying.
    """
    return post(f"/api/v1/group-trips/{group_trip_id}/join", {"userId": user_id})
