# ai-service/app/main.py
import json
import os
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.adk.runners import InMemoryRunner
from google.genai import types
from pydantic import BaseModel, Field

from app.agents.travel_agent import travel_agent

load_dotenv()

APP_NAME = "travel_planner"

# The frontend dev server origin, as documented by CLIENT_URL in
# backend/.env.example (Vite's default 5173). Overridable so a deployed
# frontend doesn't need a code change.
CLIENT_URL = os.environ.get("CLIENT_URL", "http://localhost:5173")

app = FastAPI(title="AI Travel Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[CLIENT_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# One runner for the process; sessions are per-request so concurrent plans
# don't share conversation history.
runner = InMemoryRunner(agent=travel_agent, app_name=APP_NAME)


class PlanTripRequest(BaseModel):
    userId: str
    origin: str
    destId: str
    startDate: str
    endDate: str
    travellers: int
    budgetINR: float
    interests: Dict[str, float] = Field(default_factory=dict)


def build_prompt(req: PlanTripRequest) -> str:
    if req.interests:
        interests = ", ".join(
            f"{name} (weight {weight})" for name, weight in req.interests.items()
        )
    else:
        interests = "none specified"

    return (
        f"Plan a trip from {req.origin} to destination ID {req.destId}, "
        f"travelling from {req.startDate} to {req.endDate} for {req.travellers} "
        f"traveller(s) with a total budget of INR {req.budgetINR}. "
        f"Traveller interests: {interests}. "
        "Use the tools to gather real data and fill in the trip summary."
    )


def extract_structured_output(event: Any) -> Optional[dict]:
    """Return the TripSummary payload carried by a final response event.

    The agent has an output_schema, so its final event carries the summary as
    a JSON text part. Non-final events (tool calls, tool results, partial
    streaming chunks) carry no structured output and yield None.
    """
    if not event.is_final_response():
        return None

    content = getattr(event, "content", None)
    if content is None or not getattr(content, "parts", None):
        return None

    for part in content.parts:
        text = getattr(part, "text", None)
        if not text:
            continue
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed

    return None


async def run_travel_agent(req: PlanTripRequest) -> dict:
    """Run the agent to completion and return its structured TripSummary.

    Raises LookupError if the run finished without producing structured output.
    """
    session = await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id=req.userId,
    )

    message = types.Content(
        role="user",
        parts=[types.Part(text=build_prompt(req))],
    )

    result: Optional[dict] = None
    async for event in runner.run_async(
        user_id=req.userId,
        session_id=session.id,
        new_message=message,
    ):
        # Keep the last structured payload: a run can emit more than one final
        # response, and the latest one is the completed summary.
        structured = extract_structured_output(event)
        if structured is not None:
            result = structured

    if result is None:
        raise LookupError("agent run produced no structured TripSummary output")

    return result


@app.post("/api/plan-trip")
async def plan_trip(req: PlanTripRequest):
    try:
        return await run_travel_agent(req)
    except LookupError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"agent run failed: {type(exc).__name__}: {exc}",
        ) from exc
