# Definitely Useless Files — High Confidence Only

Every entry below was checked via: (1) filename/basename text search across the whole relevant source tree, (2) literal import-statement search, (3) dynamic/string-reference search, (4) route/registry/config search, (5) test-file search, (6) deployment-config search. Only files where **all six** came back empty (or, where something did reference the file, the reference was itself proven to be a dead/commented-out/non-executing path) are listed here.

---

### 1. `frontend/src/components/map/MapControls.jsx`

- **Category**: Duplicate/superseded React component
- **Why it exists**: An earlier version of the map's control panel.
- **Why it is no longer used**: `EverythingMap.jsx` (the real, live map page — confirmed itself actively rendered via `MapPreview.jsx` → `App.jsx`'s `/map` route) imports the control panel under this exact name, but from a *different* file: `import MapControls from './MapControlsPremium'` (`EverythingMap.jsx:10`). `MapControlsPremium.jsx` is the file actually shipped.
- **Search performed**: `grep -rn "from '\./MapControls'"` across all of `frontend/src` (zero matches); basename text search for `MapControls.jsx`/`'MapControls'`/`"MapControls"` anywhere outside `MapControlsPremium` (zero matches).
- **References found**: 0 (import), 0 (dynamic/string), 0 (test), 0 (config)
- **Runtime references**: none
- **Build references**: none (Vite doesn't reference unimported files)
- **Script references**: none
- **Deployment references**: none
- **Test references**: none
- **Confidence**: 99%
- **Recommended action**: Delete (after human confirmation the "Premium" variant is in fact the intended final version, which its being the one actually wired in strongly implies).

---

### 2. `frontend/src/components/map/TripSummaryPanel.jsx`

- **Category**: Duplicate/superseded React component
- Same evidence pattern as #1: `EverythingMap.jsx:14` imports `TripSummaryPanel` from `'./TripSummaryPremium'`, not from this file.
- **Search performed / References found**: identical method to #1, zero real references outside its own file.
- **Confidence**: 99%
- **Recommended action**: Delete.

---

### 3. `frontend/src/components/map/AIAssistantCard.jsx`

- **Category**: Duplicate/superseded React component
- Same pattern: `EverythingMap.jsx:17` imports `AIAssistantCard` from `'./AIAssistantPremium'`, not from this file.
- **Search performed / References found**: identical method, zero real references outside its own file.
- **Confidence**: 99%
- **Recommended action**: Delete.

---

### 4. `frontend/src/components/map/TripPlannerSidebar.jsx`

- **Category**: Orphaned React component (not a duplicate pair like #1-3 — this one simply has no importer anywhere)
- **Why it exists**: A "floating trip planning drawer overlay" for the map canvas, per its own header comment.
- **Why it is no longer used**: No other file references its default export at all — not `EverythingMap.jsx`, not any other map component, not `App.jsx`.
- **Search performed**: `grep -rn "TripPlannerSidebar" frontend/src` — the only two hits are the file's own header comment and its own `export default function` declaration.
- **References found**: 0 outside its own file
- **Confidence**: 98%
- **Recommended action**: Delete (2% held back only because a floating drawer is exactly the kind of UI that could be wired in via a not-yet-merged branch elsewhere in the team's work — worth a 10-second Slack check before deleting, not because this repo shows any evidence of use).

---

### 5. `frontend/src/components/profile/QuickLinksCard.jsx`

- **Category**: Orphaned React component, explicitly documented as removed
- **Why it exists**: An earlier version of the Profile page included a shortcuts grid.
- **Why it is no longer used**: `Profile.jsx`'s own comment states outright: `// QuickLinksCard removed per spec: Profile focuses on account details + preferences...`. The component file itself was never deleted when the decision was made.
- **Search performed**: `grep -rn "QuickLinksCard" frontend/src` — only the file's own definition and `Profile.jsx`'s explanatory comment (which explicitly says it was removed).
- **References found**: 0 real imports; 1 comment confirming intentional removal
- **Confidence**: 99% (this is the single highest-confidence finding in this report — the removal is *documented in the codebase's own comment*, not inferred)
- **Recommended action**: Delete.

---

### 6. `backend/src/services/tempBudgetFn.js`

- **Category**: Orphaned, self-labeled temporary stub
- **Why it exists**: A placeholder budget-estimate function, per its own header: `// TEMPORARY — Bharani's real budget function does not exist yet. ... Replace with her real implementation once it exists — do not let this quietly become the permanent answer.`
- **Why it is no longer used**: Nothing in `backend/` imports the exported `tempBudgetFn` function. The comment even names its sibling — `substitution/test.js`'s own inline mock — implying this file was written to match that test's shape but was never actually wired into the real substitution/alternatives pipeline (which uses its own separately-implemented estimation, per the Dead Code Report).
- **Search performed**: `grep -rn "tempBudgetFn" backend` — only the file's own comment header and its own function declaration.
- **References found**: 0
- **Confidence**: 97% (the file's own comment already flags it as not-meant-to-be-permanent; the only reason this isn't 99% is the small chance a not-yet-merged branch does import it)
- **Recommended action**: Delete, or replace with Bharani's real implementation per the file's own instruction — either way, its current state (present, unused, self-described as temporary) is not the intended end state.

---

### 7. `backend/src/providers/amadeus.provider.js`

- **Category**: Orphaned provider adapter, referencing a non-existent integration
- **Why it exists**: Per its own comment, meant to be wired in via `backend/src/services/pressure/realProviders.js`'s `amadeus.hotels`.
- **Why it is no longer used**: `realProviders.js` (confirmed itself actively used — imported by `collectors.js`, `mockProviders.js`, `service.js`, and `precomputePressure.job.js`) does **not** import `amadeus.provider.js` at all — its own top-of-file imports are only `railradar.provider.js`, `stayEstimate.provider.js`, `openmeteo.provider.js`, and `seed.js`. Its `amadeus` key is a plain estimate (per its own inline comment: `amadeus: Nishith's seed+calendar ESTIMATE -> works (estimate:true)`), never a real call into `amadeus.provider.js`.
- **Search performed**: `grep -rn "amadeus.provider\|from.*amadeus"` across `backend/src` — zero import statements anywhere; the only other repo-wide references are (a) a data-label string `"amadeus_median"` in seed JSON (unrelated — just a data provenance tag, not code), (b) an example payload field in an old Postman collection, (c) `render.yaml` provisioning `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` as production secrets for a provider nothing calls.
- **References found**: 0 real imports; 3 unrelated/config-only string mentions
- **Confidence**: 95% (held below 99% only because `render.yaml` explicitly provisioning credentials for it suggests *someone* intended to finish wiring this in — worth a human decision on whether to finish the integration or remove both the file and the deployment config together, rather than assuming abandonment)
- **Recommended action**: Either wire it into `realProviders.js` for real, or delete both this file and the `AMADEUS_API_KEY`/`AMADEUS_API_SECRET` entries in `render.yaml` together (see `BROKEN_REFERENCES.md` and `RECOMMENDED_CLEANUP_PLAN.md`).

---

### 8. `ai-service/app/agents/travel_agent.py`

- **Category**: Superseded ADK agent, explicitly disclaimed in code
- **Why it exists**: An earlier ADK-Agent-framework-based trip-planning agent, registering 13 tools.
- **Why it is no longer used**: `main.py:1318` states outright: `# Deliberately NOT built on the ADK Agent/tools framework travel_agent.py`. The live `/api/plan-trip` endpoint runs a hand-written deterministic Python pipeline (`_deterministic_summary`/`plan_or_500`) instead. The only agent actually instantiated anywhere in `main.py` is `multimodal_agent` (imported at lines 1696 and 1739, run via `InMemoryRunner` at line 1754) — for the separate `/api/multimodal/*` chat/voice endpoints, a different file entirely.
- **Search performed**: `grep -rln "travel_agent"` across all of `ai-service/app` (only self + the two comment mentions in `main.py`, both non-executing prose); confirmed neither mention is an `import` statement.
- **References found**: 0 real imports; 2 comment-only mentions, one of which explicitly disclaims using it
- **Confidence**: 98%
- **Recommended action**: Delete (see #9-11 below for the tool files this orphans as a consequence).

---

### 9-11. `ai-service/app/tools/trains.py`, `trip_cost.py`, `user_preferences.py`

- **Category**: Orphaned AI-tool wrapper modules, dead as a direct consequence of #8
- **Why they exist**: Tool wrappers registered by `travel_agent.py` (the dead agent above) for train availability, deterministic trip-cost calculation, and stored user preferences respectively.
- **Why they are no longer used**: Each is imported *only* by `travel_agent.py` (`from app.tools.trains import get_train_availability`, `from app.tools.trip_cost import calculate_trip_cost`, `from app.tools.user_preferences import get_user_preferences`) — confirmed via `grep -n "^from app.tools" app/agents/travel_agent.py`. Neither `main.py` nor `multimodal_agent.py` imports any of these three specifically (both were checked directly: `grep -n "trip_cost\|trains\|user_preferences" app/main.py` returns only one unrelated prose comment about there being no train-search API in a different code path).
- **Search performed**: full-repository grep for each module name, cross-checked against every `.py` file's own import list.
- **References found**: 1 each (the dead `travel_agent.py`), 0 from any live entrypoint
- **Confidence**: 90% (slightly lower than the agent file itself, because these are generic-sounding capability names — "train availability," "trip cost," "user preferences" — that a *different*, still-live code path could plausibly want; this pass did **not** find such a path, but did not exhaustively grep every possible synonym either)
- **Recommended action**: NEEDS FINAL CONFIRMATION before deleting — delete together with `travel_agent.py` if confirmed unreachable, but re-verify no other in-flight branch reintroduces a caller first, since the underlying *capabilities* (train search, deterministic cost calc, stored preferences) are plausibly still wanted even if this specific wrapper shape currently isn't called.
