# Sahyatri

Sahyatri is a tourism redistribution platform built for **Smart India Hackathon problem statement SIH 26204**. It helps travellers find less-crowded destinations and dates *before* they book, instead of discovering the crowd after they arrive. The same data gives tourism operators, local gig workers, and government tourism authorities practical tools to manage demand.

The core idea is simple: every destination gets a **pressure score** for a given date. When the place a traveller wants is over pressure, the planner offers a calmer alternative (a nearby destination or a shifted date) and shows honestly what changes. The traveller decides. Declining the alternative is a normal outcome, not something the UI tries to talk anyone out of.

---

## Contents

1. [Who it's for](#who-its-for)
2. [Feature highlights](#feature-highlights)
3. [Architecture](#architecture)
4. [How the pressure engine works](#how-the-pressure-engine-works)
5. [How a trip gets planned](#how-a-trip-gets-planned)
6. [Tech stack](#tech-stack)
7. [Repository structure](#repository-structure)
8. [Prerequisites](#prerequisites)
9. [Local setup](#local-setup)
10. [Environment variables](#environment-variables)
11. [Frontend routes](#frontend-routes)
12. [Backend API overview](#backend-api-overview)
13. [AI service endpoints](#ai-service-endpoints)
14. [Background jobs and scripts](#background-jobs-and-scripts)
15. [Testing](#testing)
16. [Deployment](#deployment)
17. [Contributing](#contributing)
18. [Known issues](#known-issues)
19. [Further documentation](#further-documentation)

---

## Who it's for

Sahyatri is four connected experiences sharing one backend and one set of pressure data:

| Role | What they do |
| --- | --- |
| **Traveller** | Plans trips against real crowding data, gets offered calmer options, books verified local businesses, joins travel groups, verifies visits, reports safety concerns |
| **Operator** | Lists a homestay, guesthouse or restaurant; declares availability; runs flash offers; posts gigs to hire local staff; gets AI-generated marketing content and feedback insights; tracks revenue |
| **Worker** | Drivers, guides, cooks, cleaners and porters find gig work, build a verified profile, and get rated after every job, including being hired as a Group Travel "captain" |
| **Authority** | Watches destination pressure, capacity and redistribution on a live dashboard; moderates community-suggested places and complaints; can broadcast an emergency alert to every account |

---

## Feature highlights

- **Pressure-aware trip planning.** A live heatmap and a per-destination pressure score built from six signals, including a machine-learning demand forecast. Over-pressure plans get real alternative-destination and alternative-date suggestions, with the saving in rupees and the before/after pressure.
- **AI trip planning and chat.** The itinerary itself is built by deterministic Python code, not by a language model. An LLM is used only for language work: travel tips, trip-aware chat, the multilingual assistant (English, Telugu, Hindi), and a downloadable PDF travel brief.
- **Travel Types.** One shared vocabulary of travel styles (adventure, heritage, wildlife, spiritual, food, nightlife, and more) stored on each traveller's profile and reused for preferences, group matching and the AI agent.
- **Travel Education.** Authored destination guides (best time to visit, getting there, local culture, safety, packing, food, accessibility) with a draft → review → published workflow. A destination with no guide says so instead of inventing facts.
- **Group Travel.** Create or discover a group trip, get matched with compatible travellers with plain-English reasons, join or leave with guaranteed capacity limits, and request a verified local guide as the group's captain.
- **Business and booking tools.** Operator-declared availability, bookings, flash offers with automatic waitlist matching, and business search.
- **Proof of visit.** Operators show a six-digit code that changes every 90 seconds; travellers enter it to prove they were really there.
- **Worker/Gig marketplace.** Operators post gigs (guide, driver, cook, cleaner, porter); workers browse, accept, complete and rate them.
- **Trust and safety.** Community-suggested places (moderated by an authority before going live), verified alerts, emergency contacts, revocable shareable trip links, and one complaint queue for all account types.
- **Emergency broadcast alerts.** An authority can send an urgent platform-wide alert that emails every account and appears as a banner on every page.
- **WhatsApp onboarding.** An operator can register a business by sending a voice note on WhatsApp, in their own language. Speech-to-text uses Sarvam Saaras v4 (22 Indian languages plus English).
- **Authority dashboard.** Live pressure, capacity gaps, redistribution impact and offer acceptance rates, plus the moderation queues.
- **Low-bandwidth friendly.** Installable PWA, a data-saver mode, an offline request queue, and gzip/brotli compression on every API response.

---

## Architecture

Sahyatri is three independently deployed services backed by one MongoDB Atlas database.

| Service | Technology | Local URL | Responsibility |
| --- | --- | --- | --- |
| Frontend | React 19, Vite, Tailwind CSS 4, Zustand | `http://localhost:5173` | Browser app and all four role-based UIs |
| Backend | Node.js 20+, Express 5, Mongoose | `http://localhost:5001` | Auth, all data access, business logic, third-party providers, background jobs |
| AI service | Python 3.12, FastAPI, Google ADK, LiteLLM | `http://localhost:8000` | Trip planning, the pressure gate, chat, voice transcription, ML demand forecasts, PDF travel briefs |
| Database | MongoDB Atlas | — | All persistent data, accessed only through the backend |

```text
                   ┌───────────────────────────────┐
  Browser ────────▶│  Frontend (React SPA, Vercel)  │
                   └──────┬─────────────────┬───────┘
         REST + auth cookie│                 │ plan trip / chat / brief
                          ▼                 ▼
┌──────────────────────────────┐   ┌──────────────────────────────┐
│  Backend (Express, Render)   │◀──│  AI service (FastAPI, Render)│
│  - only holder of API keys   │   │  - deterministic planner     │
│  - only process that talks   │   │  - pressure gate (0.60)      │──▶ LLM via LiteLLM
│    to MongoDB                │──▶│  - demand ML model (XGBoost) │    (Vertex Gemini,
│  - pressure engine, jobs     │   │  - Sarvam speech-to-text     │     Groq, Mistral)
└──────┬───────────────┬───────┘   └──────────────────────────────┘
       │               │
       ▼               ▼
 MongoDB Atlas   Google Maps/Places/Routes, Open-Meteo, RailRadar,
                 Cloudinary, Brevo email, WhatsApp Cloud API
```

Key design rules:

- **The backend owns all data and all credentials.** The AI service never connects to MongoDB. Every AI tool calls the backend's normal REST API, so the AI can never see or change anything a signed-in user couldn't.
- **Two separate credentials between services.** The browser signs in against the backend (an HttpOnly JWT cookie, valid for 7 days). When the browser calls the AI service, the AI service forwards that cookie to `GET /api/auth/check` to learn *who* the user is. When the AI service writes data (such as trip drafts), it proves it is the trusted orchestrator with a shared `X-Internal-Service-Token` header.
- **The browser talks to two backends on purpose.** The SPA calls the Express API for everything data-shaped and calls the AI service directly for planning. The only secret in the browser is a Google Maps key restricted by HTTP referrer.
- **Failures degrade instead of crashing.** Provider adapters return an `{ ok, data, meta }` envelope and never throw. If one lookup fails (for example, the Places quota runs out), the plan still completes and lists what's missing.

---

## How the pressure engine works

A destination's pressure for a date is a weighted blend of six signals, each scaled to 0–1. The weights live in `backend/src/config/runtime_config.json` (currently **formula version 3**):

| Signal | Weight | What it measures | Source |
| --- | ---: | --- | --- |
| `demand` | 0.3059 | Forecast visitor demand vs. that destination's normal level for the month | XGBoost model served by the AI service |
| `stay` | 0.2136 | Accommodation scarcity: unavailable share and price vs. baseline | Seeded hotel prices adjusted by the calendar |
| `access` | 0.2135 | How full the trains and roads into the destination are | RailRadar waitlists plus road timetable frequency |
| `calendar` | 0.1068 | Festivals, holidays and weekends | Seeded state calendar |
| `weather` | 0.1068 | How pleasant the weather is (pleasant weather attracts more visitors) | Open-Meteo forecast |
| `capacity` | 0.0534 | How crowded the destination usually gets | Destination's `capacityPrior` (static) |

The blended value goes through a fixed logistic calibration, so the final score stays between 0 and 1 and keeps the same ranking order. Levels are split at 0.25 / 0.50 / 0.75.

Rules that make the score trustworthy:

- **Missing signals are dropped, never set to zero.** If weather data is unavailable, the weather weight is removed and the remaining weights are rescaled. A zero would read as "perfect weather" and quietly lower every score. Each stored score records which signals were `dropped` and is marked `lowConfidence` if more than 40% of the weight is missing.
- **No fake road data.** No road provider returns seat availability, only timetable frequency. When that happens the row is marked `degraded: ["road"]` and the access signal falls back to the static prior, rather than pretending to be live occupancy.
- **Stale formulas are recomputed.** A stored score is reused only if it is less than 24 hours old *and* was computed with the current formula version. Otherwise it is recomputed live (with a 4-second budget), falling back to the newest stored row if that times out.
- **The gate is code, not a prompt.** The AI service offers alternatives when a score is **≥ 0.60** (`PRESSURE_GATE` in `ai-service/app/main.py`). No model can skip this check. A missing score is never treated as "low".

> `runtime_config.json` exists in both `backend/src/config/` and `ai-service/app/config/`, because each Render service deploys only its own folder. If you change the weights, update both copies.

---

## How a trip gets planned

1. The traveller submits origin, destination, dates, number of travellers and budget. The AI service validates the input first (1–20 travellers, budget > 0, real dates, end ≥ start) before spending any API calls.
2. The AI service identifies the user through the backend, then runs seven lookups in parallel through the backend: weather, two Places searches, road info, businesses, alerts and route.
3. It builds the itinerary in plain Python (no LLM): orders stops, anchors a hotel, and attaches place photos. If Places returns nothing, it falls back to a curated list of named stops, or an empty day, never invented places.
4. It reads the destination's pressure and calculates the budget (hotel, food, and local transport priced from the actual distance between stops).
5. It asks the LLM for travel tips (one call, capped at 12 seconds; if it fails, the plan simply has no tips).
6. If pressure is ≥ 0.60, it asks the backend for alternative destinations and dates and shows a swap card with before/after pressure and the rupee saving.
7. The plan is saved as a trip. When the traveller accepts or declines a swap, the pressure is re-read for what will actually be planned, and the decision is recorded. The authority dashboard reports these outcomes.

The whole request has a hard limit of **180 seconds**.

---

## Tech stack

| Area | Tools |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, Zustand 5, React Router 7, Axios (with retry), Lucide icons, vite-plugin-pwa, Google Maps JavaScript API |
| Backend | Express 5, Mongoose 8, JSON Web Tokens, bcryptjs, express-rate-limit, compression, multer, Cloudinary SDK, Axios |
| AI service | FastAPI, Uvicorn, Google ADK, LiteLLM, google-genai, XGBoost + joblib, NumPy, ReportLab, Requests |
| Speech-to-text | Sarvam Saaras v4 (WhatsApp onboarding), Groq Whisper large-v3 (operator content generator voice input) |
| Data | MongoDB Atlas; 200 destination seed files |
| Testing | Jest + mongodb-memory-server (backend), Python `unittest` (AI service), ESLint (frontend) |
| Hosting | Render (backend, AI service), Vercel (frontend) |

---

## Repository structure

```text
SIH_26204/
├── backend/                       Express 5 API (Node ≥ 20, ES modules)
│   ├── src/
│   │   ├── index.js               Entry point: middleware, CORS allowlist, /health, route mounts, alert scheduler
│   │   ├── routes/                One router per API group
│   │   ├── controllers/           Request/response handling only
│   │   ├── services/              Domain logic: pressure, substitution, onboarding, waitlist,
│   │   │                          proof of visit, community, feedback, gigs, groups, revenue, …
│   │   ├── providers/             External API adapters (Google Maps, geocode, Open-Meteo, RailRadar,
│   │   │                          road transport, fares, stay estimates, demand ML)
│   │   ├── models/                Mongoose schemas
│   │   ├── middleware/            Auth, role checks, service-token auth, rate limits, validation
│   │   ├── jobs/                  Alert polling (runs in-process), pressure precompute and offer expiry (run by hand)
│   │   ├── lib/                   DB connection, JWT, Cloudinary, mailer and email templates, caching, helpers
│   │   ├── config/                runtime_config.json (pressure weights and calibration)
│   │   └── seeds/                 200 destination JSON files, businesses, fares, calendar, pressure CSVs, seed scripts
│   ├── test-fixtures/             Road-frequency data (read at runtime by the road provider)
│   ├── budget.http                Manual budget API requests (VS Code REST Client)
│   └── *.postman_collection.json  Postman collections (budget, trust vertical)
│
├── ai-service/                    FastAPI service (Python 3.12)
│   ├── app/
│   │   ├── main.py                Entry point: planner, pressure gate, chat, onboarding, travel brief
│   │   ├── agents/                Google ADK agents (travel agent, multimodal agent)
│   │   ├── tools/                 Agent tools; every one calls the backend REST API
│   │   ├── services/              Backend client, trip drafts, demand predictor
│   │   ├── onboarding/            Speech-to-text (Sarvam) and extraction prompt, with unit tests
│   │   ├── models/                model_demand_causal.pkl (XGBoost demand model)
│   │   ├── config/                Model feature order and runtime config
│   │   └── pdf_builder.py         ReportLab travel-brief PDF
│   └── test_agent.py              Manual end-to-end agent check (needs real model credentials)
│
├── frontend/                      React 19 + Vite single-page app (PWA)
│   ├── src/
│   │   ├── App.jsx                Routes and role guards
│   │   ├── components/            Feature folders: map, planner, pressure, swap, trust, operator,
│   │   │                          worker, authority, groups, profile, auth, ui, …
│   │   ├── store/                 Zustand stores, one per feature area
│   │   ├── lib/                   API client, Google Maps loader, labels, offline queue, caching helpers
│   │   └── pages/                 Landing page and map page
│   ├── public/                    Logo, India map, PWA icons
│   └── vercel.json                Vercel build settings and SPA rewrite
│
├── scripts/                       Distance calibration, pressure backtest, git-hook setup
├── .githooks/commit-msg           Conventional Commits check
├── render.yaml                    Render blueprint for the backend and AI service
├── ARCHITECTURE.md                In-depth architecture write-up
├── API_CONTRACTS.md               API contracts between team members and services
└── COMMIT_CONVENTION.md           Commit message rules
```

---

## Prerequisites

- **Node.js 20 or later** and npm
- **Python 3.12** (matches the deployed runtime)
- **A MongoDB database**, such as a free MongoDB Atlas cluster
- **API keys only for the features you want to try.** Most features degrade gracefully without a key (for example, emails are printed to the console when no email key is set).
- **An LLM provider** for the AI features: Google Vertex AI (default), Groq, or Mistral

---

## Local setup

Each service can be set up and run on its own. The commands below use PowerShell; on macOS/Linux use `cp` instead of `Copy-Item` and `source .venv/bin/activate` to activate Python.

### 1. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

In `backend/.env`, set at least `MONGODB_URI`, `JWT_SECRET` and `CLIENT_URL`. Add provider keys only for the features you're testing (see [Environment variables](#environment-variables)).

Start the API:

```powershell
npm run dev
```

Health check: `http://localhost:5001/health`

**Loading seed data (development database only).** Destinations are read straight from the JSON files in `src/seeds/destinations/`, and pressure scores are computed on demand, so the app works without seeding. To load businesses, availability, calendar and pressure history into MongoDB:

```powershell
node src/seeds/import_pressure_v3.js --dry-run
node src/seeds/import_pressure_v3.js --yes
npm run seed
```

> ⚠️ These scripts **delete and replace** data: `import_pressure_v3.js --yes` clears the whole `destination_pressures` collection, and `npm run seed` replaces seeded destinations, seeded businesses and business-declared availability. Never point them at a production database. Also see [Known issues](#known-issues): `npm run seed` currently needs a file that is not in the repository.

### 2. AI service

```powershell
cd ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

In `ai-service/.env`, set:

- `BACKEND_URL` (default `http://localhost:5001`)
- `INTERNAL_SERVICE_TOKEN`: **must exactly match** the backend's value
- `CLIENT_URL`: the frontend origin
- `MODEL` plus credentials for that provider:
  - Vertex AI (default, `vertex_ai/gemini-2.5-flash`): run `gcloud auth application-default login`, or put a service-account file in `.gcp/` (gitignored) and set `GOOGLE_APPLICATION_CREDENTIALS`, `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION`
  - Groq: set `MODEL=groq/<model>` and add `GROQ_API_KEY`
  - Mistral: set `MODEL=mistral/<model>` and add `MISTRAL_API_KEY`
- `SARVAM_API_KEY` if you want voice onboarding

Start the service:

```powershell
uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`

### 3. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

### Recommended start order

Backend → AI service → frontend. The frontend and AI service fall back to localhost defaults, so you can run just the pieces you're working on.

---

## Environment variables

Each service has its own `.env` file. They are never shared and never committed. The `.env.example` in each folder is the starting template.

### Backend (`backend/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Signs the login cookie |
| `PORT` | No | API port (`.env.example` uses `5001`; code default is `5000`) |
| `CLIENT_URL` | Yes | Allowed frontend origin(s), comma-separated |
| `NODE_ENV` | Yes | `development` locally, `production` when deployed (controls secure cookies) |
| `INTERNAL_SERVICE_TOKEN` | For AI features | Shared secret with the AI service; must match exactly |
| `AI_SERVICE_URL` | For ML demand | AI service base URL, e.g. `http://localhost:8000` |
| `EXTRACT_SERVICE_URL` | For WhatsApp onboarding | Full URL of the AI service's `/onboarding/extract` |
| `TRANSCRIBE_SERVICE_URL` | For WhatsApp onboarding | Full URL of the AI service's `/onboarding/transcribe` |
| `GOOGLE_MAPS_API_KEY` | For maps data | Places, Routes and Geocoding (server-side) |
| `GOOGLE_GEOCODE_API_KEY` | No | Separate geocoding key; falls back to `GOOGLE_MAPS_API_KEY` |
| `RAILRADAR_API_KEY` | For train data | Train seat availability |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | For uploads | Profile pictures, community and onboarding photos |
| `BREVO_API_KEY` | No | Sends email; when unset, emails are printed to the console |
| `MAIL_FROM` | With Brevo | The verified sender address |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | For WhatsApp | Meta WhatsApp Cloud API |
| `GROQ_API_KEY` | For content generator | Marketing content and voice input for operators |
| `MISTRAL_API_KEY` | No | Fallback for the content generator if Groq fails |
| `PRESSURE_MAP_CONCURRENCY` | No | Parallel pressure computations for the heatmap (default `10`) |

### AI service (`ai-service/.env`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MODEL` | Yes | LiteLLM model id in `provider/model` form (default `vertex_ai/gemini-2.5-flash`) |
| `BACKEND_URL` | Yes | Backend base URL (default `http://localhost:5001`) |
| `INTERNAL_SERVICE_TOKEN` | Yes | Must match the backend's value |
| `CLIENT_URL` | Yes | Allowed frontend origin(s), same value as the backend |
| `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS` | For Vertex AI | Google Cloud credentials |
| `GROQ_API_KEY` / `MISTRAL_API_KEY` | For those models | Read automatically by LiteLLM when `MODEL` uses that provider |
| `SARVAM_API_KEY` | For voice onboarding | Sarvam speech-to-text |

### Frontend (`frontend/.env`)

These values are built into the app at build time.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | Yes | Backend API base, e.g. `http://localhost:5001/api` |
| `VITE_AI_SERVICE_URL` | Yes | AI service base, e.g. `http://localhost:8000` |
| `VITE_GOOGLE_MAPS_API_KEY` | For maps | Browser Maps key; **restrict it by HTTP referrer** in Google Cloud Console |
| `VITE_WHATSAPP_ONBOARDING_NUMBER` | No | WhatsApp number shown to operators for voice onboarding |

---

## Frontend routes

| Access | Routes |
| --- | --- |
| **Public** | `/` (landing), `/signin`, `/signup`, `/forgot-password`, `/reset-password`, `/explore` (pressure heatmap), `/explore/:destId`, `/businesses`, `/alerts`, `/trip/share/:token` |
| **Any signed-in user** | `/home` (trip planner), `/multimodal-agent`, `/map`, `/trips`, `/swap`, `/trip-confirmation`, `/visits`, `/community`, `/forum`, `/services`, `/notifications`, `/offers`, `/safety`, `/profile`, `/travel-together`, `/travel-together/groups/:id` |
| **Operator** | `/operator`, `/register-business`, `/hire-people`, `/operator/waitlist`, `/operator/analytics`, `/operator/content-generator`, `/operator/revenue`, `/operator/complaints` |
| **Worker** | `/worker`, `/worker/jobs`, `/worker/complaints` |
| **Authority** | `/authority`, `/authority/complaints`, `/authority/alerts` |
| **Old URLs (redirect)** | `/login`, `/pressure`, `/planner`, `/map-preview`, `/verify-email`, `/operator/post-gig` |

`/visits` shows operators their rotating code and everyone else the code-entry form. `/community` shows authorities the moderation queue and everyone else the submission form. Role checks in the browser are for convenience only; the backend enforces every permission itself.

---

## Backend API overview

All routes live under `/api`. The full list is mounted in `backend/src/index.js`.

| Area | Base paths |
| --- | --- |
| Auth and users | `/api/auth` (signup, login, logout, check, password reset/change, profile; rate-limited), `/api/v1/users` |
| Planning inputs | `/api/v1/pressure`, `/api/alternatives`, `/api/v1/budget`, `/api/destinations`, `/api/geocode` |
| Provider passthroughs | `/api/weather`, `/api/trains`, `/api/places` (includes a photo proxy that keeps the key server-side), `/api/routes`, `/api/fare`, `/api/road` |
| Trips and analytics | `/api/v1/trips`, `/api/v1/analytics`, `/api/v1/dashboard` |
| Trust and safety | `/api/v1/visits`, `/api/community`, `/api/v1/offers`, `/api/v1/waitlist`, `/api/v1/alerts`, `/api/v1/businesses`, `/api/v1/bookings`, `/api/v1/safety` |
| Operator tools | `/api/v1/content`, `/api/v1/feedback`, `/api/v1/revenue` |
| Workers and groups | `/api/v1/workers`, `/api/v1/gigs`, `/api/v1/operators`, `/api/v1/group-trips`, `/api/v1/travel-types` |
| Travel Education | `/api/v1/destinations` (separate from the file-based `/api/destinations` list) |
| Messaging | `/api/webhook/whatsapp`, `/api/internal/onboarding`, `/api/v1/broadcast-alerts` |
| Health | `GET /health` (does not depend on MongoDB) |

---

## AI service endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health check for Render |
| `POST /api/plan-trip` | Full trip plan, pressure gate, swap offers, saves a draft trip (180 s limit) |
| `POST /api/plan-trip/confirm` | Accept or decline a swap offer and re-plan |
| `POST /api/v1/pressure/predict-demand` | ML demand forecast used by the backend's pressure engine |
| `POST /onboarding/transcribe` | Voice note → text (Sarvam) |
| `POST /onboarding/extract` | Transcript → structured business/worker details |
| `POST /internal/ai/recommendation` | Short map-overlay recommendation (10 s limit) |
| `POST /internal/ai/chat` | Trip-aware "Ask AI" chat (15 s limit, 20 requests per 10 minutes) |
| `GET /api/multimodal/meta` | Supported languages and roles |
| `POST /api/multimodal/transcribe` | Voice input for the multilingual assistant |
| `POST /api/multimodal/chat` | Multilingual assistant turn (English, Telugu, Hindi) |
| `POST /internal/ai/travel-brief` | Structured travel brief |
| `POST /internal/travel-brief/pdf` | The same brief as a PDF file |

---

## Background jobs and scripts

| Job or script | How it runs | What it does |
| --- | --- | --- |
| Alert polling (`jobs/pollAlerts.job.js`) | Automatically on startup, then every 6 hours | Turns Open-Meteo data into weather advisories |
| Pressure precompute (`jobs/precomputePressure.job.js`) | `node src/jobs/precomputePressure.job.js` (from `backend/`) | Fills pressure scores ahead of time plus 30 days of history, so the heatmap and trends load from cache |
| Offer expiry (`jobs/expireOffers.job.js`) | `node src/jobs/expireOffers.job.js` (from `backend/`) | Marks expired flash offers (alongside MongoDB's automatic cleanup) |
| Seed validation | `node src/seeds/validateSeeds.js` (from `backend/`) | Checks the seed files are well-formed |
| Distance calibration | `node scripts/calibrateDistance.js` (from the repo root; needs `backend/` dependencies and a database) | Writes `build/distance-histogram.json`, which tunes how far alternative destinations may be |
| Pressure backtest | `node scripts/backtest.js` | Offline check of the pressure formula (see [Known issues](#known-issues)) |

---

## Testing

**Backend** (Jest; uses an in-memory MongoDB where a database is needed):

```powershell
cd backend
npm test
```

**AI service** (Python `unittest`, run from `ai-service/` with the virtual environment active):

```powershell
python -m unittest app.onboarding.test_extraction_prompt app.onboarding.test_transcribe_sarvam
```

`python test_agent.py` runs the travel agent end to end. It calls a real model, so it needs working credentials.

**Frontend:**

```powershell
cd frontend
npm run lint
npm run build
```

**Manual API testing:** open `backend/budget.http` in VS Code with the REST Client extension, or import the Postman collections in `backend/`.

---

## Deployment

The backend and AI service deploy to **Render** using `render.yaml`. The frontend deploys to **Vercel** (settings in `frontend/vercel.json`).

Because the three services reference each other's URLs, deploy in this order:

1. **Backend** on Render. Set its secrets in the Render dashboard (`render.yaml` lists which variables must exist but never holds their values). Also add any optional keys you need that aren't listed there, such as `BREVO_API_KEY`, `MAIL_FROM`, `WHATSAPP_*`, `GROQ_API_KEY` or `MISTRAL_API_KEY`.
2. **AI service** on Render, with `BACKEND_URL` pointing at the deployed backend.
3. **Frontend** on Vercel, with `VITE_API_URL` and `VITE_AI_SERVICE_URL` pointing at the two deployed services.
4. Go back and set `CLIENT_URL` on both the backend and the AI service to the real Vercel URL, and set the backend's `AI_SERVICE_URL`, `EXTRACT_SERVICE_URL` and `TRANSCRIBE_SERVICE_URL`.

Before going live, check:

1. **`NODE_ENV=production` on the backend.** This controls the cookie's `secure`/`sameSite` settings. If it's wrong, login appears to succeed and every following request returns 401.
2. **`CLIENT_URL` on both** the backend and the AI service includes the deployed frontend's exact origin.
3. **`INTERNAL_SERVICE_TOKEN` is identical** on the backend and the AI service. Otherwise every AI-to-backend call (trip drafts, group tools, preferences) fails.
4. **`AI_SERVICE_URL`, `EXTRACT_SERVICE_URL` and `TRANSCRIBE_SERVICE_URL`** point at the deployed AI service, not `localhost`. Otherwise ML demand forecasts and WhatsApp onboarding silently stop working.
5. **The browser Maps key is restricted by HTTP referrer** to your domain.
6. **For WhatsApp**, set the Meta webhook to `https://<backend-url>/api/webhook/whatsapp` using your `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
7. **No secrets are committed.** All credentials live in the hosting dashboards.

---

## Contributing

- **Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/)** (`type(scope): description`, e.g. `feat(pressure): add demand signal`). Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `build`, `chore`, `perf`, `style`, `revert`. See `COMMIT_CONVENTION.md`.
- **Install the commit-message hook once per clone** (run from the repo root):

  ```powershell
  .\scripts\setup-hooks.bat
  ```

  On macOS/Linux, run `sh scripts/setup-hooks.sh`. Merge, squash and fixup commits are allowed through automatically.
- **Run the tests** for any service you change before opening a pull request.
- **Never commit `.env` files or credentials.** `.env`, `.gcp/` and `build/` are gitignored.

---

## Known issues

- **`npm run seed` fails on a fresh clone.** `seedDatabase.js` reads `backend/src/seeds/pressure_history.json`, which is gitignored and not in the repository. Pressure history now comes from `pressure_history_v3.csv` via `import_pressure_v3.js`.
- **`scripts/backtest.js` does not run.** It imports `backend/src/services/pressure/mockProviders.js`, which is not in the repository.
- **`npm run prepare-hooks` (in `backend/`) sets the wrong hooks path** (`../.githooks`). Use the `scripts/setup-hooks` scripts instead.
- **Some data has no writer yet.** The `destination_demand` and `business_availability` inputs for the capacity-gap metric are not populated, so the dashboard shows `null` for those metrics instead of a made-up number.
- **`ARCHITECTURE.md` predates formula version 3.** It describes the older five-signal pressure formula; the table above reflects the current code.

---

## Further documentation

- [System architecture](ARCHITECTURE.md): in-depth design, diagrams and trade-offs
- [API contracts](API_CONTRACTS.md): endpoints that cross team and service boundaries
- [Commit convention](COMMIT_CONVENTION.md): commit message rules

---

## License

Developed for Smart India Hackathon problem statement **SIH 26204**.
