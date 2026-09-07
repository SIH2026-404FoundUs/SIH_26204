# ai-service/app/main.py — FastAPI app entrypoint.
#
# Was empty before this. Mounts only the onboarding/transcription piece
# (bharani-tasks.md Section 1.2/1.6) for now — Nishith's travel_agent isn't
# wired into a running app anywhere yet either, and mounting it isn't this
# change's scope.

from fastapi import FastAPI

from app.onboarding.transcribe import router as onboarding_router

app = FastAPI(title="Tourism Platform AI Service")

app.include_router(onboarding_router, prefix="/onboarding", tags=["onboarding"])


@app.get("/health")
def health():
    return {"ok": True}
