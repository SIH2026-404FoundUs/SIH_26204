# ai-service/app/agents/travel_agent.py
from pydantic import BaseModel, Field
from typing import List, Optional
import os
from google.adk.agents import Agent
from app.tools.weather import get_weather
from app.tools.trains import get_train_availability
from app.tools.places import search_places
from app.tools.routes import calculate_route
from app.tools.fare import estimate_local_transport
from app.tools.road import search_road_services
from app.tools.pressure import get_pressure
from app.tools.alternatives import find_alternatives, find_alternative_dates
from app.tools.trip_cost import calculate_trip_cost
from app.tools.itinerary import optimize_itinerary
from app.tools.alerts import get_verified_alerts
from app.tools.businesses import search_businesses
from app.tools.user_preferences import get_user_preferences


class WeatherInfo(BaseModel):
    maxTemp: Optional[float] = None
    precipProb: Optional[int] = None

class RouteInfo(BaseModel):
    distanceKm: Optional[float] = None
    durationMinutes: Optional[int] = None

class HotelOption(BaseModel):
    name: str
    rating: Optional[float] = None

class TrainInfo(BaseModel):
    trainNumber: Optional[str] = None
    waitlistDepth: Optional[int] = None
    status: Optional[str] = None

class FareInfo(BaseModel):
    mode: Optional[str] = None
    fareINR: Optional[float] = None

class RoadInfo(BaseModel):
    corridor: Optional[str] = None
    frequencyPerDay: Optional[int] = None

class PressureInfo(BaseModel):
    # None means every component failed to compute -> crowding unknown.
    # Not the same as zero crowding; leave it None rather than guessing.
    score: Optional[float] = None
    components: List[str] = Field(default_factory=list)
    dropped: List[str] = Field(default_factory=list)
    degraded: List[str] = Field(default_factory=list)
    lowConfidence: Optional[bool] = None
    stale: Optional[bool] = None

class AlternativesInfo(BaseModel):
    # An empty `places` is a real state, not a failure -> keep it an empty
    # list and let `dates` still carry a fallback option.
    requested: Optional[dict] = None
    places: List[dict] = Field(default_factory=list)
    dates: List[dict] = Field(default_factory=list)
    relaxedRelief: Optional[bool] = None

class CostBreakdown(BaseModel):
    # Always a computed estimate summed from earlier tool results, never a
    # live quoted price -> `estimate` stays True whenever this is filled in.
    intercity: Optional[float] = None
    accommodation: Optional[float] = None
    food: Optional[float] = None
    activities: Optional[float] = None
    localTransport: Optional[float] = None
    subtotal: Optional[float] = None
    contingency: Optional[float] = None
    grandTotal: Optional[float] = None
    estimate: Optional[bool] = None

class ItineraryDay(BaseModel):
    # An empty stop list for a day is a real result (more days than stops),
    # not a gap to fill in.
    day: Optional[int] = None
    stops: List[dict] = Field(default_factory=list)

class ItineraryInfo(BaseModel):
    days: List[ItineraryDay] = Field(default_factory=list)

class TripSummary(BaseModel):
    weather: Optional[WeatherInfo] = None
    route: Optional[RouteInfo] = None
    hotels: List[HotelOption] = Field(default_factory=list)
    train: Optional[TrainInfo] = None
    fare: Optional[FareInfo] = None
    road: Optional[RoadInfo] = None
    pressure: Optional[PressureInfo] = None
    alternatives: Optional[AlternativesInfo] = None
    costBreakdown: Optional[CostBreakdown] = None
    itinerary: Optional[ItineraryInfo] = None
    summary: str = Field(description="One or two sentence plain-language summary")


travel_agent = Agent(
    name="travel_planner",
    model=os.environ.get("MODEL", "gemini-2.5-flash"),
    instruction="""You help plan trips in India. Use the available tools to
    get real data. Never invent prices, distances, durations, availability, or
    waitlist numbers. Only fill in the schema fields you have real tool data for —
    leave others as null rather than guessing.

    calculate_trip_cost only adds up numbers you already have. Call the fare,
    train, hotel and other data tools FIRST, then pass their real values into
    it — never invent a component value or a grand total yourself.""",
    tools=[get_weather, get_train_availability, search_places, calculate_route, estimate_local_transport, search_road_services, get_pressure, find_alternatives, find_alternative_dates, get_verified_alerts, search_businesses, get_user_preferences, calculate_trip_cost, optimize_itinerary],
    output_schema=TripSummary,
)
