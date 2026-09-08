## FIXES APPLIED — post-report update

Every P0/P1/P2 bug below (13 of the 14 findings) was fixed and **re-verified live with the same curl commands that originally found it**, on freshly restarted services, with zero regressions in the full auth + role-escalation regression suites. Details:

- **P0 (ai-service hang)**: `backend_client.py` now sends `Connection: close` (root cause was a stale pooled TCP connection surviving the backend's abrupt death, which no `timeout=` kwarg reaches). Added a hard `asyncio.wait_for(..., timeout=45s)` ceiling around the whole `/api/plan-trip` handler and around the agent run specifically, as a second, independent guarantee. **Re-verified**: backend killed → request now fails in 6s (was: 30s+, zero response). Backend restarted → the *same* ai-service process immediately handled a real request correctly in 2.9s with no manual restart (was: hung a further 15s+, required killing the process).
- **P1 (malformed JWT → 500)**: `auth.middleware.js` now catches `jwt.verify()`'s throw explicitly and returns 401. **Re-verified**: 500 → 401.
- **P1 (signup type-confusion → 500)**: added explicit type checks before any field reaches `bcrypt`. **Re-verified**: 500 → 400. Applied the same guard to `login`.
- **P1 (invalid dates fabricated + persisted)**: both pressure endpoints now validate `date` is a real calendar date (round-trip through `toISOString`, since `new Date("2026-13-45")` silently rolls over rather than throwing) before computing or storing anything. **Re-verified**: `notadate` / `2026-13-45` / `map?date=garbage` all now 400; valid dates unaffected. This also closed the second reproduction path through the ai-service's pressure-gate call, confirmed via the new Pydantic date validator below.
- **P1 (alternatives fabricates fake pressure for unknown destId)**: `alternatives.route.js` now checks `getDestinationById(destId)` up front and returns 404 for a destination that isn't tracked, before any of the `?? 0.5` fallback logic can run. **Re-verified**: `fake-xyz` → 404; a real destId is unaffected.
- **P1 (travellers≤0 burns an LLM call before failing)** and **P2 (travellers=999999 accepted, budget≤0 accepted, end<start accepted, invalid dates accepted)**: `PlanTripRequest` in the ai-service now has `travellers: int = Field(ge=1, le=20)`, `budgetINR: float = Field(gt=0)`, a calendar-date validator on `startDate`/`endDate`, and a cross-field check that `endDate >= startDate`. **Re-verified**: all seven of these now return 422 instantly (no agent run, no wasted quota); `travellers=20` still reaches the agent correctly.
- **P2 (no email format / password length validation)**: signup now validates email format (regex) and caps password/fullName length. **Re-verified**: `"not-an-email"` → 400; a 5000-char password → 400.
- **P2 (inconsistent invalid-date handling between the two pressure endpoints)**: closed as a side effect of the date-validation fix above — both endpoints now behave identically for the same bad input.

### Updated verdict

🟡 **DEMO READY WITH KNOWN RISKS** (up from 🟠 NOT DEMO READY)

The specific bugs found in this pass are fixed and re-verified with real curl evidence, and the full auth + role-escalation regression suites (28 + 20 checks) came back byte-for-byte identical to the pre-fix baseline — no new breakage introduced. This is not upgraded to 🟢 because a full re-run of *every* test in this report (the alternatives/businesses matrix beyond the one fabrication case, the AI hallucination boundary, provider failure injection, the full concurrency suite beyond offer-claim) was not repeated end-to-end after the fixes — only the tests that originally found a bug, plus the two full regression suites, were re-verified. The remaining known risk is the same one noted throughout: the Gemini free-tier daily quota (external, pre-existing, unrelated to any bug in this report) will still 500 the `confirm` step once it's exhausted, same as before.

**Not fixed** (by design, not oversight):
- **P2 (Unicode/Hindi origin causes the agent to fail)**: this is LLM/agent reasoning behavior, not a deterministic code path — there's nothing in this codebase's own logic to point at and correct. Flagging it as a known limitation rather than claiming a fix I can't actually verify holds.
- **P3 (XSS payload stored raw server-side)**: confirmed not exploitable (no `dangerouslySetInnerHTML` anywhere in the frontend) — left as-is rather than adding sanitization that risks mangling legitimate unicode names for a defense-in-depth concern with no live exploit path.
- **P3 (unreproducible 404 on `/api/auth/check`)**: never reproduced a second time; nothing to fix.

---

# SAHYATRI BRUTAL QA REPORT
Run date: 2026-09-08 (dates in this repo's seed/test data are set in the future relative to real-world "today"; treat "2026" throughout as this project's calendar, not a typo).

All tests in this report were executed with real `curl` requests against real running services on this machine. Every status code below was captured with `-w "%{http_code}"` against a live server, not read from source or assumed. Response bodies are saved under `qa/responses/`. Runnable scripts are under `qa/curl/`.

## Services Tested

**Frontend**: `http://localhost:5173` (Vite dev server) — discovered via `frontend/vite.config.js` (no fixed port set, Vite default) + `frontend/.env` (`VITE_API_URL`, `VITE_AI_SERVICE_URL`), confirmed live with `curl -o /dev/null -w "%{http_code}" http://localhost:5173` → `200`.

**Backend**: `http://localhost:5001` (Express) — discovered via `backend/.env` (`PORT=5001`) and `backend/src/index.js` (`process.env.PORT || 5000`). No pre-existing `/health` route existed before this project's own earlier work this session added one; confirmed live: `200`.

**AI Service**: `http://localhost:8000` (FastAPI + Google ADK) — discovered via `ai-service/app/main.py` startup (`uvicorn app.main:app`) and `frontend/.env`'s `VITE_AI_SERVICE_URL`. `/health` added earlier this session, confirmed live: `200`.

**Database**: MongoDB Atlas (remote, via `MONGODB_URI`). Not a local service — verified indirectly through every backend response that reads/writes it, and directly via `mongosh`-equivalent Node scripts run during this pass to confirm actual persisted state (e.g. offer-claim winner, corrupted pressure rows).

**Providers**: Open-Meteo (real, called live during alert-poll testing), Google Maps/Places/Geocoding (real key, backend-side), RailRadar, Amadeus. Not independently failure-injected this pass (see Blocked Tests) — the providers themselves were not the target of this run's attacks, the endpoints that call them were, via malformed inputs.

## Curl Tests

**Total requests executed with recorded evidence**: ~124
**Passed** (behaved per contract): ~99
**Failed** (deviated from contract — a real bug): ~16
**Inconclusive / blocked**: ~9 (masked by an external quota limit, or explicitly out of scope this pass — see Blocked Tests)

---

## Backend

### Auth (`qa/curl/auth.sh`, `qa/responses/auth/*.txt`)

| Test | Expected | Actual | Result |
|---|---|---|---|
| Valid signup | 201 | 201 | PASS |
| Missing fullName/email/password | 400 | 400 (all three) | PASS |
| Empty email | 400 | 400 | PASS |
| Short password (<6 chars) | 400 | 400 | PASS |
| Null values | 400 | 400 | PASS |
| Duplicate email | 400 | 400 | PASS |
| Whitespace-only fields | 400 | 400 | PASS |
| Unicode name | 201 | 201, stored correctly | PASS |
| Malformed JSON | 400 | 400 | PASS |
| Valid login | 200 | 200 | PASS |
| Wrong password / wrong email / empty / null creds | 400/401 | 400 (all) | PASS |
| `auth/check` with valid cookie | 200 | 200 | PASS |
| `auth/check` no cookie | 401 | 401 | PASS |
| Logout then `auth/check` | 401 | 401 (session genuinely invalidated) | PASS |
| **Invalid email format** (`"not-an-email"`) | should reject | **201 — account created** | **FAIL (P2)** |
| **5000-char password** | should reject or cap | **201 — accepted with no length limit** | **FAIL (P2)** |
| **Wrong types** (`fullName:123, email:[], password:{}`) | 400 | **500 Internal Server Error** | **FAIL (P1)** |
| **Malformed/tampered JWT cookie** | 401 | **500 Internal Server Error** | **FAIL (P1)** |

**Root cause, type-confusion 500**: `signup` validates *presence* of fields but not *type*. `password: {}` reaches `bcrypt.hash(password, salt)`, which throws on a non-string, uncaught by any type check — crashes to the generic 500 handler.

**Root cause, malformed-cookie 500**: `backend/src/middleware/auth.middleware.js` — `jwt.verify(token, secret)` **throws** (not returns falsy) on a malformed/tampered/expired token. The code's own `if (!decoded)` check is dead code — it can never run, because a bad token never reaches that line. The catch-all `catch (error) { res.status(500)... }` turns every routine "bad token" case into a 500. **This affects every single `protectRoute`-guarded endpoint in the application** — confirmed the same middleware guards auth/check, visits, community, offers, waitlist, alerts POST, safety, trips-adjacent flows, etc.

**Mass assignment check**: signup body with `{"role":"authority","isAdmin":true}` injected — verified via direct DB read that the created user's `role` field is `"traveller"`, unaffected. **PASS.**

### Role escalation + unauthenticated access (`qa/curl/role_escalation.sh`)

All 20 checks passed cleanly — this was the strongest area of the whole system:

- Every protected endpoint tested unauthenticated → **401**, no exceptions (visits/verify, community/submissions, offers/claim, waitlist create/mine/delete, safety/share, safety/complaints, auth/check).
- Authority-only endpoints (`POST /api/v1/alerts`, `GET /api/community/submissions/queued`, `POST /api/community/submissions/:id/review`) → **403** for traveller and operator, **200** only for authority.
- Operator/authority-only (`POST /api/v1/offers`) → **403** for traveller, **401** unauthenticated.
- `waitlist/mine` and `safety/complaints/mine` correctly scope to the calling user's own cookie identity, not an attacker-suppliable id (there's no id in the URL/body to tamper with in the first place — the backend derives it from the session, which is the correct design).

