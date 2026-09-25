# Sahyatri

Sahyatri is a tourism redistribution platform built for **Smart India Hackathon problem statement SIH 26204**. It helps travellers discover less-crowded destinations and alternative dates *before* they book, instead of after they arrive — while giving tourism operators, gig workers, and government tourism authorities real tools to manage demand across the same data.

The platform scores destination "pressure" from travel access, accommodation availability, calendar events, weather, and capacity signals. When a destination is over capacity for the dates a traveller wants, the planner offers a genuinely calmer alternative — a different place or a different date — and the traveller decides, honestly informed either way. Declining the alternative is a first-class outcome, not something the UI tries to talk you out of.

## Who it's for

Sahyatri isn't one app with one user — it's four connected experiences sharing the same backend and the same pressure data:

| Role | What they do |
| --- | --- |
| **Traveller** | Plans trips against real crowding data, gets redirected to calmer options, books verified local businesses, forms travel groups, verifies visits, reports safety concerns |
| **Operator** | Lists a homestay/guesthouse/restaurant, declares availability, runs flash offers, posts gigs to hire local staff, gets AI-generated marketing content and feedback insights, tracks revenue |
| **Worker** | Drivers, guides, cooks, cleaners, and porters get discovered for gig work, build a verified profile, get rated after every job — includes being hired as a Group Travel "captain" |
| **Authority** | Tracks destination pressure/capacity/redistribution on a live dashboard, moderates community-suggested places and complaints, and can broadcast an emergency alert to every account on the platform |

## Feature highlights

- **Pressure-aware trip planning** — a live heatmap and per-destination pressure score (access, stay availability, calendar, weather, capacity, and an ML demand signal), with genuine alternative-destination/alternative-date suggestions when a plan is over capacity
- **Travel Types** — a shared taxonomy of travel styles (adventure, heritage, wildlife, spiritual, food, nightlife, photography, and more), activities, pace, group size, and trip duration, stored on every traveller's profile and reused everywhere a personalization signal is needed (preferences, Group Travel matching, the AI agent)
- **Travel Education** — authored destination knowledge (best time to visit, getting there/around, local culture, safety, packing, food, accessibility) with a draft → in-review → published workflow, merged live with real pressure and safety-alert data; an unauthored destination honestly says so rather than inventing facts
- **Group Travel** — create or discover a group trip, get matched to compatible travellers with plain-English explainable reasons (never a bare percentage), join/leave/accept lifecycle with atomic capacity guarantees, and request a verified local guide as your group's "captain" through the same Worker/Gig marketplace operators use to hire staff
- **AI trip planning & chat** — a multi-provider agent (Vertex AI Gemini / Groq / Mistral) that plans trips, answers trip-aware questions, transcribes voice input, and generates a PDF travel brief — every tool it calls hits the same backend API a browser would, so it can never see data or bypass authorization a signed-in user couldn't
- **Business & booking tools** — operator-declared availability, bookings, flash offers with waitlist auto-matching, proof-of-visit verification codes, and business search
- **Worker/Gig marketplace** — operators post gigs (guide, driver, cook, cleaner, porter), workers browse/accept/complete/rate them, with availability-aware matching
- **Trust & safety** — community-suggested places (authority-moderated before they go live), verified alerts, emergency contacts, shareable trip records, and a shared complaint-moderation queue across all three account types
- **Emergency broadcast alerts** — an authority can send an urgent, platform-wide alert (disaster, safety incident) that emails every account and shows as a dismissible banner on every page, signed in or not
- **WhatsApp onboarding** — an operator can register a business by voice, over WhatsApp, in their own language
- **Authority dashboard** — live pressure, capacity gaps, redistribution impact, and acceptance-rate analytics, plus the complaint and community-submission moderation queues
- **Offline-aware, low-bandwidth frontend** — a PWA app shell, a data-saver mode, and gzip/brotli compression throughout, because this has to work on the connections tourism destinations actually have

## Architecture

Sahyatri is split into three independently deployable services, all backed by one MongoDB Atlas database:

| Service | Technology | Local URL | Responsibility |
| --- | --- | --- | --- |
| Frontend | React 19, Vite, Tailwind CSS, Zustand | `http://localhost:5173` | Browser application and all four role-based UIs |
| Backend | Node.js, Express 5, Mongoose | `http://localhost:5001` | Auth, data, business logic, third-party providers, background jobs |
| AI service | Python, FastAPI, Google ADK, LiteLLM | `http://localhost:8000` | Trip planning, chat, voice transcription, PDF travel briefs |
| Database | MongoDB Atlas | — | Persistent application data (all three services share one database, accessed only through the backend) |

The Express backend owns every database connection and every third-party provider credential. The AI service never touches MongoDB directly — every one of its tools calls the backend's own REST API, authenticating as a trusted internal service via a shared token (`X-Internal-Service-Token`) rather than a browser session cookie. This means the AI agent is structurally unable to read or write anything a real signed-in user couldn't through the normal API.

```text
Frontend  →  Backend API  →  MongoDB Atlas
   │              ↑
   │              │  (internal-service token, not a cookie)
   └──────→  AI service  ──┘
              (tools call the backend's own REST endpoints)
```

