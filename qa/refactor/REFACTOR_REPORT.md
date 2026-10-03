# Refactor Report

Branch: `sathvik/repo-refactor` (from `sathvik/error-handling-and-ai-client`). Nothing committed or pushed.
Net diff vs HEAD: 63 tracked files changed, +197 / -1125 lines, plus 4 new files (57 lines). About 215 of the removed lines are `package-lock.json`.

## Files Reviewed

640 tracked files in total. Review depth was not uniform, and this report does not claim a line-by-line read of all 640:

- **Read in full, grep-verified:** every backend controller, route, middleware and job; all backend lib/providers/models; all services (including pressure, substitution, onboarding); every frontend component, store and lib; every ai-service module and tool.
- **Targeted only:** seed JSON, destination data, Postman/http collections, test files other than the ones listed under Files Modified, and docs.
- Findings were cross-checked repo-wide by grep (backend, frontend, ai-service, scripts, `package.json` scripts, `render.yaml`, docs) before any deletion.

## Files Modified

**Backend (20):** `routes/alternatives.route.js`, `lib/ttlCache.js`, `providers/geocode.provider.js`, `providers/googlemaps.provider.js`, `controllers/auth.controller.js`, `package.json`, `package-lock.json`, `.env.example`, `services/pressure/{engine.js,collectors.js,engine.selfcheck.mjs}`, `services/substitution/{standardize,filters,ranking,dateSubstitution,alternatives.service,distance}.js`, `services/onboarding/{stateMachine,processInboundAudio,draftConfirm,dateParser}.js`, `services/pov/povService.js`, `services/onboarding/{draftConfirm,awaitingDates}.test.js`, `seeds/{export_all_seeds_from_mongo,export_destinations_from_mongo,migrate_fares_from_mongo}.js`.

**Frontend (22):** `index.css`, `lib/{api,time}.js`, `components/pressure/GoogleIndiaMap.jsx`, `components/map/{markerIcons.js,CategoryMarkersLayer,DestinationMarkersLayer,PlacesLayer,TripSummaryPremium,TripExperiencePanel}.jsx`, `components/swap/{DateSwapVariant,TripConfirmation}.jsx`, `components/planner/TripPlanner.jsx`, `components/ai/MultimodalTravelAgent.jsx`, `components/{authority/AuthorityDashboard,groups/TravelTogether,operator/HirePeople,operator/RevenueDashboard,trust/AvailableServices,worker/WorkerConsole}.jsx`, `package.json`, `package-lock.json`.

**AI-service (7):** `app/main.py`, `app/pdf_builder.py`, `app/services/{trip_drafts,backend_client,demand_predictor}.py`, `app/onboarding/test_transcribe_sarvam.py`, `requirements.txt`.

**Docs (1):** `ARCHITECTURE.md` (removed references to deleted `stats`/`amadeus` modules and the removed `socket.io` dependency).

## Files Merged

| OLD | NEW | CALLERS UPDATED |
|---|---|---|
| `frontend/src/lib/googleMaps.js` + `lib/googleMapsLoader.js` | `lib/googleMapsLoader.js` (superset) | `components/pressure/GoogleIndiaMap.jsx` |
| 3 local `clearMarkers` | `clearMarkers` in `components/map/markerIcons.js` | Category/Destination/Places marker layers |
| 2 local `formatDate` | `formatDate(str, fallback)` in `lib/time.js` | `DateSwapVariant`, `TripConfirmation` |
| `itineraryStopName` (TripPlanner) + `stopName` (TripSummaryPremium) | `lib/itineraryStop.js` (new) | both files |
| 7 hand-written tab bars in 6 files | `components/ui/TabBar.jsx` (new) | AuthorityDashboard, TravelTogether, HirePeople x2, RevenueDashboard, AvailableServices, WorkerConsole |
| 4 hardcoded `http://localhost:5001/api` | `API_BASE` export in `lib/api.js` | MultimodalTravelAgent, PlacesLayer, TripExperiencePanel, TripSummaryPremium |
| 8 inline pressure-score ternaries | `extractPressureScore` in `substitution/standardize.js` | filters, ranking, dateSubstitution, alternatives.service |
| 5 inline Mongoose-doc normalisations | `toPlain(x, copy)` in `substitution/standardize.js` | filters (no copy), ranking (copy) |
| 3 replay-message checks | `isReplayedMessage` in `onboarding/stateMachine.js` | processInboundAudio (x2), draftConfirm |
| 2 identical date-range validate blocks + 2 unit-count checks | `buildValidatedRange`, `isValidUnitCount` in `dateParser.js` | same file |
| 4 identical 8-field user responses | `toAuthResponse` in `auth.controller.js` | login, updateProfile, uploadProfilePhoto, removeProfilePhoto |
| 2 duplicated Google API-key dedups | `uniqueKeys` in `backend/src/lib/apiKeys.js` (new) | geocode.provider, googlemaps.provider |
| 3x `askConfirmation` + 2 doc cleaners | `backend/src/seeds/_lib/cliPrompt.js` (new) | 3 seed scripts |
| `get`/`post`/`patch` in `backend_client.py` | internal `_request` | public signatures unchanged, no caller edits |
| 2 copy-pasted file loaders in `demand_predictor.py` | one loop over (path, key) | same module |

