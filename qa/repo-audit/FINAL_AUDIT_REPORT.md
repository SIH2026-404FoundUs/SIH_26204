# SAHYATRI COMPLETE FORENSIC REPOSITORY AUDIT

**Date**: 2026-09-11 · **Branch**: `main` · **Scope**: read-only analysis, zero files modified/deleted/moved

## 1. Executive Summary

The repository is, overall, in reasonably good shape: **zero dead backend routes or controllers**, a clean and fully-used frontend dependency list, and every Mongoose model this pass directly traced is actively read/written. The dead code that *does* exist follows one clear, recurring pattern — **a newer implementation replaced an older one, and the old file was never deleted**: three "X.jsx"/"XPremium.jsx" component pairs in the map UI, one AI agent explicitly disclaimed in its successor's own comment, and one budget-estimate stub the codebase's own author labeled "do not let this quietly become the permanent answer." Nothing found this pass looks like accidental sprawl — every dead file traces back to a deliberate, documented (in-code) supersession that just didn't finish with a `git rm`.

One dependency (`socket.io`, backend) is installed but never imported — real-time features in this app are all built on polling instead. One deployment-config gap (`render.yaml` provisions `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` for a provider file nothing calls) and one plausible-but-unconfirmed production gap (a pressure-precompute job that may never run automatically, with corroborating live evidence from an earlier QA session) are the two findings most worth a team decision, not just a deletion.

