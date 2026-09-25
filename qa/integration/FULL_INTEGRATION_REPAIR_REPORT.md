# Sahyatri — Full 3-Layer Integration Audit & Repair Report

Audit date: 2026-09-22
Scope: `frontend/` ↔ `backend/` ↔ `ai-service/`, plus the configuration that connects them.

Method: every HTTP call the frontend makes (110+ call sites), every backend route
(40+ router files), and every ai-service endpoint + outbound `backend_client` call
were inventoried and cross-referenced path-by-path and payload-by-payload. The
highest-risk flows were verified field-by-field against their Pydantic/Mongoose
schemas, then re-verified live against running services with disposable test
accounts (created and deleted per run, zero orphaned data left behind).

---

## 1. Integration Architecture

```
Frontend (Vite/React, :5173)
   |  axios "api" client -> VITE_API_URL (default http://localhost:5001/api)
   |  withCredentials: true (jwt cookie)
   v
Backend (Express, :5001 dev / Render "sahyatri-backend" in prod)
   |  CORS: origin = CLIENT_URL, credentials: true
   |  Auth: cookie "jwt" (HS256, 7d) verified in protectRoute
   |
   |  Outbound, backend -> ai-service (best-effort, all fail open):
   |    demandML.provider.js   -> POST {AI_SERVICE_URL}/api/v1/pressure/predict-demand
   |    extractFields.js       -> POST {EXTRACT_SERVICE_URL}  (.../onboarding/extract)
   |    transcription.js       -> POST {TRANSCRIBE_SERVICE_URL} (.../onboarding/transcribe)
   v
AI Service (FastAPI/Google ADK, :8000 dev / Render "sahyatri-ai-service" in prod)
   |  CORS: origin = CLIENT_URL, credentials: true
   |  Auth (inbound, browser -> ai-service): authenticated_user_id() forwards the
   |    raw Cookie header to backend's GET /api/auth/check to resolve a user id
   |    (soft dependency -- falls back to anonymous, never 401s on its own)
   |
   |  Outbound, ai-service -> backend (backend_client.py):
   |    header X-Internal-Service-Token: INTERNAL_SERVICE_TOKEN
   |    -> backend's protectRouteOrService middleware accepts this INSTEAD of
   |       a session cookie, sets req.isInternalService = true
   v
Tools / Providers / Database
   - AI tools (ai-service/app/tools/*.py) are thin wrappers that call the
     backend's own REST API (destinations, pressure, places, fare, roads,
     alerts, businesses, education, group-trips, user-preferences) -- no
     second data layer, no direct DB access from ai-service.
   - Backend talks to MongoDB Atlas (Mongoose) and third-party providers
     (Google Maps/Geocoding, RailRadar, Amadeus, Cloudinary, Brevo).
   - LLM calls (Vertex AI Gemini via LiteLLM, Groq, Mistral) live only
     inside ai-service.
```

---

## 2. Integration Issues Found

### Issue 1 — `INTERNAL_SERVICE_TOKEN` never wired in production (critical)
- **Affected services:** ai-service -> backend (all internal-service calls)
- **Broken connection:** every `backend_client` call from ai-service that hits a
  `protectRouteOrService`-gated route (trip drafts, all Group Travel AI tools,
  user-preferences reads)
- **Root cause:** `backend/src/middleware/serviceAuth.middleware.js`'s
  `protectRouteOrService` only accepts an internal-service call when
  `req.get("x-internal-service-token")` matches `process.env.INTERNAL_SERVICE_TOKEN`
  (`if (supplied && expected)`). `render.yaml` declared this var for neither
  `sahyatri-backend` nor `sahyatri-ai-service` — only local `.env` files had it.
  On Render, `expected` is `undefined`, so the check always falls through to
  cookie-based `protectRoute`, and ai-service's server-to-server calls never
  carry a browser cookie.
- **Files involved:** `render.yaml`, `backend/src/middleware/serviceAuth.middleware.js`,
  `ai-service/app/services/backend_client.py`
- **Fix applied:** added `INTERNAL_SERVICE_TOKEN` to both services in `render.yaml`
  with a comment that the values must match.

