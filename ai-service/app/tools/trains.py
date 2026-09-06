from app.services.backend_client import get

def get_train_availability(train_number: str, source: str, destination: str, journey_date: str, class_code: str = "3A", quota_code: str = "GN") -> dict:
    """Check seat/waitlist availability for a train between two stations.

    Args:
        train_number: 5-digit train number.
        source: Boarding station code (e.g. NDLS).
        destination: Destination station code (e.g. MMCT).
        journey_date: Date in YYYY-MM-DD format.
        class_code: Travel class (e.g. 3A, SL, 2A).
        quota_code: Quota code, defaults to GN (general).

    Returns:
        A dict with per-day waitlist depth and status, or an error.
    """
    return get("/api/trains", {
        "trainNumber": train_number,
        "source": source,
        "destination": destination,
        "journeyDate": journey_date,
        "classCode": class_code,
        "quotaCode": quota_code
    })