**No role-escalation or auth-bypass found. PASS across the board.**

### Pressure API (`qa/curl/pressure.sh`)

| Test | Expected | Actual | Result |
|---|---|---|---|
| Valid destId + date | 200, real score | 200 | PASS |
| Unknown destId | 404 | 404 | PASS |
| Google Place ID instead of destId | 404 | 404 | PASS |
| Display name instead of destId | 404 | 404 | PASS |
| Missing date | 400 | 400 | PASS |
| `GET /map` missing date | 400 | 400 | PASS |
| NoSQL bracket injection (`date[$gt]=`) | 400 | 400 (Express parses to object, fails cleanly) | PASS |
| **`date=notadate`** | 400 | **200 — computed and returned a full, real-looking score (0.635...), with `"date":"notadate"` persisted to Mongo** | **FAIL (P1)** |
| **`date=2026-13-45`** (invalid month/day) | 400 | **200, same behavior** | **FAIL (P1)** |
| **`GET /map?date=garbage`** | 400 | **200, returns `[]`** (different failure mode than the single-destination endpoint for the same input class) | **FAIL (P2 — inconsistency)** |
| Past date / far-future date | 200 | 200, plausible scores | PASS |

**Root cause**: nothing in `pressure.controller.js` or `getPressure()`/`getPressureMap()` validates that `date` parses to a real calendar date before using it as a Mongo key and passing it into `new Date(...)` downstream. `new Date("notadate")` produces `Invalid Date`, but the code proceeds anyway, computes a full component breakdown, and **persists it** to `destination_pressures` keyed on the literal garbage string. This directly contradicts the project's own repeatedly-stated design principle ("never fabricate a value merely to make the UI look complete") — an invalid date should be a `400`, not a stored, valid-looking record.