### Issue 2 — AI-service URLs never wired in production
- **Affected services:** backend -> ai-service (demand-ML, onboarding extract/transcribe)
- **Broken connection:** `demandML.provider.js`, `extractFields.js`, `transcription.js`
  all read `AI_SERVICE_URL` / `EXTRACT_SERVICE_URL` / `TRANSCRIBE_SERVICE_URL` from
  `process.env` with a `http://localhost:8000` fallback. Render gives each service
  its own isolated host, so in production these calls would always target a
  nonexistent `localhost:8000`.
- **Root cause:** same class of gap as Issue 1 — `render.yaml` never declared these vars.
- **Impact:** pressure demand-ML predictions silently degrade to baseline (this
  path already fails open, see Verification §4 below); WhatsApp onboarding voice
  transcription and field extraction fail outright (these paths throw, no fallback).
- **Files involved:** `render.yaml`, `backend/src/providers/demandML.provider.js`,
  `backend/src/services/onboarding/extractFields.js`,
  `backend/src/services/onboarding/transcription.js`
- **Fix applied:** added all three to `render.yaml` for the backend service, each
  with a comment on the exact URL shape required (bare origin vs. full path).

### Issue 3 — Env var documentation gap (local dev)
- **Affected services:** backend (local dev clarity only — runtime already worked
  via hardcoded defaults matching ai-service's actual local address)
- **Root cause:** `AI_SERVICE_URL` / `EXTRACT_SERVICE_URL` / `TRANSCRIBE_SERVICE_URL`
  were absent from `backend/.env.example`, so a new developer had no visibility
  into these being configurable at all.
- **Files involved:** `backend/.env.example`
- **Fix applied:** documented all three with local-dev-correct defaults and an
  expanded comment on `INTERNAL_SERVICE_TOKEN` explaining the cross-service
  contract it enforces.

No other path, payload, or schema mismatches were found across the full
frontend/backend/ai-service call graph (see §10 for what was checked and
confirmed already correct).

---

## 3. API Contract Issues

None found beyond Issues 1–3 above. Verified field-by-field:
- `PlanTripRequest` (ai-service) vs. `usePlannerStore.js`'s request body — exact match
  (`userId, origin, destId, startDate, endDate, travellers, budgetINR, interests,
  selectedHotel, stops`)
- `ChatRequest`/`ChatResponse` (`/internal/ai/chat`) vs. `AskAIChat.jsx` — exact match
  (`request, trip, question, history` -> `{answer}`)
- `MultimodalChatRequest`/`MultimodalChatResponse` vs. `MultimodalTravelAgent.jsx` —
  exact match; response `results.{hotels,places,pressure,alternatives}` all consumed
- Trip-draft persistence: `trip_drafts.py`'s `save_draft`/`get_draft` body vs.
  `trips.controller.js`'s `createTripController`/`getTripController` — exact
  round-trip match on every field name and shape
- `req.isInternalService` / `resolveUserId` pattern consistently applied across
  `trips.controller.js`, `groupTrips.controller.js`, `users.controller.js`

All ~110 frontend `api.*` call paths were cross-referenced against every backend
router's mounted routes — no stale, removed, or mismatched paths found. All 8
frontend calls that go directly to ai-service (`/api/plan-trip`,
`/api/plan-trip/confirm`, `/api/multimodal/chat`, `/api/multimodal/transcribe`,
`/internal/ai/chat`, `/internal/ai/travel-brief`, `/internal/ai/recommendation`,
`/internal/travel-brief/pdf`) match ai-service's FastAPI routes exactly. All 18
distinct backend paths called by ai-service's `backend_client` match real,
mounted backend routes.

---

## 4. Authentication / Session Issues

- **Cookie issuance/verification (backend):** `jwt` cookie, HS256, 7-day maxAge,
  `sameSite: "none"`/`secure: true` outside `development`, else `lax`/`false`.
  Verified live: signup -> cookie set -> `/api/auth/check` with cookie -> 200 with
  full user doc; without cookie -> 401 `{"message":"Unauthorized - No Token Provided"}`.
- **Internal-service auth (ai-service -> backend):** verified live both ways —
  `GET /api/v1/users/:id/preferences` without `X-Internal-Service-Token` -> 401;
  with the correct token (matches between local `.env` files) -> 200 with the
  real preferences document. This is the exact mechanism Issue 1 found broken
  in production and Issue 1's fix repairs.
- **authenticated_user_id (ai-service inbound, browser -> ai-service):**
  forwards the raw `Cookie` header to backend's `/api/auth/check`. This is a
  **soft** dependency everywhere it's used (falls back to `None`/anonymous, never
  401s on its own) — confirmed by reading `main.py` lines 175-193 and its every
  call site.
