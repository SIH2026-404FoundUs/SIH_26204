import asyncio
from pathlib import Path
import sys

from dotenv import load_dotenv

# Load credentials before importing the agent; Agent construction reads them.
load_dotenv(Path(__file__).resolve().parent / ".env")

from google.adk.runners import InMemoryRunner
from google.genai import types

from app.agents.travel_agent import travel_agent

# Event payloads carry non-cp1252 characters (e.g. the rupee sign in fare
# summaries), which crash print() on the default Windows console encoding.
# reconfigure() exists on 3.7+ TextIOWrapper; guard it in case stdout has
# been replaced by something that doesn't support it.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PROMPT = (
    "I'm traveling from Delhi to Manali on train number 12952 from NDLS to MMCT "
    "on 2026-09-12 in 3A class. Also tell me the auto fare for a 6.4 km ride in "
    "Hyderabad, and check road transport options for destination ID manali."
)


async def main():
    runner = InMemoryRunner(
        agent=travel_agent,
        app_name="travel_planner",
    )

    session = await runner.session_service.create_session(
        app_name=runner.app_name,
        user_id="test_user",
    )

    async for event in runner.run_async(
        user_id="test_user",
        session_id=session.id,
        new_message=types.Content(
            role="user",
            parts=[
                types.Part(text=PROMPT),
            ],
        ),
    ):
        print("---EVENT---")
        print(event)


if __name__ == "__main__":
    asyncio.run(main())
