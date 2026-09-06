import asyncio

from dotenv import load_dotenv
from google.adk.runners import InMemoryRunner
from google.genai import types

from app.agents.travel_agent import travel_agent

load_dotenv()


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
                types.Part(
                    text="What's the weather in Manali on 2026-12-26, and how far is it from Delhi by road? Origin is lat 28.6139, lng 77.2090, Manali is lat 32.2432, lng 77.1892."
                )
            ],
        ),
    ):
        print("---EVENT---")
        print(event)


if __name__ == "__main__":
    asyncio.run(main())