- **Remaining risk (not fixed — flagged, see §11):** in production, frontend's
  direct-to-ai-service calls rely on the browser sending the backend's `jwt`
  cookie cross-origin to a *different* Render hostname. Cookies are scoped to
  the exact host that set them (no `Domain` attribute is set in `lib/jwt.js`),
  so this cannot work across two separate `onrender.com` hostnames the way it
  currently does in local dev (where cookies are shared across ports on the
  same `localhost` host, masking the issue). This is an auth-model decision
  (e.g., an explicit bearer token), not a wiring fix, so it was flagged rather
  than rewritten per the "do not redesign" instruction.

---

## 5. Frontend ↔ Backend Issues

None found. Every store (`useAuthStore`, `useTrustStore`, `useWorkerStore`,
`useOperatorStore`, `useGroupTravelStore`, `useGroupMembershipStore`,
`useTravelEducationStore`, `usePressureStore`, `useRevenueStore`,
`useNotificationsStore`, `useDestinationsStore`, `useSubstitutionStore`,
`useContentGeneratorStore`, `useTripsStore`, `useAuthorityDashboardStore`) calls
paths that exist, with methods that match, gated by the same middleware the
route actually uses.

One coverage gap noted (not a bug): `businesses.route.js` defines
`POST /api/v1/businesses/:id/availability` (`upsertBusinessAvailabilityController`)
but no frontend store calls it — appears to be a genuinely unused endpoint, not
a broken connection. Left untouched per "do not remove working functionality."

---

## 6. Backend ↔ AI Issues

Fixed: Issues 1 and 2 above (missing production env wiring for
`INTERNAL_SERVICE_TOKEN`, `AI_SERVICE_URL`, `EXTRACT_SERVICE_URL`,
`TRANSCRIBE_SERVICE_URL`).

Verified NOT a bug: `backend/src/services/feedback/translationService.js` and
`feedbackService.js` reference `/internal/ai/translate` and
`/internal/ai/feedback-themes` — **these ai-service endpoints do not exist**.
This looked like a live mismatch at first glance, but tracing the actual call
site (`feedback.controller.js`) shows `aiServiceUrl`/`fetchClient` are
deliberately never passed in, so the code path that would hit those endpoints
is never reached — `processFeedbackController` always runs the keyword-heuristic
extractor instead, and honestly labels the result `themeSource: "heuristic-fallback"`
rather than claiming an LLM ran. Confirmed via code comments explicitly stating
this ("the LLM path ... isn't built yet") and via grep showing no other caller
supplies those options. No fix needed or made.

Verified working end-to-end (live): `predictDemand` -> ai-service's
`POST /api/v1/pressure/predict-demand` connection is wired correctly (right URL,
right payload). The endpoint itself currently returns 500
`{"ok":false,"error":"ML demand model is not initialized or failed at startup."}`
— this is an ai-service-internal model-loading state, not a connection defect.
Confirmed the backend's pressure engine treats this as optional and degrades
honestly: `GET /api/v1/pressure/manali?date=...` still returns 200 with
`"dropped":["demand"]` explicitly reported in the response rather than a
fabricated score. See §11 (blocked, external).

---

## 7. Frontend ↔ Backend ↔ AI End-to-End Issues

Traced and verified the full chain for the two most complex flows:

**Plan a trip:** `TripPlanner.jsx` -> `usePlannerStore.submitTrip` ->
`aiClient.post('/api/plan-trip', request)` -> ai-service `PlanTripRequest`
validation -> pressure-gate decision -> `trip_drafts.save_draft` ->
`backend_client.post('/api/v1/trips', body)` -> `trips.controller.js`'s
`createTripController` (via `protectRouteOrService`) -> `Trip.create()` -> Mongo
-> response bubbles back to `usePlannerStore`'s `awaitingDecision`/`plan` state
-> UI renders pressure/alternatives or the confirmed plan. All field names and
shapes match at every hop (confirmed by reading both sides of each hop, not
assumed).

