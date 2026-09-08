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


def get(path: str, params: dict) -> dict:
    try:
        response = requests.get(f"{BACKEND_URL}{path}", params=params, timeout=5, headers=_HEADERS)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}

def post(path: str, body: dict) -> dict:
    try:
        response = requests.post(f"{BACKEND_URL}{path}", json=body, timeout=5, headers=_HEADERS)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}

def patch(path: str, body: dict) -> dict:
    try:
        response = requests.patch(f"{BACKEND_URL}{path}", json=body, timeout=5, headers=_HEADERS)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}
