# Broken Reference Analysis

## Confirmed

### 1. `render.yaml` provisions credentials for a provider nothing imports

`render.yaml` (backend service `envVars`) declares `AMADEUS_API_KEY` and `AMADEUS_API_SECRET` as production secrets to be set in the Render dashboard. `backend/src/providers/amadeus.provider.js` is the only file that would ever read an `AMADEUS_API_KEY`-shaped credential, and it is never imported by any live code path (see `DEFINITELY_USELESS_FILES.md` #7). This isn't a reference to a *missing file* — the file exists — but it is a deployment configuration pointing at a dead code path, which is the same class of problem (config promising an integration the code doesn't deliver).

### 2. `amadeus.provider.js`'s own comment points to a wiring that doesn't exist

The file's header comment says to see `realProviders.js`'s `amadeus.hotels` for how it's used — but `realProviders.js` doesn't import `amadeus.provider.js` at all (confirmed via its own import list, only 4 imports: railradar, stayEstimate, openmeteo, seed). The comment describes an integration point that was either never built or was since removed without updating the comment.

### 3. `.gitignore` rules with no matching effect

- `COMMIT_CONVENTION.md` is listed in `.gitignore` (appears twice, lines ~6 and ~16) but is tracked in git (`git ls-files` confirms) and present on disk. The rule has no effect — git doesn't retroactively untrack a file already in the index when a matching `.gitignore` pattern is added later.
- `docs/` is listed in `.gitignore` but no `docs/` directory exists anywhere in the repository (`ls -d docs` → "No such file or directory"). The rule is currently inert (protects against a directory that was either deleted or never created).

## Not found (checked, came back clean)

- **Frontend routes pointing to missing components**: every `<Route element={...}>` in `App.jsx` was cross-checked against its corresponding import statement at the top of the file — all resolve to real files.
- **Backend routes referencing missing controllers**: every route file's controller import was checked — all 17 non-test controller files exist and are correctly referenced.
- **Frontend API calls to nonexistent backend endpoints**: not exhaustively re-verified in this pass beyond what the earlier `qa/e2e/` QA session already covered (which found the frontend/backend contracts for auth, trips, offers, waitlist, community, dashboard, pressure, and alternatives all correctly matched, with one *documented* payload-shape surprise — the alternatives endpoint expects `origin`+`destId`+`startDate`+`endDate`, not `date` — which is a contract-drift note, not a broken reference, since both sides do agree once the real shape is used).
- **Env vars referenced in code but absent from `.env.example`**: not systematically diffed in this pass (would require enumerating every `process.env.X` reference — done once already in the earlier QA session's `environment_validation.md`, not repeated here).