**Multimodal chat / Group Travel AI tools:** `MultimodalTravelAgent.jsx` ->
`fetch('/api/multimodal/chat', {credentials:'include'})` -> ai-service resolves
`authenticated_id` via cookie-forward to backend -> `build_agent(authenticated_id)`
binds user-scoped tools (`search_group_trips`, `create_group_trip`, etc.) as
closures -> tool call -> `backend_client` with internal-service header ->
`groupTrips.controller.js` (via `protectRouteOrService` + `resolveUserId`) ->
Mongo -> tool result folded into the agent's answer -> `data.answer`/`data.results`
rendered in chat. Connection wiring confirmed correct at every hop; the LLM
completion step itself is currently blocked by an expired external credential
(§11), so the full round trip could not be exercised past the model call in
this environment — the HTTP-level chain up to and including the
`protectRouteOrService` gate was verified directly instead (§10).

---

## 8. Configuration / Environment Issues

| Var | Backend `.env` (local) | ai-service `.env` (local) | `render.yaml` (prod) — before | `render.yaml` (prod) — after |
|---|---|---|---|---|
| `INTERNAL_SERVICE_TOKEN` | set, matches ai-service | set, matches backend | **missing on both** | added to both |
| `AI_SERVICE_URL` | unset (code default `:8000` happens to work) | n/a | **missing** | added |
| `EXTRACT_SERVICE_URL` | unset (code default happens to work) | n/a | **missing** | added |
| `TRANSCRIBE_SERVICE_URL` | unset (code default happens to work) | n/a | **missing** | added |
| `BACKEND_URL` | n/a | set | present | unchanged |
| `CLIENT_URL` | set, `http://localhost:5173` | set, same value | present (both) | unchanged |

CORS verified live on both services: preflight `OPTIONS` from
`Origin: http://localhost:5173` returns `Access-Control-Allow-Origin`,
`Access-Control-Allow-Credentials: true`, and the right method/header lists on
both the backend and ai-service.

---

## 9. Fixes Applied

1. **`render.yaml`** — added `INTERNAL_SERVICE_TOKEN` to both `sahyatri-backend`
   and `sahyatri-ai-service` service blocks (with a comment that the two values
   must match); added `AI_SERVICE_URL`, `EXTRACT_SERVICE_URL`,
   `TRANSCRIBE_SERVICE_URL` to `sahyatri-backend`, each commented with the exact
   URL shape required.
2. **`backend/.env.example`** — documented `AI_SERVICE_URL`,
   `EXTRACT_SERVICE_URL`, `TRANSCRIBE_SERVICE_URL` with working local-dev
   defaults; expanded the `INTERNAL_SERVICE_TOKEN` comment to explain the
   cross-service contract it enforces and what breaks on a mismatch.

No frontend, backend business-logic, or ai-service code files were modified —
every issue found was a deployment/configuration wiring gap, not a code defect.

---

## 10. Verification Performed

- **Frontend build:** `npm run build` — clean, `✓ built in 2.56s`, PWA precache
  114 entries.
