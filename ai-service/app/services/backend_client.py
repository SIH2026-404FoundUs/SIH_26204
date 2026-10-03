# app/services/backend_client.py
import requests
import os

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5001")

# QA finding (brutal-qa-report.md, P0): killing the backend mid-request, then
# bringing it back up, left every subsequent call from this process hanging
# indefinitely -- well past the 5s timeout below -- until the whole ai-service
# process was restarted. Root cause: `requests`'s default session keeps TCP
# connections alive and pools them for reuse; a connection open to a backend
# process that dies abruptly (not a clean shutdown) doesn't always get
# evicted from that pool, so the next call can be handed a half-dead socket
# and hang waiting on it at a layer the `timeout=` kwarg doesn't reach.
# Connection: close forces a fresh TCP connection on every call -- slightly
# more overhead per request, but these are already 5s-timeout, non-hot-path
# calls, and it removes an entire class of "recovered but still stuck" bug.
_HEADERS = {"Connection": "close"}

def _service_headers() -> dict:
    headers = dict(_HEADERS)
    token = os.environ.get("INTERNAL_SERVICE_TOKEN")
    if token:
        headers["X-Internal-Service-Token"] = token
    return headers


def _request(method: str, path: str, timeout: float = 5, **kwargs) -> dict:
    try:
        response = requests.request(method, f"{BACKEND_URL}{path}", timeout=timeout, headers=_service_headers(), **kwargs)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get(path: str, params: dict) -> dict:
    return _request("GET", path, params=params)


# timeout is per call: /api/alternatives fills a cache on its first call after a
# backend start (~20s measured), far past the 5s budget meant for the fast routes.
def post(path: str, body: dict, timeout: float = 5) -> dict:
    return _request("POST", path, timeout=timeout, json=body)


def patch(path: str, body: dict) -> dict:
    return _request("PATCH", path, json=body)
