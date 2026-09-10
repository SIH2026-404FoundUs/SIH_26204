# Slide 3 — TECHNICAL APPROACH: paste-ready content

Every formula below is transcribed from the working tree. Nothing here is aspirational.
Source files are cited so any claim can be opened live in front of a judge.

---

## Part 1 — Slide 3 layout

One slide, four blocks. Suggested proportions: architecture strip across the top (25%),
pressure engine hero box on the left (40%), algorithm column on the right (35%).

```
┌──────────────────────────────────────────────────────────────────────┐
│  A.  ARCHITECTURE STRIP  (3 services, left → right, with the gate)   │
├───────────────────────────────┬──────────────────────────────────────┤
│  B.  PRESSURE ENGINE          │  C.  ALGORITHM STACK                 │
│      the hero — formula,      │      substitution · waitlist ·       │
│      weights, drop rule       │      proof-of-visit · itinerary      │
├───────────────────────────────┴──────────────────────────────────────┤
│  D.  RELIABILITY STRIP  (timeouts, envelope, idempotency)            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Block A — Architecture strip

**Header:** `Three services · one deterministic gate`

```
React 19 / Vite SPA ──► Express 5 API ──► MongoDB Atlas
   (Vercel)              (Render)          19 collections
        │                    ▲
        └──► FastAPI AI ─────┘   provider adapters ──► Google Places · Routes ·
             (Render)             {ok, data, meta}      Open-Meteo · RailRadar
```

Three callouts to print under the strip:

- **Gate in code, not in a prompt** — `PRESSURE_GATE = 0.60` is a Python `if`, not an
  instruction to a model. An agent can reason its way out of offering alternatives; a
  conditional cannot.
- **Two credentials, never mixed** — forwarded HttpOnly cookie proves *which traveller*;
  `X-Internal-Service-Token` (compared with `timingSafeEqual`) proves *which service*.
- **Every provider edge returns `{ok, data, meta}`** carrying `source`, `confidence`,
  `estimate`.

---

## Block B — Pressure Engine (the hero)

**Header:** `Destination Pressure Index — 5 signals, locked weights, drop-and-renormalise`

### The formula

```
score = Σ  vᵢ · ( wᵢ / Σ w_present )         vᵢ ∈ [0,1]
```

| Signal | w | Varies by date |
|---|---:|---|
| `access` | **0.45** | yes* |
| `stay` | **0.25** | yes |
| `calendar` | **0.10** | yes |
| `weather` | **0.10** | yes |
| `capacity` | **0.10** | no (static by definition) |

### Component normalisers — all clamped to [0,1]

```
access   = c · rail + (1 − c) · road
rail     = clamp01(  mean(top-3 arriving waitlist depth) / (2 × baseline.railWL)  )
road     = clamp01(  (1 − freeSeats/totalSeats) / baseRatio  )

stay     = 0.5 · unavailFrac + 0.5 · clamp01( medianPriceINR / (1.5 × baseline.hotelMedianINR) )

calendar = seeded festival / weekend impact ∈ [0,1]

weather  = tempScore × rainScore
           tempScore = 1 inside [15, 28]°C, falling linearly to 0 at ±7°C outside the band
           rainScore = 1 if precipProb < 20%, else clamp01( 1 − (precipProb − 20) / 50 )

capacity = clamp01( capacityPrior )
```

Source: `backend/src/services/pressure/engine.js`

### The rule that makes it defensible

```
A signal that cannot be retrieved is DROPPED from the sum
and the surviving weights are renormalised over Σ w_present.
It is never defaulted to 0.
```

Worked example — Open-Meteo unreachable:

| | access | stay | calendar | weather | capacity |
|---|---:|---:|---:|---:|---:|
| nominal | 0.45 | 0.25 | 0.10 | 0.10 | 0.10 |
| weather dropped, renormalised over 0.90 | **0.500** | **0.278** | **0.111** | — | **0.111** |

Consequences encoded in the stored row:

- `Σ w_present = 0` → `score = null`, **not** `0`
- `lowConfidence = true` when dropped weight > **0.40**
- `formulaVersion = 2` — a row computed under older weights is stale however recent it is
- **Degraded-road rule:** the road provider returns timetable frequency, not seats, so
  `access` moves from the date-varying bucket to the static bucket and the row is marked
  `degraded: ["road"]` rather than presenting a frequency proxy as live occupancy

> One-liner for the slide: *"A defaulted zero would read as 'perfect weather' and quietly
> lower every score in the country. We change the denominator, not the numerator."*

### Forward-looking analytics (§8)

```
emergingHotspot   slope = least-squares fit over the last 14 daily scores
                  isEmerging = slope > 0.02  ∧  current < 0.5  ∧  capacityPrior > 0.5