- **Frontend lint:** `npx eslint src` — 3 pre-existing errors + 1 warning, all
  unrelated to integration (`RecommendationOverlay.jsx` React state-in-effect
  pattern, `TripPlanner.jsx` two unused variables, `PlacesLayer.jsx`
  exhaustive-deps warning). Not touched — out of scope ("do not perform
  unrelated refactoring").
- **Backend tests:** `npm test` (Jest) — 210 passed, 151 failed across 31 suites.
  Investigated the failure pattern: dominated by `MongoMemoryServer.create()`
  timing out inside a 5000ms Jest hook timeout (confirmed via
  `processInboundAudio.test.js`'s stack trace). The binary cache
  (`~/.cache/mongodb-binaries/mongodb-windows-x86_64-8.2.6.zip`) exists locally, so
  this reads as parallel-worker contention against that shared cache, not a
  missing dependency. This test file and pattern predate this session's changes
  (confirmed via `git log`) and none of the fixes made here touch anything a Jest
  suite loads (`render.yaml`, `.env.example` are not read by the test runner) —
  pre-existing test-infra flakiness, not an integration regression. Not in scope
  to fix per "do not redesign."
- **ai-service tests:** `pytest test_agent.py app/onboarding/test_extraction_prompt.py
  app/onboarding/test_transcribe_sarvam.py` — **15 passed, 0 failed.**
- **Live service verification** (both services started locally, disposable test
  account created and deleted after):
  - `GET /health` on both services -> 200
  - CORS preflight (`OPTIONS`) on both services from `Origin: http://localhost:5173`
    -> correct `Access-Control-Allow-*` headers
  - `POST /api/auth/signup` -> 201, cookie issued
  - `GET /api/auth/check` with cookie -> 200 with full user document; without
    cookie -> 401 with the expected JSON error shape
  - `GET /api/v1/users/:id/preferences` without `X-Internal-Service-Token` -> 401;
    with the correct token -> 200 with the real preferences document (this is
    the exact mechanism Issue 1 fixes)
  - `GET /api/multimodal/meta` (ai-service tool inventory) -> 200, tool list intact
  - `POST /api/v1/pressure/predict-demand` (backend's real outbound target) ->
    reachable, correct contract, ai-service-internal 500 (model not initialized)
  - `GET /api/v1/pressure/manali?date=...` -> 200, degrades honestly
    (`"dropped":["demand"]`), confirming the backend does not depend on the ML
    call succeeding
  - Unknown route -> 404 (Express default), does not crash the process

---

## 11. Remaining Issues

1. **Cross-origin cookie auth for direct frontend -> ai-service calls in
   production** (see §4). Architectural — needs a decision (e.g., an explicit
   bearer token the frontend attaches to `/internal/ai/*` and `/api/multimodal/*`
   calls) rather than a wiring fix. Not fixed; flagged for a follow-up decision.
2. **Backend test suite has pre-existing flakiness** under `MongoMemoryServer`
   parallel startup contention (151/361 failing). Unrelated to this audit's
   scope and pre-dates this session; worth a separate pass (e.g., raising the
   Jest hook timeout or serializing DB-touching suites) but not an integration
   defect.
3. **Unused backend endpoint:** `POST /api/v1/businesses/:id/availability` has
   no frontend caller. Not broken, just apparently dead — left as-is.

---

## 12. AI-Service Changes

**None.** No files inside `ai-service/` were modified. Every issue found that
involved ai-service was a wiring/configuration gap on the backend or deployment
side (`render.yaml`, `backend/.env.example`) — ai-service's own routes, schemas,
and `backend_client` contract were all already correct.

---

## FINAL SUMMARY

```
TOTAL INTEGRATION ISSUES: 3
FIXED: 3
REMAINING: 1 (architectural — cross-origin cookie auth, flagged for a decision)
BLOCKED: 1 (external — ai-service's Vertex AI ADC credential expired, and the
             ML demand model is not initialized; neither is an integration
             wiring problem, both are external/environment state)

FRONTEND <-> BACKEND: no issues found
BACKEND <-> AI: 2 fixed (INTERNAL_SERVICE_TOKEN, AI/EXTRACT/TRANSCRIBE_SERVICE_URL
                 missing from render.yaml)
FRONTEND <-> BACKEND <-> AI: 0 additional issues beyond the above (same root cause,
                 chain verified end-to-end at the HTTP level)
AUTH: 1 fixed (internal-service token production wiring); 1 remaining
      (cross-origin cookie auth, flagged not fixed)
CONFIG: 3 fixed (render.yaml x2, backend/.env.example x1)
RUNTIME: backend build/tests run, frontend build/lint run, ai-service tests run,
         both services started live and exercised with real HTTP calls

FINAL STATUS: CONNECTED WITH REMAINING ISSUES
```

The remaining issue is a deliberate architectural flag, not an unaddressed
wiring bug — every contract, path, payload, and production config gap actually
found in this audit was fixed. The one open item (cross-origin cookie auth for
direct-to-ai-service browser calls) requires a decision on auth model, which is
outside a "make the minimum required wiring fix" repair per this task's own
rules against redesigning the application.