## Repository structure

```text
SIH_26204/
├── backend/          Express API — controllers, models, routes, services, providers, background jobs, seeds
├── ai-service/       FastAPI planner — agents, tools, onboarding transcription/extraction, PDF builder
├── frontend/         React/Vite single-page app (one folder per feature area under src/components)
├── scripts/          Standalone analysis scripts (pressure-model backtesting, distance calibration)
├── qa/               Audit reports and integration checklists
├── render.yaml        Render deployment blueprint (backend + AI service)
├── ARCHITECTURE.md    Detailed system architecture
├── DOCUMENTATION.md   Complete feature and API documentation
├── API_CONTRACTS.md   Every HTTP endpoint that crosses a service boundary
├── IMPLEMENTED_FEATURES.md  Feature-by-feature implementation notes
├── PROJECT_OVERVIEW.md      Exhaustive build/configuration record
└── DEPLOYMENT.md      Deployment instructions and pre-flight checklist
```

## Prerequisites

- Node.js 20 or later
- npm
- Python 3.12 (recommended — matches the deployed runtime)
- A MongoDB Atlas database (or another MongoDB instance)
- API credentials for whichever provider-backed features you want to run locally (see the `.env.example` files — most features degrade gracefully or log-to-console without a key, rather than crashing)

## Local setup

Clone the repository, then set up each service independently — they can be developed and run one at a time; the frontend and AI service both fall back to sensible localhost defaults if the others aren't running.

### 1. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Set at least `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL` in `backend/.env`. Add provider credentials (Google Maps, RailRadar, Amadeus, Cloudinary, Brevo, WhatsApp, Groq/Mistral) only for the features you're actually testing.

Seed the development database and start the API:

```powershell
npm run seed
npm run dev
```

Health check: `http://localhost:5001/health`.

### 2. AI service

```powershell
cd ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Configure `BACKEND_URL`, `INTERNAL_SERVICE_TOKEN` (must match the backend's own value exactly), `CLIENT_URL`, and at least one model provider (`MODEL` + Vertex AI credentials, or a Groq/Mistral key) in `ai-service/.env`. Then start FastAPI:

```powershell
uvicorn app.main:app --reload --port 8000
```

Health check: `http://localhost:8000/health`.

### 3. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

```env
VITE_API_URL=http://localhost:5001/api
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=your-referrer-restricted-browser-key
```

Open `http://localhost:5173`.

## Environment files

Environment variables are intentionally separated by service — never shared, never committed:

- `backend/.env` — database, JWT, internal-service token, AI-service URLs, third-party provider keys, mail, media, WhatsApp
- `ai-service/.env` — model provider credentials, backend URL, the same internal-service token, CORS origin
- `frontend/.env` — public API URLs and the referrer-restricted Google Maps browser key

Use the supplied `.env.example` in each service as the template — every variable that's actually read by the code is documented there, including which two values (`INTERNAL_SERVICE_TOKEN`) must be identical across services for AI-service-to-backend calls to authenticate at all.

## Useful commands

### Backend

```powershell
npm run dev            # development server with nodemon
npm start              # production-style server
npm run seed           # seed development data
npm test               # Jest test suite (MongoDB-memory-server backed)
npm run prepare-hooks  # point git hooks at the shared .githooks directory
```

### Frontend

```powershell
npm run dev       # Vite dev server
npm run build     # production build (also generates the PWA service worker)
npm run preview   # preview a production build locally
npm run lint      # ESLint
```

### AI service

```powershell
pytest                  # test_agent.py and the onboarding extraction/transcription tests
uvicorn app.main:app --reload --port 8000
```

## Deployment

`render.yaml` defines both the backend and the AI service as Render web services. The frontend deploys as a static Vite build (see `frontend/vercel.json`) on Vercel or any static host.

Before deploying, confirm:

1. `NODE_ENV=production` is set on the backend (this also controls the auth cookie's `sameSite`/`secure` attributes — cross-site login silently breaks if this is wrong).
2. `CLIENT_URL` on **both** the backend and the AI service contains the deployed frontend's real origin.
3. `INTERNAL_SERVICE_TOKEN` is set to the same value on **both** the backend and the AI service — without it, every AI-to-backend call (trip drafts, Group Travel tools, preference reads) silently falls back to cookie auth and fails.
4. `AI_SERVICE_URL`, `EXTRACT_SERVICE_URL`, and `TRANSCRIBE_SERVICE_URL` on the backend point at the AI service's real deployed URL, not `localhost`.
5. All third-party provider credentials are set in the hosting platform's dashboard, never committed to the repository.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full checklist.

## Documentation

- [Complete documentation](DOCUMENTATION.md)
- [System architecture](ARCHITECTURE.md)
- [API contracts](API_CONTRACTS.md)
- [Implemented features](IMPLEMENTED_FEATURES.md)
- [Project overview](PROJECT_OVERVIEW.md)
- [Deployment guide](DEPLOYMENT.md)

## License

This project is developed for Smart India Hackathon problem statement **SIH 26204**.
