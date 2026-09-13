# Repository Tree & Root Directory Audit

Snapshot taken on branch `main` (post the `sathvik/rebuild-*` merges), 2026-09-11.

## Root level

| Name | Type | Purpose | Status |
|---|---|---|---|
| `.claude/launch.json` | config | Claude Code dev-server launch config for this tool, not app config | BUILD_ONLY (tooling, not app) |
| `.gcp/vertex-service-account.json` | credential | Local Vertex AI service-account key for this dev machine | **Not tracked in git** (confirmed via `git ls-files` — correctly gitignored, `.gcp/` present in `.gitignore`). Local-only, not a repo hygiene issue. |
| `API_CONTRACTS.md` | doc | API contract reference | ACTIVE_DOC (not fully cross-checked against current routes this pass — see Documentation Audit) |
| `ARCHITECTURE.md` | doc | Architecture description | NEEDS MANUAL REVIEW (not fully read this pass) |
| `COMMIT_CONVENTION.md` | doc | Commit format reference | **CONFIGURATION PROBLEM**: listed in `.gitignore` (twice) yet is tracked in git (`git ls-files` confirms) and present on disk — the ignore rule is inert/stale for this file |
| `DEPLOYMENT.md` | doc | Deployment instructions | NEEDS MANUAL REVIEW |
| `DOCUMENTATION.md` | doc | General documentation, 1119 lines | NEEDS MANUAL REVIEW — large, not fully cross-checked |
| `IMPLEMENTED_FEATURES.md` | doc | Feature changelog, 957 lines | NEEDS MANUAL REVIEW |
| `PPT_TECHNICAL_CONTENT.md` | doc | Presentation content | DOCUMENTATION_ONLY |
| `PROJECT_OVERVIEW.md` | doc | Project overview, 376 lines | **CONFIRMED OUTDATED** — fully read this pass (and in an earlier session turn): describes only the earliest "budget calculation microservice" phase of this project (Express + budget endpoint + auth only). Does not mention the pressure engine, trip planning, substitution/alternatives, community, offers/waitlist, Proof-of-Visit, authority dashboard, or the AI service at all — none of which existed when it was written. See Documentation Audit. |
| `README.md` | doc | Quickstart + folder structure | **CONFIRMED OUTDATED/ASPIRATIONAL** — fully read this pass and earlier this session. Its folder-structure diagram is a *planning* document (e.g. `backend/src/controllers/pressure.controller.js` — real filename, but the diagram also shows a clean `services/` split and an `ai-service/app/tools/` layout that undersells how large `ai-service/app/main.py` has actually grown, currently 1800+ lines with plan-trip logic embedded directly rather than only in `agents/`/`tools/`). Directionally correct, not literally accurate. |
| `dns-fix.cjs` | script | Node DNS-resolution workaround, required to run backend/AI scripts on this dev network | **ACTIVE** — used via `node -r ../dns-fix.cjs ...` throughout this whole project's local dev workflow (established convention this entire session) |
| `render.yaml` | deploy config | Render.com service definitions for backend + AI service | ACTIVE — see Configuration Audit for a specific finding (provisions `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` for a provider that's never imported by any code path) |
| `scripts/backtest.js`, `scripts/calibrateDistance.js` | scripts | Manual pressure-engine calibration tools | MANUAL_SCRIPT — zero references from `package.json` scripts or other code; plausible manual/ad-hoc developer tools given their names (calibration/backtesting is inherently a manual, occasional activity). Not classified DEAD — see Script Audit. |
| `scripts/setup-hooks.bat`, `scripts/setup-hooks.sh` | scripts | Cross-platform git-hooks installer | ACTIVE — referenced by `backend/package.json`'s `prepare-hooks` script and `PROJECT_OVERVIEW.md` |
| `qa/responses/` (5 empty subdirectories) | scaffold | Pre-existing empty directory scaffold, not created by this session | **GENERATED/TEMPORARY, empty** — `ai/`, `alternatives/`, `businesses/`, `concurrency/`, `security/`, all with zero files. Origin unknown (predates this session's own `qa/e2e/` and `qa/repo-audit/` work). Safe-to-review candidate — empty directories carry no risk either way. |

## `backend/` root

| Name | Purpose | Status |
|---|---|---|
| `.env` / `.env.example` | environment config | ACTIVE, `.env` correctly gitignored |
| `budget.http` | REST Client manual test file for the budget endpoint | STALE — describes only the earliest budget-microservice API surface (see `PROJECT_OVERVIEW.md` finding); the app has grown far beyond this single endpoint since |
| `budget.postman_collection.json` | Postman collection, same scope as `budget.http` | STALE, same reasoning |
| `trust-vertical.postman_collection.json` | Postman collection for the trust vertical (visits/community/offers/waitlist/alerts/businesses/safety) | Likely more current than the budget ones given the name matches the more recently built subsystem, but not opened/verified line-by-line this pass — NEEDS MANUAL REVIEW |
| `package.json` / `package-lock.json` | dependency manifest | ACTIVE — see Dependency Audit for one unused dependency finding (`socket.io`) |
| `test-fixtures/` | test fixture data | Referenced by Jest test suites presumably — not individually verified this pass, NEEDS MANUAL REVIEW |

## `frontend/` root

| Name | Purpose | Status |
|---|---|---|
| `.env` / `.env.example` | environment config | ACTIVE |
| `README.md` | frontend-specific readme (Vite's default boilerplate readme, not audited for drift this pass) | NEEDS MANUAL REVIEW |
| `dist/` | Vite build output | GENERATED, correctly gitignored (`dist` in root `.gitignore`) |
| `eslint.config.js`, `vite.config.js`, `vercel.json` | build/deploy config | ACTIVE (eslint confirmed actively used throughout this whole session's own workflow — every frontend change this session was linted with it) |
| `index.html`, `public/` | Vite entry / static assets | ACTIVE |
| `package.json` / `package-lock.json` | dependency manifest | ACTIVE — see Dependency Audit (all 6 dependencies confirmed in active use, no findings) |

## `ai-service/` root

| Name | Purpose | Status |
|---|---|---|
| `.env` / `.env.example` | environment config | ACTIVE |
| `requirements.txt` | Python dependencies | ACTIVE, not exhaustively cross-checked per-package this pass |
| `test.py` | one-off debug script (literally just prints `GOOGLE_APPLICATION_CREDENTIALS`) | MANUAL_SCRIPT — zero references anywhere, trivial content strongly suggests ad-hoc debugging, not a real test |
| `test_agent.py` | manual async agent-testing script | MANUAL_SCRIPT — zero references, not part of any pytest/CI configuration found |
| `app/` | FastAPI application | see sections below |

Full per-directory breakdown of `backend/src`, `frontend/src`, and `ai-service/app` — including every specific ACTIVE/DEAD/DUPLICATE finding — is in `DEAD_CODE_REPORT.md`, `DEFINITELY_USELESS_FILES.md`, and `POTENTIALLY_UNUSED_FILES.md`.
