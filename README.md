# Sahyatri

Sahyatri is a tourism redistribution platform for **SIH 26204**. It helps travellers discover less-crowded destinations and alternative travel dates while giving tourism businesses, operators, and authorities tools to manage demand.

The platform measures destination pressure using travel access, accommodation availability, calendar events, weather, and capacity signals. When a destination is crowded, the planner can recommend a quieter alternative or a different date.

## Highlights

- Role-based experiences for travellers, operators, and authorities
- AI-assisted trip planning, chat, voice transcription, and travel briefs
- Destination pressure scores and alternative destination/date suggestions
- Business listings, availability, waitlists, offers, and proof-of-visit workflows
- Community submissions, alerts, safety features, and authority dashboards
- WhatsApp voice onboarding for tourism operators

## Architecture

Sahyatri is split into three services backed by MongoDB Atlas:

| Service | Technology | Local URL | Responsibility |
| --- | --- | --- | --- |
| Frontend | React, Vite, Tailwind, Zustand | `http://localhost:5173` | Browser application and role-based UI |
| Backend | Node.js, Express, Mongoose | `http://localhost:5001` | Authentication, data, business logic, providers, and jobs |
| AI service | Python, FastAPI, Google ADK, LiteLLM | `http://localhost:8000` | Trip planning, AI chat, transcription, and PDF travel briefs |
| Database | MongoDB Atlas | — | Persistent application data |

The Express backend owns provider credentials and database access. The AI service communicates with the backend through authenticated internal requests.

## Repository structure

```text
Sahyatri/
├── backend/          Express API, models, routes, services, providers, and seeds
├── ai-service/       FastAPI planner, agents, tools, transcription, and PDF builder
├── frontend/         React/Vite single-page application
├── scripts/           Project utility scripts
├── render.yaml       Render deployment blueprint
├── ARCHITECTURE.md   Detailed system architecture
├── DOCUMENTATION.md  Complete feature and API documentation
├── API_CONTRACTS.md  API request and response contracts
└── DEPLOYMENT.md     Deployment instructions and configuration
```

## Prerequisites

- Node.js 20 or later
- npm
- Python 3.12 recommended
- A MongoDB Atlas database, or another MongoDB instance
- API credentials for the providers used by the features you want to run

## Local setup

Clone the repository, then install each service independently.

### 1. Backend

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Set at least `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL` in `backend/.env`. Add provider credentials when using maps, transport, accommodation, email, Cloudinary, or WhatsApp features.

Seed the development database and start the API:

```powershell
npm run seed
npm run dev
```

The backend health endpoint is available at `http://localhost:5001/health`.

### 2. AI service

```powershell
cd ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Configure `BACKEND_URL`, `INTERNAL_SERVICE_TOKEN`, `CLIENT_URL`, and at least one supported model provider in `ai-service/.env`. Then start FastAPI:

```powershell
uvicorn app.main:app --reload --port 8000
```

The AI service health endpoint is available at `http://localhost:8000/health`.

### 3. Frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Configure the frontend environment values:

```env
VITE_API_URL=http://localhost:5001/api
VITE_AI_SERVICE_URL=http://localhost:8000
VITE_GOOGLE_MAPS_API_KEY=your-restricted-browser-key
```

Open `http://localhost:5173` in a browser.

## Environment files

Environment variables are intentionally separated by service:

- `backend/.env` — database, JWT, provider, mail, media, and WhatsApp credentials
- `ai-service/.env` — model provider, backend URL, service token, and CORS settings
- `frontend/.env` — public API URLs and the referrer-restricted Maps browser key

Never commit real `.env` files or service-account credentials. Use the supplied `.env.example` files as templates.

## Useful commands

### Backend

```powershell
npm run dev          # development server with nodemon
npm start            # production-style server
npm run seed         # seed development data
npm test             # Jest test suite
npm run prepare-hooks
```

### Frontend

```powershell
npm run dev
npm run build
npm run preview
npm run lint
```

## Deployment

`render.yaml` defines the backend and AI service deployments for Render. The frontend can be deployed as a static Vite application on Vercel or another static hosting provider.

Before deploying, make sure that:

1. `NODE_ENV=production` is set for the backend.
2. `CLIENT_URL` contains the deployed frontend origin in both backend services.
3. `INTERNAL_SERVICE_TOKEN` matches between the backend and AI service.
4. All provider credentials are configured in the deployment platform, not in the repository.

See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete deployment checklist.

## Documentation

- [Complete documentation](DOCUMENTATION.md)
- [System architecture](ARCHITECTURE.md)
- [API contracts](API_CONTRACTS.md)
- [Implemented features](IMPLEMENTED_FEATURES.md)
- [Project overview](PROJECT_OVERVIEW.md)

## License

This project is developed for Smart India Hackathon problem statement **SIH 26204**.
