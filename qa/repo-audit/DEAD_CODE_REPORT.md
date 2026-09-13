# Dead Code Report

Organized by category per the audit brief. Each item cites the evidence found this pass. This is a **targeted, evidence-based sweep**, not an exhaustive line-by-line static analysis of every function in the codebase (~150+ files across three languages) — see `FINAL_AUDIT_REPORT.md` for an honest statement of depth vs. breadth.

## 1. Dead components (frontend)

See `DEFINITELY_USELESS_FILES.md` #1-5: `MapControls.jsx`, `TripSummaryPanel.jsx`, `AIAssistantCard.jsx` (all three superseded by "Premium" siblings actually imported by `EverythingMap.jsx`), `TripPlannerSidebar.jsx` (no importer at all), `QuickLinksCard.jsx` (explicitly documented as removed in `Profile.jsx`'s own comment).

## 2. Dead services / modules (backend)

- `backend/src/services/tempBudgetFn.js` — see `DEFINITELY_USELESS_FILES.md` #6. Self-described "TEMPORARY" stub, zero importers.
- `backend/src/providers/amadeus.provider.js` — see `DEFINITELY_USELESS_FILES.md` #7. Zero code imports; the module it was meant to be wired through (`realProviders.js`) uses a plain estimate under the same key name instead of calling this file.

## 3. Dead AI agent + tools (ai-service)

- `ai-service/app/agents/travel_agent.py` — see `DEFINITELY_USELESS_FILES.md` #8. `main.py` explicitly disclaims building on it; only `multimodal_agent` is ever instantiated.
- `ai-service/app/tools/trains.py`, `trip_cost.py`, `user_preferences.py` — see `DEFINITELY_USELESS_FILES.md` #9-11. Imported only by the dead `travel_agent.py`.

## 4. Dead routes

**None found.** Every backend route file confirmed mounted in `backend/src/index.js` (28 route files, all mounted); every controller confirmed referenced by exactly one route file (17 real controllers, 2 `.test.js` files correctly excluded). No unmounted routers, no unreachable routes found this pass.

## 5. Dead controllers

**None found** — see above; every controller has exactly one route-file caller.

## 6. Dead database models

**Not exhaustively re-verified this pass** (this specific check — reader/writer tracing per model — was done in the earlier `qa/e2e/` QA session for the models directly exercised there: `User`, `Trip`, `Offer`, `Waitlist`, `CommunitySubmission`, `Business`, `Visit`, all confirmed actively read/written). The remaining models (`BusinessAvailability`, `Booking`, `Alert`, `Complaint`, `DestinationPressure`, `DestinationDemand`, `AlternativeSuggestion`, `ShareableTrip`, `AuditLog`, `AuthToken`, `Budget`) were not individually reader/writer-traced in *this* forensic pass — flagged NEEDS MANUAL REVIEW rather than guessed at.

## 7. Dead/orphaned scripts

- `scripts/backtest.js`, `scripts/calibrateDistance.js` — zero references, classified MANUAL_SCRIPT not DEAD (see `POTENTIALLY_UNUSED_FILES.md`)
- `ai-service/test.py`, `ai-service/test_agent.py` — same classification
- `backend/src/jobs/precomputePressure.job.js` — the single most consequential finding in this category; see `POTENTIALLY_UNUSED_FILES.md` for the full evidence chain (never wired into `scheduler.js` the way its sibling `pollAlerts.job.js` was, plus corroborating live "stale pressure data" evidence from the earlier E2E pass)

## 8. Dead configuration

- `render.yaml` provisions `AMADEUS_API_KEY` / `AMADEUS_API_SECRET` as production secrets for a provider (`amadeus.provider.js`) that no code path imports — see `BROKEN_REFERENCES.md`.
- Root `.gitignore` lists `COMMIT_CONVENTION.md` (twice) and `docs/`, neither of which is actually ignored in practice — `COMMIT_CONVENTION.md` is tracked in git despite the rule, and `docs/` doesn't exist as a directory at all. Both rules are inert.

## 9. Dead providers

`amadeus.provider.js` (see above). All other provider adapters (`googlemaps.provider.js`, `railradar.provider.js`, `openmeteo.provider.js`, `geocode.provider.js`, `roadtransport.provider.js`, `fareEstimator.provider.js`, `stayEstimate.provider.js`) confirmed to have real importers (1-3 each) via the import-count sweep — all ACTIVE.

## 10. Duplicated functionality (see also `RECOMMENDED_CLEANUP_PLAN.md`)

The three "X.jsx" vs "XPremium.jsx" pairs in `frontend/src/components/map/` are the clearest duplication in the codebase — not near-duplicates requiring judgment calls, but literal alternate implementations of the same component where one side (the non-Premium one) has been fully superseded and is provably unreferenced. See `DEFINITELY_USELESS_FILES.md` #1-3.

## 11. Commented-out / disclaimed legacy code

`ai-service/app/main.py:1318`'s comment (`# Deliberately NOT built on the ADK Agent/tools framework travel_agent.py`) is itself evidence of a conscious architectural pivot away from `travel_agent.py` that was never followed through with deleting the superseded file — a textbook "the comment documents the debt, but the debt was never paid down" pattern.

## Not covered in this pass

Per-function dead-branch analysis (unreachable `if` branches, impossible conditions, unused local variables/constants within otherwise-live files) was **not** performed — that requires either a proper static-analysis tool run (ESLint's `no-unused-vars` was not re-run fresh in this pass, though it has been clean on every file this session has touched directly) or manual line-by-line reading of every file, neither of which fit this pass's time budget. This report focuses on **file-level** reachability (is this whole module ever imported/executed), which is the highest-value, most confidently-evidenced layer of dead-code analysis for a repo this size.