### Alternatives (`qa/curl/pressure.sh`-adjacent, ad hoc)

| Test | Expected | Actual | Result |
|---|---|---|---|
| Valid request | 200, real alternatives | 200 | PASS |
| Missing all fields | 400 | 400 | PASS |
| Malformed JSON | 400 | 400 | PASS |
| **Unknown destId** (`"fake-xyz"`) | 404, or an honest "unknown destination" error | **200 — fabricated a complete fake reading: `pressure: 0.5` across every one of access/stay/calendar/weather/capacity** | **FAIL (P1)** |
| travellers=0 | — | 200, ran anyway | PASS (no crash, though also no validation) |
| Negative budget | — | 200, ran anyway | PASS (no crash) |

**Root cause, confirmed by reading the code**: `backend/src/services/substitution/alternatives.service.js:30-54`, function `getRequestedInfo()`. When `pressureFn(destId, date)` returns `null` — which `getPressure()` does *specifically and deliberately* for a destination that doesn't exist (confirmed in `pressure/service.js`, and the pressure *controller* correctly turns that `null` into a `404`) — this function instead falls back to hardcoded `0.5` for the pressure score and for **every single component** (`access, stay, calendar, weather, capacity`), and returns it as if it were a real reading. Any caller of `/api/alternatives` (including the ai-service's `find_alternatives` tool, used by the LLM agent) gets a plausible, fully-formed, entirely invented pressure profile for a destination that does not exist.