capacityGap       normalizedCapacityGap = pressure − clamp01( bookableSupply / expectedSupply )

validation        Spearman rank correlation (ties → averaged ranks)
```

Source: `engine.js`, `services/pressure/stats.js` — both hand-rolled, no stats dependency.

---

## Block C — Algorithm stack

### C1. Destination substitution — 8-dimensional attribute space

```
attributes  snow · trek · riverside · heritage · nightlife · food · wildlife · spiritual

z-score standardisation across the whole catalogue

personalised weight     wₐ = 0.6 · ( interestₐ / Σ interest ) + 0.4 · (1/8)
                        (60% user signal, 40% uniform prior — never fully collapses
                         onto one attribute)

distance                d(A,B) = √( Σₐ wₐ · (z_Aₐ − z_Bₐ)² )      weighted Euclidean

8×8 Pearson correlation matrix computed across all tracked destinations

composite score         S = (1 − d/d*) · (1 − pressure_candidate) · normalizedSaving
                        normalizedSaving = clamp01( saving / max saving in pool )
                        saving = budget(requested) − budget(candidate)

→ top 3 returned, ranked
```

Source: `backend/src/services/substitution/{distance,ranking,standardize,filters}.js`

**Why the product form matters:** any factor going to zero kills the candidate. A
destination that is cheap but equally crowded scores 0 on the pressure term and is never
offered. Redistribution cannot be bought with a discount alone.

### C2. SmartWaitlist matching

```
FILTER   destId match
       ∧ state = "waiting"
       ∧ window.from ≤ offerDate ≤ window.to
       ∧ criteria.maxPriceINR ≥ effectivePrice
       ∧ notifications in last 24h < 3
       ∧ no decline for this destId in the last 7 days

RANK     rankScore = headroom × recency
         headroom  = max(1, maxPriceINR − effectivePrice)
         recency   = 1000 / (ageMinutes + 1)

CAP      top 20 recipients
CLAIM    findOneAndUpdate — atomic, two travellers cannot claim one seat
```

Source: `backend/src/services/waitlist/matchingEngine.js`

### C3. Proof-of-Visit — rotating HMAC

```
step = ⌊ unixSeconds / 90 ⌋
code = ( HMAC-SHA256( povSecret, "businessId:step" )[0..3] as uint32 BE ) mod 10⁶
       zero-padded to 6 digits

verification accepts step−1, step, step+1  → absorbs device clock skew
```

Source: `backend/src/services/pov/povCrypto.js`

**Why:** a static QR can be screenshotted and shared from anywhere. A 90-second rotating
code cannot, and it needs no network on the traveller's side beyond the window.

### C4. Itinerary + costing — deliberately deterministic

```
day planning     stops sliced into as-even-as-possible day groups,
                 each day bracketed by the stay as start and end anchor
                 slots  morning 08:00–11:00 · afternoon 12:00–15:00 · evening 16:00–19:00
                 default dwell 60 min per stop

route ordering   delegated to Google Routes computeRoutes — NOT re-implemented here

local transport  Σ haversine over each day's stop-to-stop loop, at 25 km/h
                 → duration → fare (distance + time components)
                 explicitly NOT the intercity distance: city auto/cab rates
                 applied to a 537 km leg would be wildly wrong

