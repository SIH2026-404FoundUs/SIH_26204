# SIH 26204 - Travel Planning & Microservices Platform

Welcome to the **SIH_26204** repository. This project powers an itinerary and travel planning backend featuring user authentication and an intelligent trip budget calculation microservice with source-provenance auditing.

> 📖 **Comprehensive Documentation:** For a complete deep-dive into the codebase, folder structure, features, Jest tests, and API verification, see [PROJECT_OVERVIEW.md](file:///c:/Projects/SIH_26204/PROJECT_OVERVIEW.md).

---

## Key Highlights

- 🔐 **Authentication System:** JWT in HTTP-only cookies, password hashing with bcrypt, profile image uploads via Cloudinary.
- 💰 **Budget Calculation Microservice (`POST /api/v1/budget/calculate`):** High-precision financial calculations with source provenance tracking (`business_declared`, `provider:*`, `seeded`, `estimated`, `manual`, and `mixed`).
- 🛡️ **Defensive Validation:** Comprehensive middleware guarding against missing, zero, or negative cost parameters.
- ⚡ **Non-Blocking Persistence:** Asynchronous MongoDB analytics logging that never blocks client responses even if database connectivity fluctuates.
- 🧪 **23 Passing Automated Tests:** 100% passing Jest test suites covering middleware, services, and live route integrations.
- 📦 **API Tooling Included:** Pre-built `budget.http` (REST Client) and `budget.postman_collection.json` (Postman v2.1) ready to run.
- 🪝 **Conventional Commits Git Hooks:** Version-controlled `.githooks/commit-msg` ensuring standardized commit messages across all contributors.

---

## Quickstart

### 1. Setup & Install Dependencies
```bash
cd backend
npm install
npm run prepare-hooks
```

### 2. Configure Environment Variables
Create a `.env` file in `backend/` based on `.env.example`:
```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Run Automated Tests
```bash
npm test
```
*Expected: 3 Test Suites, 23 Tests, all passing.*

### 4. Start Development Server
```bash
npm run dev
```
The server will start listening at `http://localhost:5001`.

---

## Repository Map

- [PROJECT_OVERVIEW.md](file:///c:/Projects/SIH_26204/PROJECT_OVERVIEW.md) - Full technical architectural report and file catalog.
- [backend/budget.http](file:///c:/Projects/SIH_26204/backend/budget.http) - Interactive REST Client requests with expected responses.
- [backend/budget.postman_collection.json](file:///c:/Projects/SIH_26204/backend/budget.postman_collection.json) - Ready-to-import Postman collection.
- [backend/src/services/budgetService.js](file:///c:/Projects/SIH_26204/backend/src/services/budgetService.js) - Core calculation engine.
- [backend/src/middleware/validateBudgetInput.js](file:///c:/Projects/SIH_26204/backend/src/middleware/validateBudgetInput.js) - Input validation middleware.
- [backend/src/models/Budget.js](file:///c:/Projects/SIH_26204/backend/src/models/Budget.js) - Mongoose database schema.
- [backend/src/routes/budget.routes.js](file:///c:/Projects/SIH_26204/backend/src/routes/budget.routes.js) - Budget calculation route definitions.
- [backend/src/routes/auth.route.js](file:///c:/Projects/SIH_26204/backend/src/routes/auth.route.js) - Authentication route definitions.

---

## Target Architecture

The following is the north-star monorepo layout the platform is building toward. Most paths below do not exist yet — see the Repository Map above and `docs/spec/schema-workplan.md` for what is actually built and the execution order.

```
tourism-platform/
├── package.json                  ← root: npm install/build/start --prefix both
├── API_CONTRACTS.md
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── controllers/
│       │   ├── pressure.controller.js
│       │   ├── alternatives.controller.js
│       │   ├── business.controller.js
│       │   ├── availability.controller.js
│       │   ├── trip.controller.js
│       │   ├── visit.controller.js
│       │   ├── offer.controller.js
│       │   ├── waitlist.controller.js
│       │   ├── community.controller.js
│       │   ├── feedback.controller.js
│       │   ├── alert.controller.js
│       │   └── auth.controller.js
│       │
│       ├── routes/
│       │   ├── pressure.route.js
│       │   ├── alternatives.route.js
│       │   ├── business.route.js
│       │   ├── availability.route.js
│       │   ├── trip.route.js
│       │   ├── visit.route.js
│       │   ├── offer.route.js
│       │   ├── waitlist.route.js
│       │   ├── community.route.js
│       │   ├── feedback.route.js
│       │   ├── alert.route.js
│       │   └── auth.route.js
│       │
│       ├── models/                        ← matches every collection, 1:1
│       │   ├── destination.model.js
│       │   ├── destinationPressure.model.js
│       │   ├── destinationDemand.model.js
│       │   ├── business.model.js
│       │   ├── businessAvailability.model.js
│       │   ├── trip.model.js
│       │   ├── visit.model.js
│       │   ├── offer.model.js
│       │   ├── waitlist.model.js
│       │   ├── communitySubmission.model.js
│       │   ├── feedback.model.js
│       │   ├── alert.model.js
│       │   ├── complaint.model.js
│       │   ├── emergencyContact.model.js
│       │   ├── user.model.js
│       │   └── auditLog.model.js
│       │
│       ├── middleware/
│       │   ├── auth.middleware.js
│       │   ├── validate.middleware.js
│       │   └── rateLimit.middleware.js
│       │
│       ├── lib/                            ← third-party client setup only
│       │   ├── db.js                       ← MongoDB connection
│       │   ├── cloudinary.js
│       │   ├── whatsapp.js                 ← Meta client init
│       │   └── crypto.js                   ← Ed25519/HMAC helpers, if kept
│       │
│       ├── services/                       ← the real logic, one folder per OWNER
│       │   ├── pressure/                   ← Sathvik
│       │   ├── substitution/               ← Madhuri
│       │   ├── incentive/                  ← Bharani
│       │   ├── onboarding/                 ← Bharani
│       │   ├── pov/                        ← Pranay
│       │   ├── waitlist/                   ← Pranay
│       │   ├── community/                  ← Pranay
│       │   ├── feedback/                   ← Pranay
│       │   └── alerts/                     ← Pranay
│       │
│       ├── providers/                      ← Nishith — external API adapters
│       │   ├── googlemaps.provider.js
│       │   ├── railradar.provider.js
│       │   ├── roadtransport.provider.js
│       │   ├── amadeus.provider.js
│       │   └── openmeteo.provider.js
│       │
│       ├── jobs/
│       │   ├── precomputePressure.job.js
│       │   ├── aggregateDemand.job.js
│       │   ├── pollAlerts.job.js
│       │   └── expireOffers.job.js
│       │
│       ├── seeds/                          ← Ananya — plain data, run once
│       │   ├── destinations/
│       │   │   ├── shimla.json
│       │   │   ├── manali.json
│       │   │   └── ... (35-40 files)
│       │   ├── businesses.js
│       │   ├── calendar.js
│       │   └── fares.js
│       │
│       └── server.js
│
├── frontend/
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── swap/
│       │   ├── pressure/
│       │   ├── map/
│       │   ├── onboarding/
│       │   ├── business/
│       │   └── common/
│       │
│       ├── pages/                          ← one subfolder per page
│       │   ├── planner/TripPlannerPage.jsx
│       │   ├── discover/DiscoverPage.jsx
│       │   ├── dashboard/DashboardPage.jsx
│       │   └── business/BusinessConsolePage.jsx
│       │
│       ├── store/                          ← singular, matches convention
│       │   ├── useAuthStore.js
│       │   ├── useTripStore.js
│       │   ├── usePressureStore.js
│       │   └── usePreferenceStore.js
│       │
│       ├── lib/
│       │   ├── axios.js
│       │   └── googleMaps.js
│       │
│       ├── App.jsx
│       └── main.jsx
│
├── ai-service/                              ← FastAPI, no equivalent in the reference
│   └── app/
│       ├── main.py
│       ├── agents/
│       ├── tools/
│       └── onboarding/
│
├── scripts/
│   ├── backtest.js
│   └── calibrateDistance.js
│
└── docs/

```

```
ai-service/
├── .env                          ← QWEN_BASE_URL, QWEN_MODEL, GOOGLE_ADK_CONFIG, BACKEND_URL
├── .gitignore                    ← must include venv/, __pycache__/, .env
├── requirements.txt              ← pinned versions once things are working
├── venv/                         ← never commit this (in .gitignore)
│
└── app/
    ├── main.py                   ← FastAPI app entrypoint, mounts the agent
    │
    ├── agents/
    │   └── travel_agent.py       ← ADK agent definition, registers all tools,
    │                                 holds the planner sequence logic
    │
    ├── tools/                    ← one file per capability, mirrors your
    │   │                            six Express routes almost 1:1
    │   ├── __init__.py
    │   ├── weather.py            ← get_weather()      → calls /api/weather
    │   ├── trains.py             ← search_trains(),
    │   │                            get_train_availability(),
    │   │                            get_train_fare()   → calls /api/trains
    │   ├── places.py             ← search_places(),
    │   │                            get_place_details() → calls /api/places
    │   ├── routes.py             ← calculate_route()   → calls /api/routes
    │   ├── fare.py               ← estimate_local_transport() → calls /api/fare
    │   ├── road.py               ← search_road_services() → calls /api/road
    │   │
    │   ├── pressure.py           ← get_pressure()      → Sathvik's endpoint
    │   ├── alternatives.py       ← find_alternatives(),
    │   │                            find_alternative_dates() → Madhuri's endpoint
    │   ├── alerts.py             ← get_verified_alerts() → Pranay's endpoint
    │   ├── businesses.py         ← search_hotels(),
    │   │                            search_businesses() → Bharani's endpoint
    │   │
    │   ├── cost.py               ← calculate_trip_cost()   — deterministic,
    │   │                            no external call, pure Python math
    │   └── itinerary.py          ← optimize_itinerary()    — deterministic
    │
    ├── onboarding/                ← separate concern, Bharani's territory,
    │   │                             not yours — listed here only because
    │   │                             it lives in the same FastAPI service
    │   ├── transcribe.py
    │   ├── extract.py
    │   └── followup.py
    │
    └── services/
        └── backend_client.py     ← shared helper: one function that wraps
                                      `requests.get(...)`/`.post(...)` with
                                      BACKEND_URL, timeout, and error handling,
                                      so every tool file isn't repeating that
                                      boilerplate
```
