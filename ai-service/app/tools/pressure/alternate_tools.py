"""Compatibility names for the multimodal tourism agent.

The product's existing implementation calls the backend endpoint
``/api/alternatives`` through ``alternatives.py``.  These small wrappers keep
the MVP agent vocabulary readable without introducing another alternatives
engine or pressure calculation.
"""

from app.tools.pressure.alternatives import find_alternative, find_alternative_dates


def get_alternate(trip: dict) -> dict | None:
    """Return a lower-pressure destination alternative for a trip."""
    return find_alternative(trip)


def get_alternate_dates(trip: dict) -> dict | None:
    """Return lower-pressure dates for the same destination."""
    return find_alternative_dates(trip)


def get_alternate_tools() -> list:
    """Expose the alternative tool set for agent composition and tests."""
    return [get_alternate, get_alternate_dates]