## Files Deleted

| FILE | REASON | REFERENCES CHECKED | WHY SAFE |
|---|---|---|---|
| `backend/src/providers/amadeus.provider.js` | Stub with no importers; superseded by `realProviders.js` + `stayEstimate.provider.js` | Repo-wide grep for `amadeus.provider`, `searchFlights`, `searchHotels`; `render.yaml`, docs, ai-service | Nothing imports it; all 180 backend modules still load |
| `backend/src/services/pressure/stats.js` | Only consumer was dead `emergingHotspot` + selfcheck cases | grep `stats.js`, `linearRegression`, `spearman` across repo | No code references remain; selfcheck passes |
| `frontend/src/lib/googleMaps.js` | Duplicate of `googleMapsLoader.js` (only differed in `libraries=`) | grep across `src/`, `vite.config.js`, `index.html`; sole importer repointed | Build passes; same env keys, script id, cached-promise guard |
| `backend/src/providers/know.txt`, `utils/know.txt`, `services/know.txt` | Stray planning notes | grep `know.txt` repo-wide | Not loaded by anything |

## Dead Code Removed

- `pressure/engine.js`: `mlDemandPressure`, `roadDemand`, `emergingHotspot` (and the `stats.js` import). The road component in `collectors.js` is now `degradedRoad ? roadFrequencyProxy(dest) : null`; verified identical because the only provider (`realProviders.js`) always returns `seatDataAvailable:false` and no code produces `freeSeats`, so the old `roadDemand` branch could only ever return `null`.
- `routes/alternatives.route.js`: `pressureFn`, `UNKNOWN_PRESSURE`; `GOOGE_GEOCODE_API_KEY` alias hack (name appeared nowhere else).
- `lib/ttlCache.js`: `stats()`.
- `onboarding`: unused import `getAvailabilityConfirmedMessage`; unused param `existingBusiness` of `parseDraftCorrection`; unused test imports.
- `pov/povService.js`: two unused imports.
- Debug logs: Mu/Sigma and "Using Mahalanobis" in substitution.
- Frontend: `shiftedEndDate`, unused `nearbySuggestionCount` selector, `.glass-surface-dark` CSS rule.
- ai-service: `_draw_brief_pdf` (legacy PDF renderer), `save_draft`, unused imports in `pdf_builder.py`, `main.py`, `test_transcribe_sarvam.py`, duplicate `print` in `demand_predictor.py`.

## Duplicate Code Consolidated

See "Files Merged" (14 consolidations).

## Dependencies Removed

- backend: `socket.io` (0 imports; lockfile regenerated via npm)
- frontend: `@types/react`, `@types/react-dom` (JS project, no TS/jsconfig)
- ai-service: `faster-whisper` (no `faster_whisper` import anywhere; transcription uses Sarvam)
- backend `.env.example`: `AMADEUS_API_KEY`, `AMADEUS_API_SECRET` (only the deleted provider read them)

## Frontend Refactor

Build passes; lint 40 -> 38 problems (35 -> 33 errors). Of the 38 remaining, 34 are in untracked generated `dev-dist/` files that eslint picks up; the other 4 are pre-existing hook-rule items (`PlacesLayer` deps, `RecommendationOverlay` set-state-in-effect). No new `eslint-disable` added.

## Backend Refactor

See Files Modified/Merged/Deleted. Route paths, methods, response shapes, auth/RBAC, cookies, service-token contract, schemas and indexes were not touched.

## AI-Service Refactor

`backend_client` HTTP verbs share one `_request` with identical timeout (5s), headers, params/json handling and error envelope. `alternate_tools.py` was intentionally kept: its function names and docstrings are the tool schema the LLM sees, and it is wired into `multimodal_agent.py`. Other tools (weather, places, routes, road, trains) are thin one-call wrappers with LLM-visible names, so none were merged.