trip transport   route distance × ₹9/km × 2 (round trip)
nights = days − 1     rooms = ⌈travellers / 2⌉     dates inclusive
```

Source: `ai-service/app/tools/itinerary.py`, `ai-service/app/main.py`

---

## Block D — Reliability strip

Print as a single line of chips across the bottom:

`180 s run ceiling` · `5 s per backend call` · `Connection: close` ·
`asyncio.gather 7-way fan-out, return_exceptions` · `wamid idempotency` ·
`atomic offer claim` · `timingSafeEqual` · `TTL caches: 10 min search / 24 h photo, 32 MB`

Two worth a sentence if space allows:

- **`Connection: close`** — a pooled keep-alive socket to a backend that died abruptly hung
  past the 5 s timeout at a layer `timeout=` does not reach. Fixed after a real incident.
- **180 s ceiling** — bounded parts still compose into an unbounded whole, so the whole run
  gets its own hard deadline on top of the per-call timeouts.

---

## Part 2 — Appendix slides (after slide 6, for Q&A)

SIH judges routinely ask for backup. Two annexure slides:

### Appendix A — "Show me the pressure engine"

Put the full worked example on it: one real destination, one date, all five component
values, the weights, the arithmetic, the final score, and the same calculation with one
provider killed. Being able to walk the arithmetic live is worth more than any diagram.

### Appendix B — "What happens when a provider fails"

A three-row table:

| Failure | Naive system | Sahyatri |
|---|---|---|
| Places quota exhausted | shows "no hotels found" | `dataIssues: "the daily Google Places quota is exhausted"` |
| Open-Meteo down | weather scored 0 → pressure drops | signal dropped, weights renormalised, `lowConfidence` |
| No seat data for a corridor | invents occupancy | `degraded: ["road"]`, access becomes static, said so in the row |

---

## Part 3 — The 40-second spoken script for slide 3

> "The engine is five signals — rail waitlist depth, stay scarcity, festival calendar,
> weather pull, and static capacity — blended at locked weights, 0.45 on access because
> access is what actually saturates first.
>
> The part we'd point you at is what happens when a signal is missing. Most systems
> default it to zero. A zero on weather reads as *perfect weather*, which quietly lowers
> the score and sends more people to a place that's already full. We drop the signal and
> renormalise the surviving weights, and the row records what was dropped and whether
> confidence is low. If everything fails, the score is null — never zero.
>
> That gate at 0.60 is a Python conditional, not a prompt. An agent can be talked out of
> offering an alternative. An `if` cannot. Redistribution is the entire product, so it
> can't be something the model decides to do."

---

## Part 4 — Q&A ammunition

| Likely question | Answer |
|---|---|
| "Is this actually AI?" | "The index is deterministic and auditable on purpose — you can recompute any score by hand from the stored row. The LLM does language: travel tips, the trip Q&A, and Telugu/Hindi voice onboarding. We chose not to put a model where a formula is verifiable." |
| "Where's the ML?" | "Not claimed. We have 30 days of backfilled history and a least-squares trend already running; a learned residual over the deterministic baseline is the next step, and it needs real observed footfall we don't yet have. We'd rather ship a formula we can defend than a model we can't validate." |
| "Why 0.45 on access?" | "Access saturates before accommodation does — trains and road capacity are the binding constraint on a hill destination. The weights are locked and versioned; `formulaVersion` invalidates every stored row if they ever change, so history can't silently mix formulas." |
| "How do you know the score is right?" | "We don't claim national accuracy. We have a Spearman rank-correlation harness and a back-test script against seeded history. Being honest about that is why every row carries `lowConfidence` and `dropped`." |
| "How is this different from Google's popular times?" | "Popular times is retrospective and observational. This is forward-looking, per-date, and — critically — it *acts*: it offers a specific alternative destination or date with a quantified rupee delta at the moment of decision. And no OTA is incentivised to send you somewhere cheaper and emptier." |
| "What breaks at scale?" | "Caches and the chat rate limiter are in-process today, so multi-replica needs a shared cache. That's the one identified change; the request path itself is stateless." |

---

## Part 5 — Wording corrections to carry into slides 2 and 4

| Slide | Do not say | Say instead |
|---|---|---|
| 2 | "AI Tourism Pressure Index" | "Destination Pressure Index — 5-signal weighted" |
| 2 | "Swap Cards + **AI Itinerary**" | "Swap Cards + day-planner with Routes API optimisation" |
| 2 | "0–100 crowding score" | "0–1 score, action gate at 0.60" |
| 2 | "30-day forecasts" | "forward window to 45 days; true forecast to ~16 days, climate normal beyond, labelled as such" |
| 4 | "Next.js PWA" | "React 19 / Vite SPA" |
| 4 | "Redis — ready for national" | "stateless request path; shared cache identified for multi-replica" |
| 2 | "offline support" | "no app install, no forms — any phone with WhatsApp" |
| 6 | Solidity reference | delete — no blockchain code exists |
