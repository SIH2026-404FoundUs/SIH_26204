# Deployment — Vercel (frontend) + Render (backend + ai-service)

Three services, three URLs that reference each other. Deploy in this order
so you're not chasing a chicken-and-egg problem — backend and ai-service
first (their URLs don't depend on the frontend), frontend last, then one
final round-trip to tell the backends about the frontend's real URL.

## 1. Backend + ai-service on Render

Render can read `render.yaml` at the repo root as a Blueprint (New → Blueprint,
point it at this repo). It defines both services (`sahyatri-backend`,
`sahyatri-ai-service`) with their build/start commands and health checks
already set — you only need to fill in the secrets it leaves blank
(`sync: false` in `render.yaml`):

**sahyatri-backend**: `MONGODB_URI`, `JWT_SECRET`, `GOOGLE_MAPS_API_KEY`,
`RAILRADAR_API_KEY`, `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`,
`CLOUDINARY_*` (see `backend/.env.example` for the full list). Leave
`CLIENT_URL` as a placeholder for now — you don't have the Vercel URL yet.

**sahyatri-ai-service**: `GOOGLE_API_KEY`, `BACKEND_URL` (the
`sahyatri-backend` URL Render just gave you, e.g.
`https://sahyatri-backend.onrender.com`). Leave `CLIENT_URL` as a
placeholder too.

Without a Blueprint, create two Web Services manually with the same
`rootDir`/build/start commands `render.yaml` specifies.

## 2. Frontend on Vercel

New Project → import this repo → set **Root Directory to `frontend`**
(this is a dashboard setting; a monorepo's `vercel.json` only controls the
build once Vercel is already looking inside that folder). It auto-detects
Vite; `frontend/vercel.json` adds the SPA rewrite so refreshing `/explore`
or any other client-side route doesn't 404.

Environment variables (Vercel dashboard → Settings → Environment Variables):
- `VITE_API_URL` = `https://sahyatri-backend.onrender.com/api`
- `VITE_AI_SERVICE_URL` = `https://sahyatri-ai-service.onrender.com`
- `VITE_GOOGLE_MAPS_API_KEY` — see the security note below before deploying

Deploy. Copy the resulting Vercel URL (e.g. `https://sahyatri.vercel.app`).

## 3. Close the loop: tell the backends about the frontend

Go back to both Render services and set `CLIENT_URL` to the real Vercel URL
(comma-separated if you also want a preview deploy or `localhost:5173` to
work — see the comments in `backend/.env.example`). Render redeploys
automatically on an env var change.

## Things that will silently break if skipped

- **Cross-site cookies**: the auth cookie is `sameSite:"none"` /
  `secure:true` whenever `NODE_ENV !== "development"` (see
  `backend/src/lib/jwt.js`) — required because Vercel and Render are
  different sites, and Render sets `NODE_ENV=production` by default. If
  login appears to "not stick" after deploy, confirm `NODE_ENV` on the
  backend service isn't accidentally still `development`.
- **CORS**: both the Express backend and the FastAPI ai-service read
  `CLIENT_URL` at process start, not per-request — an env var change needs
  the actual redeploy Render triggers automatically, not just a save.
- **Google Maps API key**: `VITE_GOOGLE_MAPS_API_KEY` ships in the frontend
  bundle by design (Maps JavaScript API is meant to run client-side) and is
  visible in page source to anyone. Before this goes properly public,
  restrict that key in the Google Cloud Console to HTTP referrers for your
  actual Vercel domain, separately from whatever restrictions the backend's
  own server-side use of a Maps key relies on.
- **Gemini free-tier quota**: `GOOGLE_API_KEY` on `sahyatri-ai-service` is
  capped at 20 `generateContent` calls/day on the free tier — the same
  limit hit repeatedly during local development. Enable billing on that
  Google Cloud project before a demo where this matters, or the pressure
  gate's itinerary-generation step will 500 once the quota's gone (the
  pressure calculation itself is unaffected — it's deterministic Python,
  not an LLM call).
- **MongoDB Atlas network access**: Atlas defaults to an IP allowlist. Add
  `0.0.0.0/0` (or Render's specific outbound IPs, listed in the Render
  dashboard) under Atlas → Network Access, or every DB call from Render
  will time out.