## API/Integration Verification

- All ~130 frontend `api.*` calls matched a backend route by method and path in the pre-refactor audit; no route, method, payload or response shape was changed by this refactor.
- Pressure engine: `engine.selfcheck.mjs` passes before and after. `dateParser` old-vs-new differential test: 202,608 input cases, 0 differences.
- All 180 backend source modules load via dynamic import with 0 failures (server not started).
- Repo-wide grep for every removed symbol/file (`amadeus.provider`, `lib/googleMaps`, `stats.js`, `mlDemandPressure`, `roadDemand`, `emergingHotspot`, `spearman`, `_draw_brief_pdf`, `save_draft`, `socket.io`, `GOOGE_GEOCODE`, `shiftedEndDate`, `glass-surface-dark`) returns no remaining code references.
- **Not verified end to end:** Frontend -> Backend -> AI against running services. The backend `.env` points at a remote Atlas cluster and startup runs alert polling that writes, so the server was deliberately not started. The `TabBar` and other UI changes were verified by build, lint, and code reading of the old vs new class strings, not in a browser (all affected pages are behind login).

## Tests/Builds Run

| Check | Result |
|---|---|
| Backend `npm test` | Same as baseline: 14 suites fail / 17 pass, 150 failed / 210 passed tests. The 14 failures are pre-existing (`mongodb-memory-server` cannot start). Suite list unchanged. |
| `engine.selfcheck.mjs` | OK before and after |
| Frontend `npm run build` | Pass |
| Frontend `npm run lint` | 38 problems (baseline 40) |
| ai-service `pytest` | 15 passed (baseline 15) |
| ai-service imports (`app.main`, `backend_client`, `trip_drafts`, `pdf_builder`) | OK |

## Remaining Technical Debt

- 14 backend test suites cannot run in this environment, including the onboarding suites covering the refactored `processInboundAudio` / `draftConfirm` / `isReplayedMessage`; those changes are covered only by the `dateParser` differential test and code review.
- `faster-whisper` is still described in `ARCHITECTURE.md` (lines 60, 87, 372, 553, 690) and a backend comment, but the code uses Sarvam. Pre-existing doc mismatch.
- `ARCHITECTURE.md` lines 125/326-327 and `render.yaml` lines 56-58 still mention Amadeus env vars/behavior for the deleted provider. `render.yaml` was left alone (deployment config).
- Frontend: add `dev-dist/` to eslint ignores (would drop ~34 lint problems); split `EverythingMap.jsx` (938 lines), `useTrustStore.js` (531), `Header.jsx` (541). Not done: no UI tests to guard them.
- `apiModeMap` in `EverythingMap.jsx` kept: `travelMode` can be a non-listed string (e.g. `'BICYCLE'`) that it maps to `'DRIVE'`.
- Naming drift (`budgetController.js`, `budget.routes.js`, `models/Budget.js`, `lib/authTokens.js` vs `jwt.js`) left unchanged; many import sites plus tests/docs for no behavior gain.
- `AI_BASE` consolidation was already done (`aiApi` in `lib/api.js`), nothing further needed.
- Not touched (behavior changes, need a separate decision): no central error middleware / logger; unauthenticated + unrate-limited paid-API proxy routes; WhatsApp webhook `POST` without signature check; public `GET /v1/visits/operator-code/:businessId`; no schema validation outside budget; N+1 `findOne` in `revenueEngine.js:~198`; no 401 handling on the client; `dotenv.config()` order in `index.js`.
- Dead-route candidates (not deleted, may be used by ai-service/cron/future UI): `GET /v1/trips/summary`, `GET /v1/group-trips` (list), education `packing`/`safety`/`PUT`, `GET /travel-types/:type`, `POST /v1/alerts`, dashboard `pressure|capacity|redistribution|acceptance|labor`.

## Potentially Risky Areas

- `pressure/collectors.js` road branch (see Dead Code Removed): equivalent today; if a seat-data provider is ever added, `roadDemand` must be re-introduced.
- `googleMapsLoader.js` now also loads the `geometry` library for the pressure map (additive, harmless). The comment explaining why `loading=async` is not used lived in the deleted `googleMaps.js` and was not carried over.
- `backend_client.py` now uses `requests.request(method, ...)` instead of `requests.get/post/patch`; any external test that mocks `requests.get` directly would need updating (none exist; pytest passes).
- `TabBar` replaced 7 hand-written bars; class strings were compared by reading but not visually.