**Honesty note on depth**: this is a targeted, evidence-based forensic pass, not a literal file-by-file reading of all ~330 source files in this repository. Every classification in this report is backed by a specific search performed and cited — see the individual `qa/repo-audit/*.md` files for full evidence per finding. Areas not reached this pass (most Mongoose models beyond the ones directly exercised, ai-service's Python dependency list, four of the nine root documentation files, per-function dead-branch analysis) are explicitly listed as NEEDS MANUAL REVIEW rather than guessed at — see `POTENTIALLY_UNUSED_FILES.md` and the per-section notes below.

## 2. Repository Architecture

Three independently deployed services (Express backend :5001, React/Vite frontend :5173, FastAPI+Google-ADK AI service :8000) against a shared MongoDB Atlas database, deployed via `render.yaml` (backend + AI service) and (per `frontend/vercel.json`) Vercel (frontend). Full detail in `01_REPOSITORY_TREE.md`.

## 3. Directory Structure

See `01_REPOSITORY_TREE.md` for the complete root/backend/frontend/ai-service breakdown with per-item purpose and status.

## 4. Frontend Architecture

`frontend/src/components/` is organized by feature area (auth, authority, operator, profile, trust, map, swap, pressure, planner, destinations, shell, ai, ui). The `map/` directory (24 files) is by far the largest and is where all the duplication in this report was found — it's also the most recently and rapidly built area (the "multimodal tourism agent" feature merge), consistent with duplication being a symptom of fast iteration rather than long-term neglect.

## 5. Backend Architecture

`backend/src/` cleanly separates `routes/` → `controllers/` → `services/` (one subdirectory per subsystem: pressure, substitution, alternatives, incentive, onboarding, pov, waitlist, community, feedback, alerts, dashboard) → `models/`, with `providers/` as a separate adapter layer for external APIs. This layering is intact and consistently followed — the dead-code findings here (`tempBudgetFn.js`, `amadeus.provider.js`) are isolated leaves, not evidence of structural rot.

## 6. AI Architecture

`ai-service/app/main.py` (1800+ lines) is the real entrypoint for trip planning — a hand-written deterministic pipeline, *not* the ADK-Agent-framework approach `app/agents/travel_agent.py` represents. `app/agents/multimodal_agent.py` is the one agent actually run, backing the separate `/api/multimodal/*` chat/voice surface. This is architecturally unusual (two competing agent paradigms in one service, one live and one dead) but the live one is clearly identified and the comment in `main.py:1318` makes the decision explicit.

## 7. Database Architecture

21 Mongoose models. This pass directly confirmed active read/write usage for `User`, `Trip`, `Offer`, `Waitlist`, `CommunitySubmission`, `Business`, `Visit` (via the earlier `qa/e2e/` QA session's live testing). The remaining 14 models were not individually reader/writer-traced in this specific forensic pass — see `DEAD_CODE_REPORT.md` §6.

## 8. External Integrations

Google Maps, Google Geocoding, RailRadar, Open-Meteo, Cloudinary, WhatsApp Cloud API all confirmed to have real, actively-imported adapter code. Amadeus is the one exception — credentials provisioned in deployment config, adapter file present, but never actually called (see `BROKEN_REFERENCES.md` #1-2).

## 9. Active Files

The overwhelming majority of the ~330 source files in this repository. Every backend route (28) and controller (17), every frontend Zustand store (10) and UI primitive (10), and all 6 frontend + 12 backend npm dependencies (minus `socket.io`) confirmed active via direct reference-tracing this pass.

## 10. Indirectly Active Files

`frontend/src/components/swap/index.js` — a barrel file with **zero direct-string matches** in a naive grep sweep, but confirmed active via `App.jsx`'s directory-style import (`from './components/swap'`, which Node/Vite resolve to `index.js` automatically). Cited here specifically as the one case this pass's method could have gotten wrong if not manually double-checked — a concrete demonstration of the brief's own "trace indirect usage before declaring dead" rule actually mattering in practice.

## 11. Test-Only Files

`onboarding.controller.test.js`, `whatsappWebhook.controller.test.js`, and the various `*.test.js` files throughout `backend/src/services/onboarding/` — correctly excluded from the "does a route reference this" sweep since tests aren't meant to be referenced by routes.

## 12. Build/Deployment Files

`render.yaml`, `frontend/vercel.json`, `frontend/vite.config.js`, `frontend/eslint.config.js`, `backend/package.json` scripts, `dns-fix.cjs` (a local-dev DNS workaround, load-bearing for this whole session's own local dev workflow). All confirmed active.

## 13. Generated Files

`frontend/dist/` (Vite build output, correctly gitignored). No other generated artifacts found tracked in git.

## 14. Temporary Files

None found tracked in git. `.gcp/vertex-service-account.json` exists on disk but is correctly gitignored and untracked — local dev state, not a repository hygiene issue.

## 15. Duplicate Files

The three map-component pairs — see `DEFINITELY_USELESS_FILES.md` #1-3. No other duplication found this pass (frontend stores, UI primitives, and backend services were all checked and came back with exactly one implementation each).

## 16. Stale Files

`PROJECT_OVERVIEW.md` (confirmed, describes only the earliest project phase), `README.md` (confirmed, aspirational folder-structure diagram), `backend/budget.http`/`budget.postman_collection.json` (scope-stale, not wrong for what they cover).

## 17. Potentially Unused Files

Full list with evidence in `POTENTIALLY_UNUSED_FILES.md` — 8 distinct findings covering manual scripts, Postman collections, an empty scaffold directory, and four root docs not fully cross-read this pass.

## 18. DEFINITELY USELESS FILES

11 files across 5 distinct root causes — full evidence per file in `DEFINITELY_USELESS_FILES.md`.

## 19. Dead Code

See `DEAD_CODE_REPORT.md` for the full 11-category breakdown (dead components, services, AI agent+tools, routes [none found], controllers [none found], models [not exhaustively checked], scripts, configuration, providers, duplication, disclaimed legacy code).

## 20. Dead Routes

**None found.** Every route file mounted, every controller referenced.

## 21. Dead Components

5 — see `DEFINITELY_USELESS_FILES.md` #1-5.

## 22. Dead Services

2 — `tempBudgetFn.js`, `amadeus.provider.js`.

## 23. Dead Database Models/Fields

Not exhaustively determined this pass — see §7 above and `DEAD_CODE_REPORT.md` §6.

## 24. Dead AI Tools

3 — `trains.py`, `trip_cost.py`, `user_preferences.py`, all orphaned as a consequence of `travel_agent.py` being dead.

## 25. Unused Dependencies

1 confirmed (`socket.io`, backend) — full detail in `UNUSED_DEPENDENCIES.md`. Frontend dependency list is clean. AI service's `requirements.txt` not individually cross-checked this pass.

## 26. Unused Scripts

4 flagged as MANUAL_SCRIPT (not DEAD) — `scripts/backtest.js`, `scripts/calibrateDistance.js`, `ai-service/test.py`, `ai-service/test_agent.py`. One flagged with real production-impact concern — `precomputePressure.job.js` — see `POTENTIALLY_UNUSED_FILES.md`.

## 27. Broken References

3 — full detail in `BROKEN_REFERENCES.md` (Amadeus credential/code mismatch ×2, two inert `.gitignore` rules).

## 28. Legacy / Removed Feature Remnants

**None found.** This pass specifically searched for remnants of the product decisions the team has explicitly moved away from (Tourism Credits, blockchain/hash-chain ledger, crime-based safety scoring, dietary-aware recommendations, checkout/payments, automated provider login, CAPTCHA solving, fake visit counts, automatic community-submission-to-destination promotion) — `grep -rniE` sweeps for these terms across `backend/src`, `frontend/src`, and `ai-service/app` returned no functional code matches, only the deliberate, correctly-implemented moderation gate (`CommunitySubmission` → authority review → only-then `Destination` creation) that exists specifically *because* automatic promotion was rejected as a design.

## 29. Configuration Problems

`.gitignore`'s two inert rules (`COMMIT_CONVENTION.md`, `docs/`); `render.yaml`'s Amadeus credential provisioning for dead code. See `BROKEN_REFERENCES.md`.

## 30. Documentation Drift

`PROJECT_OVERVIEW.md` and `README.md` both confirmed stale/aspirational (full read, this pass and earlier this session). `ARCHITECTURE.md`, `DOCUMENTATION.md`, `IMPLEMENTED_FEATURES.md`, `API_CONTRACTS.md` not fully cross-read this pass — flagged for manual review given the confirmed drift in their two siblings raises real (not just theoretical) risk that they've drifted too.

## 31. Repository Duplication

Covered in §15 above — isolated to the three map-component pairs, no broader pattern found.

## 32. Technical Debt

The recurring theme across nearly every finding in this report: **supersession without cleanup**. Three component pairs, one AI agent, one deployment-config/code mismatch — all traceable to a real decision having been made (and often explicitly documented in a code comment) but the losing side never being deleted. This is a healthy sign in one respect (the team documents its own pivots) and a real, accumulating cost in another (a new contributor reading `MapControls.jsx` or `travel_agent.py` cold has no signal it's dead without doing exactly the tracing this report did).

## 33. Cleanup Plan

Full 4-phase plan in `RECOMMENDED_CLEANUP_PLAN.md`.

## 34. Files That MUST NOT Be Deleted

Full list in `RECOMMENDED_CLEANUP_PLAN.md` §Phase 4 — all active routes/controllers/models/providers/tools, all test files, all deployment/build config, seed data, git hooks.

## 35. Manual Review Required

10 items — see `POTENTIALLY_UNUSED_FILES.md` and `RECOMMENDED_CLEANUP_PLAN.md` §Phase 3.

## 36. Final Repository Health

| Dimension | Score | Notes |
|---|---|---|
| Structure | Good | Clean, consistent layering in both backend and frontend; no structural violations found |
| Modularity | Good | Services/routes/controllers cleanly separated; map/ directory is the one area showing growing-pains-style duplication |
| Duplication | Good (minor issue) | 3 component pairs, isolated and easy to resolve |
| Dead Code | Needs Cleanup | 11 files, all traceable to documented supersessions — small in absolute count but real |
| Documentation | Needs Cleanup | 2 of 9 root docs confirmed stale/aspirational; 4 more unverified this pass |
| Dependency Hygiene | Good (minor issue) | 1 unused backend dependency; frontend clean |
| Configuration Hygiene | Needs Cleanup | 1 deployment-config/code mismatch (Amadeus), 2 inert gitignore rules |
| Test Hygiene | Good | Test files consistently colocated and named `*.test.js`/`test_*.py`; no orphaned test infrastructure found |
| Build Hygiene | Good | No generated/build artifacts tracked in git; build configs all active |
| Deployment Hygiene | Needs Cleanup | Amadeus credential provisioning for dead code; unresolved question on whether the pressure-precompute job runs in production at all |

**Overall: GOOD, needs targeted cleanup** — not poor, not critical. The findings in this report are real but narrow in scope relative to the size of the codebase.