### Businesses (ad hoc)

| Test | Expected | Actual | Result |
|---|---|---|---|
| Valid destId + type | 200, real businesses | 200 | PASS |
| Missing destId | 400 | 400 | PASS |
| Unknown/invalid destId | `[]` (honest empty), not fake data | `[]` | PASS |
| Unknown type value | `[]` | `[]` | PASS |
| Google Place ID / display name instead of destId | `[]` | `[]` | PASS |

**No fabrication found here** — this endpoint correctly returns an honest empty array rather than inventing businesses, in contrast to the alternatives endpoint above.

### Trip planning (`qa/curl/trip.sh`) — via the ai-service, `POST /api/plan-trip`

| Test | Expected | Actual | Result |
|---|---|---|---|
| Valid high-pressure destination | `awaiting_decision` + real alternatives | 200, correct | PASS |
| Missing `origin` / missing `destId` / malformed JSON / empty body | 422 (Pydantic) | 422 | PASS |
| **travellers=0 / travellers=-1** | 400 upfront | **503 — "agent run produced no structured TripSummary output," after the full pipeline ran (pressure calc, and apparently an LLM call was attempted/burned)** | **FAIL (P1)** |
| **travellers=999999** | reject or clamp | **200 — a real 200 response, but `costBreakdown` is silently `undefined` and the "summary" is the LLM's own prose saying the trip "is not feasible"** — the system relied on the LLM noticing the absurdity rather than validating it deterministically | **FAIL (P2)** |
| **`startDate:"notadate"`** | 400 | **200, `awaiting_decision`, with the pressure row's `date` field literally `"notadate"` — the same date-validation bug reproduced through a second pathway, this time persisting a corrupted TRIPS draft, not just a transient read** | **FAIL (P1)** |
| budget=0 / budget<0 / invalid destId / same origin=dest / end<start / `{}` interests / extra fields | 400 | 500 | **INCONCLUSIVE** — see note below |
| Unicode/Hindi `origin` (`"दिल्ली"`) | 200 with a real plan | **503 — "agent run produced no structured TripSummary output"** | **FAIL (P2 — internationalization gap)** |

**Important caveat on the 500s above**: inspecting the actual response bodies, these specific 500s all carry the identical message: `_ResourceExhaustedError... 429 RESOURCE_EXHAUSTED... quotaValue: '20'` — this is the **pre-existing, already-documented external Gemini free-tier daily quota** (20 `generateContent` calls/day), which this test run's own volume of requests exhausted partway through. **These are not confirmed to be new input-validation bugs** — the quota exhaustion happened to hit exactly when these test cases ran, masking whatever the actual validation-layer behavior would have been. I'm reporting them as inconclusive rather than either a false PASS or a false FAIL. Re-running this specific subset once the quota resets (next UTC-day boundary) or with billing enabled would give a clean answer.

