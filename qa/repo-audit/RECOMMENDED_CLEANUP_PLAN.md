# Recommended Cleanup Plan

**No files were deleted, modified, or moved to produce this report — this is a proposal only.**

## PHASE 1 — Definitely Safe

| File | Action | Reason | Risk | Confidence |
|---|---|---|---|---|
| `frontend/src/components/map/MapControls.jsx` | Delete | Superseded by `MapControlsPremium.jsx`, which is what's actually imported | None — zero references found | 99% |
| `frontend/src/components/map/TripSummaryPanel.jsx` | Delete | Superseded by `TripSummaryPremium.jsx` | None | 99% |
| `frontend/src/components/map/AIAssistantCard.jsx` | Delete | Superseded by `AIAssistantPremium.jsx` | None | 99% |
| `frontend/src/components/profile/QuickLinksCard.jsx` | Delete | Removal already documented in `Profile.jsx`'s own comment | None | 99% |
| `frontend/src/components/map/TripPlannerSidebar.jsx` | Delete | Zero importers anywhere | Very low (see confidence note) | 98% |

## PHASE 2 — Safe After Quick Review

| File | Action | Reason | Risk | Confidence |
|---|---|---|---|---|
| `backend/src/services/tempBudgetFn.js` | Delete, or wire in as the real implementation | Self-described temporary stub, zero importers | Low | 97% |
| `ai-service/app/agents/travel_agent.py` | Delete | Explicitly disclaimed in `main.py`'s own comment; only `multimodal_agent` is ever run | Low | 98% |
| `ai-service/app/tools/trains.py`, `trip_cost.py`, `user_preferences.py` | Delete together with `travel_agent.py` | Imported only by the dead agent | Low-medium — confirm no in-flight branch reintroduces a caller first | 90% |

## PHASE 3 — Manual Review Required

| Item | Action | Reason |
|---|---|---|
| `backend/src/providers/amadeus.provider.js` + `render.yaml`'s `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` | Decide: finish wiring it into `realProviders.js`, or delete the file and the deployment config together | Currently half-built — credentials provisioned, code path unreachable |
| `backend/src/jobs/precomputePressure.job.js` | Decide: wire into `jobs/scheduler.js` the same way `pollAlerts.job.js` was fixed, or confirm an external scheduler already invokes it | Live evidence (stale pressure-map data observed in an earlier session) suggests this job may not be running automatically in practice |
| `scripts/backtest.js`, `scripts/calibrateDistance.js`, `ai-service/test.py`, `ai-service/test_agent.py` | Confirm still-used-manually, or delete | Zero code references; plausibly legitimate manual tooling |
| `backend/budget.http`, `backend/budget.postman_collection.json` | Confirm still wanted, or delete/update to reflect current API surface | Describe only the earliest, narrowest API surface of the app |
| `backend/trust-vertical.postman_collection.json` | Open and verify against current trust-vertical routes | Not checked this pass |
| Root documentation set (`ARCHITECTURE.md`, `DOCUMENTATION.md`, `IMPLEMENTED_FEATURES.md`, `API_CONTRACTS.md`) | Read and cross-check against current implementation; update or consolidate | Not fully cross-read this pass; two sibling docs that *were* read (`README.md`, `PROJECT_OVERVIEW.md`) are both confirmed stale, so drift risk is real |
| `PROJECT_OVERVIEW.md` | Rewrite or clearly mark as historical | Confirmed to describe only the very first "budget microservice" phase of the project — none of the pressure engine, trips, substitution, community, offers, Proof-of-Visit, authority dashboard, or AI service is mentioned |
| `README.md` | Update the folder-structure diagram to match reality | Confirmed aspirational/planning document, not literal current structure |
| `.gitignore`'s `COMMIT_CONVENTION.md` and `docs/` entries | Remove the dead rules, or actually untrack `COMMIT_CONVENTION.md` if it was meant to be ignored | Currently inert either way |
| `qa/responses/` (5 empty dirs) | Confirm origin with the team, then remove if abandoned scaffold | Predates this session, unexplained |

## PHASE 4 — Do NOT Delete

Everything not listed above, and specifically (per the brief's own explicit protection list, all verified present and in active use this pass):

- `package-lock.json` (both projects)
- `render.yaml`, `frontend/vercel.json` (deployment config)
- `.env.example` files (both projects, plus ai-service's)
- All 21 backend Mongoose models
- All active provider adapters (`googlemaps`, `railradar`, `openmeteo`, `geocode`, `roadtransport`, `fareEstimator`, `stayEstimate`)
- All AI tools actually imported by `multimodal_agent.py` or `main.py` directly (`alerts`, `alternatives`/`alternate_tools`, `businesses`, `places`, `pressure`, `road`, `routes`, `weather`, `fare`, `itinerary`)
- All 28 backend route files and their 17 controllers — zero dead ones found
- `.githooks/commit-msg` and `scripts/setup-hooks.{bat,sh}`
- All backend/frontend test files (`*.test.js`)
- `backend/src/seeds/` (canonical destination data)
- `dns-fix.cjs`
- `jobs/scheduler.js`, `jobs/pollAlerts.job.js`, `jobs/expireOffers.job.js` — all three confirmed live-wired
