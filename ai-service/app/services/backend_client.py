# app/services/backend_client.py
import requests
import os

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5001")

def get(path: str, params: dict) -> dict:
    try:
        response = requests.get(f"{BACKEND_URL}{path}", params=params, timeout=5)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}

def post(path: str, body: dict) -> dict:
    try:
        response = requests.post(f"{BACKEND_URL}{path}", json=body, timeout=5)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}

def patch(path: str, body: dict) -> dict:
    try:
        response = requests.patch(f"{BACKEND_URL}{path}", json=body, timeout=5)
        return response.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}