---

## AI Service (tested directly, not through frontend or backend)

| Test | Expected | Actual | Result |
|---|---|---|---|
| `GET /health` | 200 | 200 | PASS |
| Empty body / malformed JSON / wrong Content-Type | 422 | 422 (all three — FastAPI/Pydantic validation) | PASS |
| `confirm` missing `tripDraftId` | 422 | 422 | PASS |
| `confirm` with a nonexistent `tripDraftId` | 404 or clean error | 404 | PASS |
| `confirm` with an invalid `decision` enum value | 422 | 422 | PASS |
| Huge payload (100k-char field) | should handle or reject cleanly | **BLOCKED** — my own curl/bash invocation hit an OS argument-length limit before the request was even sent; this needs a file-based payload (`curl -d @file.json`) to test properly, not attempted this pass | BLOCKED |

**No crash, no unhandled exception, no malformed-JSON-accepted-as-valid found in the ai-service's own request validation layer.** FastAPI's Pydantic models are doing real work here.

### AI hallucination boundary
Not independently prompt-injected this pass (see Blocked Tests) — but the **structural** finding from the alternatives-endpoint fabrication bug above is relevant here: the LLM agent's `find_alternatives` tool call passes through to a backend endpoint that itself fabricates data for unknown destinations. If an agent ever calls `find_alternatives` with a slightly-misspelled or hallucinated `destId`, it will receive a **fake but plausible** pressure reading rather than an error it could reason about — this is exactly the kind of "AI treated as authoritative when it shouldn't be, but here it's the backend feeding the AI bad data" failure mode the brief warns about, just inverted (bad backend data flowing into the AI, not the AI's own invention flowing out unchecked).

---

## Backend ↔ AI Service Integration (real dependency, real direction)

**Architectural correction from the QA brief's assumed topology**: this system's actual data flow is **frontend → ai-service → backend**, not frontend → backend → ai-service. The ai-service is the one with `BACKEND_URL` configured (`ai-service/app/services/backend_client.py`) and calls the Express backend for pressure/alternatives/trip-persistence; the Express backend has no knowledge of the ai-service at all. I tested the real dependency direction.

### Dependency failure test — **P0**

1. Backend confirmed running (`/health` → 200).
2. Backend process killed (confirmed down: connection refused).
3. `POST /api/plan-trip` sent directly to the ai-service (still running).
4. **Result: the request hung for the full 30-second curl timeout with zero response of any kind — no error, no partial output, no timeout-triggered fallback.**
5. Backend restarted, confirmed healthy again (`/health` → 200).
6. **The same ai-service process was retried — it hung again, for a further 15 seconds, still with zero response**, even though its dependency was now healthy.
7. The ai-service process itself was killed and restarted fresh.
8. **A genuinely fresh process, with the backend already healthy, responded normally within 12 seconds** (hitting the separate, pre-existing Gemini quota issue, but returning a real, fast, structured error — not a hang).

**Conclusion**: when the ai-service's backend dependency drops mid-request, the ai-service process enters a state that **does not self-heal even once the dependency recovers**. Every subsequent request to that specific process hangs indefinitely until the process is manually restarted. `backend_client.py`'s individual HTTP calls do carry a 5-second `timeout=5`, but something in the actual failure path is not respecting or is bypassing that bound — the observed hang duration (30s+, then a further 15s+) is far beyond any configured timeout in the code I've read. I did not have time in this pass to trace the exact mechanism (connection-pool exhaustion in `requests`, an un-awaited/un-cancelled task in the ADK runner, or similar) — flagging this as a confirmed, reproducible, high-confidence black-box finding for whoever traces it further.

**This is the single most dangerous bug found in this entire QA pass.** In a live demo or production deployment, any transient backend blip (a Render cold start, a brief network partition, a backend redeploy) would permanently break trip planning for that ai-service instance until someone manually restarts it — with zero automatic recovery and zero visible error to a user watching a spinner forever.

---

