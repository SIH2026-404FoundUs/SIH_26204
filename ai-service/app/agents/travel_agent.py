from google.adk.agents import Agent
from app.tools.weather import get_weather
from app.tools.trains import get_train_availability
from app.tools.places import search_places
from app.tools.routes import calculate_route
from app.tools.fare import estimate_local_transport
from app.tools.road import search_road_services
import os

travel_agent = Agent(
    name="travel_planner",
    model=os.getenv("MODEL", "gemini-2.5-flash"),
    instruction="""You help plan trips in India. Use the available tools to
    check weather, train availability, search places, calculate routes, and
    estimate local transport costs. Always call a tool to get real data —
    never invent prices, distances, or availability from your own knowledge.""",
    tools=[
        get_weather,
        get_train_availability,
        search_places,
        calculate_route,
        estimate_local_transport,
        search_road_services,
    ],
)