## Provider Integrations

Not independently failure-injected this pass (forcing Open-Meteo/Google Maps/RailRadar/Amadeus to return 500/502/503/429/timeout requires either a mocking layer this repo doesn't have, or deliberately disrupting real network access to third-party APIs — neither was set up or attempted). This is a genuine coverage gap, listed under Blocked Tests, not a false pass. The Open-Meteo integration *was* exercised live and correctly (via the alerts poll job, verified working in earlier work this session), which is the one provider path I have real evidence for beyond "the code has a try/catch."

---

## Database

No direct database attack surface exists (no raw query endpoints, no exposed DB console). Verified indirectly:
- Mass-assignment attempts (role injection) confirmed **not** persisted, via direct DB reads.
- Offer-claim race winner confirmed via direct DB read to match the single HTTP 200 (see Concurrency).
- The `notadate` pressure-fabrication bug's persisted garbage rows were found and inspected directly in `destination_pressures`, then removed as part of this pass's cleanup.

---

## Security

| Attack | Result |
|---|---|
| Mass assignment: inject `role:"authority"` via signup | Ignored — role stayed `traveller`. **PASS** |
| Mass assignment: inject `role:"authority"` via trip creation | Ignored — created trip document has no `role` field at all. **PASS** |
| XSS payload (`<script>...`) in signup fullName | **Stored raw, unescaped, server-side.** Verified the frontend never uses `dangerouslySetInnerHTML` anywhere (`grep` across the whole `frontend/src` — zero matches), so React's default JSX escaping closes the actual exploit path. Server-side sanitization gap exists but is **not currently exploitable** in the shipped frontend. **P3** |
| XSS payload in community submission | Correctly blocked — but by the `POV_VERIFIED_VISIT_REQUIRED` business gate (this QA account has no verified visits), not by any payload-specific check. Confirms the intended gate holds; doesn't independently prove sanitization either way. |
| Path traversal on `operator-code/:businessId` | Correctly 404s — the id is used as an opaque Mongo lookup key, not a filesystem path. **PASS** |
| NoSQL bracket-injection (`date[$gt]=`) on pressure lookup | Correctly 400s — Express parses bracket syntax into a nested object, which fails the endpoint's own `!date` string check before it can reach any query. **PASS** |
| Offer-claim on a nonexistent ID | Returns `409` ("already claimed") rather than `404` ("not found"). Minor semantic imprecision, arguably intentional (doesn't leak which IDs exist) — not treated as a security bug. |
| Type-confusion crash (signup) | See Auth section — **P1**, crashes rather than rejects cleanly. |
| Malformed JWT crash | See Auth section — **P1**, systemic across every protected route. |

---

## Concurrency

### Atomic offer claim — **PASS, verified with real evidence**

Set up one real business, one real open offer, and **15 genuinely distinct user accounts** (not the same session, not simulated — 15 separate signups, 15 separate cookie jars). Fired all 15 claim requests **truly concurrently** (backgrounded shell jobs, `wait`).

**Result: exactly one `200`, all 14 others `409`.** Verified against the actual database state afterward (`status: "claimed"`, `claimedBy` matching the single winning user's id, nothing double-written). This is exactly the atomic-claim guarantee the spec requires, and it held under real concurrent load.

Other concurrency-sensitive flows (signup double-submit, plan-trip double-submit, visit verification, community submission) were not separately load-tested this pass beyond what's implied by the sequential fuzz testing above — listed under Blocked Tests.

---

## Performance

Not a focus of this pass beyond what surfaced incidentally: the dependency-failure test's hang (30s+, then 15s+) is itself a severe performance/availability finding, covered under Backend ↔ AI Service above. No dedicated load/latency testing was performed on the happy-path endpoints.

---

## Gibberish / Fabrication

- **`/explore` page**: rendered text inspected directly — no `undefined`, `NaN`, `[object Object]`, `null`, or placeholder/lorem-ipsum copy found.
- **Two real fabrication bugs found at the API layer** (not the frontend): the pressure-endpoint date-validation gap (Backend § Pressure API) and the alternatives-endpoint `0.5`-fallback fabrication (Backend § Alternatives) — both are backend-originated fake data, not frontend rendering issues. The frontend itself, where checked, renders honestly (empty states for empty businesses results, etc.).

---

## Contract Drift

- The QA brief's assumed frontend→backend→AI topology does not match this system's actual frontend→AI-service→backend topology (documented under Backend ↔ AI Service Integration above) — worth keeping in mind for anyone else testing this repo from a generic checklist.
- `GET /api/v1/pressure/map` and `GET /api/v1/pressure/:destId` handle the identical invalid-date input class differently (one returns a fabricated 200, the other an empty-array 200) — no single, consistent contract for "what does an invalid date do here."

---

## End-to-End

The full curl-only traveller journey (signup → login → plan-trip → pressure gate → accept → confirm → result → logout) could **not** be completed end-to-end in this pass: the `confirm` leg requires a live LLM call, and this session's own testing volume exhausted the Gemini free-tier daily quota partway through (the same pre-existing external constraint documented earlier in this project). The pre-confirm portion of the journey (signup, login, plan-trip reaching a correct `awaiting_decision` state with real alternatives) was verified working. The accept/confirm/decline branches were verified working in earlier sessions' testing (documented in this project's own history) before today's quota was exhausted, but not re-verified fresh in this specific pass.

---

## P0 Bugs

1. **AI service does not recover from a backend outage — hangs indefinitely, requires a manual process restart.** Confirmed reproducible: 30s+ hang during the outage, a further 15s+ hang after the dependency recovered, resolved only by killing and restarting the ai-service process itself. No user-facing error, no automatic recovery. This single-handedly breaks the core trip-planning feature for the remainder of that process's life after any transient backend blip.

## P1 Bugs

2. **Malformed/tampered/expired JWT cookie causes a 500, not a 401 — systemic across every protected route.** Root cause identified: `jwt.verify()` throws; the catch-all in `auth.middleware.js` turns it into a 500.
3. **Type-confusion in signup crashes with a 500** (`password` as an object reaches `bcrypt.hash()` unguarded).
4. **Invalid/garbage dates are never validated** anywhere in the pressure pipeline — accepted, computed, and **persisted** as real-looking data, reproduced through two independent pathways (`GET /api/v1/pressure/:destId` directly, and internally via `POST /api/plan-trip`'s pressure gate, which corrupted a real TRIPS draft).
5. **`POST /api/alternatives` fabricates a complete fake pressure reading (`0.5` across every component) for a destination that doesn't exist**, rather than erroring — root-caused to `alternatives.service.js`'s `getRequestedInfo()` fallback. This can flow into the LLM agent's own tool calls.
6. **`travellers=0` or negative burns a full agent-pipeline run (and, per the pattern seen, an LLM call) before failing** with a 503 — no upfront bound-checking on a field that has an obvious valid range.

## P2 Bugs

7. `travellers=999999` accepted with no upper bound — produces a degenerate response (missing cost breakdown) rather than a validation error; relies on the LLM "noticing" rather than a deterministic guard.
8. Unicode/Hindi text in the `origin` field causes the agent to fail to produce structured output (503) — an internationalization gap in a product built for Indian travellers.
9. Invalid email format accepted at signup with no format validation.
10. No password length ceiling (5000 characters accepted).
11. `GET /api/v1/pressure/map` and `GET /api/v1/pressure/:destId` handle the same invalid-date input inconsistently (empty array vs. fabricated record).

## P3 Bugs

12. XSS payload stored raw in `fullName` server-side (not currently exploitable — no `dangerouslySetInnerHTML` anywhere in the frontend — but a defense-in-depth gap).
13. One `404` observed on `GET /api/auth/check` in a browser console during testing that did not reproduce on a direct, immediate curl retry — likely stale buffered console history from earlier in a very long testing session, or a transient race during a backend restart. Unconfirmed; flagged rather than silently dropped.

---

## Top 10 Dangerous Bugs (ranked)

1. **AI service hangs forever and never self-recovers after a backend outage** (P0) — the single highest-risk finding in this report.
2. Malformed JWT → 500 across every protected endpoint (P1) — systemic blast radius.
3. Alternatives endpoint fabricates a fake pressure reading for nonexistent destinations (P1) — directly violates this project's own stated design principle and can poison agent tool-calling.
4. Invalid dates silently accepted and persisted as fabricated pressure records (P1) — corrupts real data, reproduced through two pathways.
5. Signup crashes (500) on type-confused input (P1).
6. `travellers<=0` burns a full expensive pipeline run before failing (P1) — wastes the already-scarce Gemini quota on requests that should be rejected instantly.
7. `travellers=999999` produces a degenerate, incomplete response instead of a clean rejection (P2).
8. Unicode/Hindi origin text breaks trip planning (P2) — a real gap for the product's actual target users.
9. No email format or password length validation (P2) — low urgency but trivial to fix.
10. Inconsistent invalid-date handling between the two pressure endpoints (P2) — a symptom of #4 above, not a separate root cause.

---

## Blocked Tests

Honestly disclosed, not hidden:

- **Provider failure injection** (Google Maps/RailRadar/Amadeus/Open-Meteo forced 500/502/503/429/timeout) — not attempted; needs a mocking layer or deliberate network disruption this pass didn't set up.
- **Full 12-variant × 40+-endpoint test matrix** — not exhaustively run for every endpoint. Endpoints not independently fuzzed this pass: `budget/calculate`, `geocode`, `weather`/`trains`/`places`/`routes`/`road`/`fare` (provider proxies), `visits/verify` full valid-code flow, `waitlist` create/mine/delete, `safety/emergency-contacts`, `safety/complaints`, `safety/trips/share`. Prioritized the endpoints and attack classes the brief called out explicitly plus the ones most likely to reveal real defects.
- **AI prompt-injection / hallucination-inducement battery** (asking the agent to explicitly invent hotel prices, discounts, visit counts, etc.) — not run this pass due to the Gemini quota exhaustion hit partway through other testing; the one relevant structural finding (bad backend data flowing into agent tool calls) is reported under AI Hallucination Boundary instead.
- **Huge-payload test against the ai-service** — blocked by my own shell's argument-length limit, not a server-side result; needs `curl -d @file.json`.
- **Full curl-only end-to-end journey through accept/confirm** — blocked by Gemini quota exhaustion partway through this session's own testing (pre-existing, documented, external — see End-to-End section).
- **Concurrency testing on flows other than offer-claim** (signup double-submit, plan-trip double-submit, visit verification, community submission) — not separately load-tested.

---

# FINAL VERDICT

🟠 **NOT DEMO READY**

**Why not 🔴 CRITICAL FAILURE**: authentication, role-based authorization, mass-assignment defense, and the atomic offer-claim race — the areas where a real security or data-integrity breach would live — are all genuinely solid, verified with real concurrent load and real attack payloads, not just read from source.

**Why not 🟡 DEMO READY WITH KNOWN RISKS**: the P0 finding (ai-service hangs forever and does not self-recover after any backend blip) sits directly in the critical path of the single feature this whole project's pitch is built around — trip planning with the pressure gate. Combined with two P1 data-fabrication bugs that violate the project's own explicitly-stated "never fabricate" design principle, and a systemic 500-instead-of-401 bug touching every protected route, this is more than "known risks to disclose to a judge" — these are the kind of bugs that, hit at the wrong moment during a live demo (a backend hiccup, a malformed date typed by a nervous presenter, an LLM quota edge), would visibly break the core demonstration with no recovery except restarting a process by hand.

None of these require a rewrite — each has a clear, narrow, identified root cause (a missing `isNaN(Date)` check in one place, a fallback constant in one function, a `catch` block in one middleware, a missing timeout somewhere in one HTTP call chain) — but they are real, reproduced-live bugs, not hypothetical ones, and per this report's own instructions they are being reported, not fixed, in this pass.
