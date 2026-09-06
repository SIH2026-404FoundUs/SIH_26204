# Tourism Platform — MVP Schema, Execution Order & Work Split

SIH PS 26204 · Scope locked: Telangana + Himachal Pradesh, ~35–40 seed destinations

**How to read this document:** This is ownership and dependency order, not a timeline. Every collection has one producer before it has consumers — nothing here is built against an empty table. Schema fields marked "was missing" were absent in earlier drafts and are fixed here.

---

## 1. Schema (Final)

**Naming contract:** `destId` everywhere in this schema refers to the same canonical value: the `_id` slug on the DESTINATIONS collection (e.g. `"shimla"`, `"tirthan-valley"`), authored by Ananya. Never substitute a Google Place ID or a display name as this key — every collection below joins on this exact string.

### DESTINATIONS

```
_id: string (slug)                    displayName, state, location{lat,lng}
attrs: {snow,trek,riverside,heritage,nightlife,food,wildlife,spiritual}  0..1 each
nearestRailhead, railheadDistanceKm, railSignalConfidence (0..1, rubric-driven)
roadAccess{operators,corridor,boardingPoint}, nearestAirport
capacityPrior (0..1, static)
baseline{railWL, roadSeatsAvail, hotelMedianINR}
trackingTier: "tracked" | "referenced"    // referenced = Places-only, never scored
googlePlaceId, seededAt
```

### DESTINATION_PRESSURE

```
destId FK, date
score, components{access,stay,calendar,weather,capacity} (each: value,weight,source)
dateVaryingSubtotal, staticSubtotal
dropped[], degraded[], lowConfidence
computedAt
UNIQUE(destId, date)
```

### BUSINESSES

```
_id, destId FK, name, type: homestay|guesthouse|guide|driver|cook
ownerPhone UK (never exposed), languages[], capacity
priceRangeINR{min,max}, amenities[], meals[], nearestLandmark, photos[]
staff_skills[], staff_serviceAreaDestIds[]
onboardedVia, onboardingState, lastWhatsAppMessageId (idempotency)
rawTranscript, transcriptLang
verificationTier: self-declared|visit-verified|registered
registrationNumber, registrationStatus, visitCount
povSecret (select:false)
```

### BUSINESS_AVAILABILITY

**Fixed:** earlier drafts had `{date, isOpen, discountPct}` with no unit count. Without units, vacancy matching and the capacity gap cannot be computed at all.

```
businessId FK, date, resourceType: room|table|slot|seat
units{total,available}, pricePerNight, discountPct (<=40), isOpen
source: "business_declared", updatedAt
UNIQUE(businessId, date, resourceType)
```

### DESTINATION_DEMAND

Aggregated from trip intent — this is the demand side of the capacity gap.

```
destId, date, travellers, estimatedRooms
generatedFrom: "trip_planning", updatedAt
```

### TRIPS

```
_id, userId FK, origin, requestedDestId FK, redirectedToDestId FK
requestedDates, finalDates, travellers, budgetINR, interests{}
selectedHotel, stops[], itinerary, transport, costBreakdown
redistribution{pressureBefore, pressureAfter, savingINR, kind: place|date|none}
alternativesOffered: bool         // was missing — needed for acceptance rate
shareToken UK sparse              // was missing — needed for shareable trip record
state: draft|planned|confirmed|completed|cancelled
```

### VISITS

```
_id, userId FK, businessId FK, destId FK, originalDestId FK
method: "rotating-code", codeStep
status: verified|rejected, verifiedAt
UNIQUE(userId, businessId, codeStep)   // was missing — this IS the anti-replay
```

**Removed:** The Tourism Credits mechanism and its tamper-evident hash-chained ledger have both been cut — one less thing to explain to judges. Proof-of-Visit exists purely to verify that a visit happened and update `verificationTier`; it does not mint anything, so there is no ledger to append to.

### OFFERS (new) / WAITLISTS (trimmed)

**Fixed:** the claim guard previously lived on the waitlist row, so every notified user's own document update succeeded — no contention, no race protection. It now lives on the single offer everyone competes for.

```
OFFERS
  _id, businessId FK, destId FK, date, discountPct
  status: open|claimed|expired, claimedBy, expiresAt (TTL)

WAITLISTS
  _id, userId FK, businessId FK, destId FK, window{from,to}
  criteria{maxPriceINR,travellers}, state: waiting|fulfilled|cancelled
  lastNotifiedAt
```

### Remaining collections

```
COMMUNITY_SUBMISSIONS
  _id, submittedBy FK, name, location, description, photos[]
  aiEnrichment{category,tags,summary}, status: queued|approved|rejected
  provenance, reviewedBy, reviewedAt

FEEDBACK
  _id, userId FK, businessId FK, text, lang
  aiThemes[{theme,sentiment,mentions,evidenceIdx[]}], aiActions[]
  summarisedAt

ALERTS
  _id, destId FK, kind: weather|road|policy|restriction
  body, sourceUrl (required), sourceName (required), validFrom, validTo, fetchedAt

COMPLAINTS
  _id, userId FK, destId/businessId, category, text, photos[], createdAt

EMERGENCY_CONTACTS
  district, police, ambulance, disasterHelpline

USERS
  _id, email UK, passwordHash, role: traveller|operator|authority, phone
  preferences{interests{}, budgetBand, languages[]}
  -- preferences.diet DELETED — feature removed

AUDIT_LOGS
  _id, actor, action, target, reasonCode, meta, at
```

**Removed for good:** blockchain ledger, tamper-evident hash-chained ledger, Tourism Credits, crime-based safety scoring, hotels-review-tourists, dietary recommendations. If any of these reappear in a document later, they are wrong.

---

## 2. Google Places vs the Seed

Both are used, for different jobs. Places is not removed.

- **Google Places — live, universal, no seed required.** Used for "restaurants near this hotel" or "cafes in Manali" — anywhere in India, any place, at query time. Stays wired in exactly as planned.
- **The seed — small, hand-authored, only for the 35–40 tracked destinations.** Places has no opinion on tourism-specific judgments: how much snow-and-trek character a place has, whether its railhead actually serves it, what "crowded" looks like historically for it. These are not geographic facts — they are the platform's own judgments and must be authored.

```
Any place, anywhere       -> always Google Places, live, no seed needed
                              (restaurants, hotels, attractions, map search)

Tracked destinations      -> Places gives geography (name, lat/lng)
  (35-40 rows)                Hand-added: attrs, railSignalConfidence,
                              capacityPrior, baseline
                              -> only these can be pressure-scored
                              -> only these can be substitution candidates
```

A "referenced" destination (trackingTier) is pure Places data, shown normally, but never scored or offered as a swap alternative — there is no basis to score it. A "tracked" destination is one of the seeded rows.

### Why two states, and why not Hyderabad + Telangana as two states

Hyderabad is Telangana's capital, not a second state. Locked scope is Telangana + Himachal Pradesh: Hyderabad → Shimla is a real rail corridor with real waitlist behaviour, Kalka genuinely serves Shimla, and Himachal supplies the crowded-vs-quiet contrast (Manali/Shimla against Jibhi/Tirthan) the substitution engine depends on. Telangana alone has no destination to redirect away from.

- Seed size: ~35–40 destinations total (~20 Himachal, ~15 Telangana). Below ~35 the similarity filter starts returning empty results too often — the d* calibration targets the median destination matching 5–15% of the corpus.

---

## 3. Execution Order

Dependency order, not a schedule. Nothing right of an arrow is built before the left. A feature starts only once the collection it reads from has real rows — either seeded (supply side) or produced by an earlier mechanism (demand side).

```
STAGE 0  Seed data (35-40 destinations, 30 businesses+availability,
         30-day backfilled pressure history, calendar table, fare table)
              |
              v
STAGE 1  Provider layer  ->  Pressure engine  ->  Back-test script
              |                    |
              |                    v
              |             Substitution engine  ->  Calibration script
              |                    |
              v                    v
STAGE 2  ADK agent + tools   Swap card + Heatmap UI
              |                    |
              +---------+----------+
                        v
STAGE 3  Trip planner (budget, map, itinerary)
                        |
                        v
STAGE 4  Voice onboarding  -->  writes real businesses + availability
                        |       (with discountPct -- this is what makes
                        |        the swap card an actual redirect,
                        |        not a price comparison)
                        v
STAGE 5  Proof-of-Visit  -->  unblocks:
                        |                   - Community Discovery
                        |                     (needs verifiedVisitCount >= 1)
                        |                   - Digital Passport visit counts
                        |                   - Business Growth ranking signal
                        v
STAGE 6  Offers + atomic claim (SmartWaitlist)
                        |
                        v
STAGE 7  Dashboard, Feedback Intelligence, Alerts, Staff Marketplace,
         Multilingual -- all read data Stages 0-6 already produced
```

**Rule:** Seeding a starting state (destinations, businesses, pressure history) is normal. Seeding the output of a mechanism you did not build (fake visitCount, fake feedback text) is fabrication, not a shortcut — skip it. See Section 5.

---

## 4. Work Split

Ownership only. Every task has exactly one named owner. If a task is not listed here, it does not exist yet — raise it rather than assuming someone has it.

**Everyone** — *Stage 0*
- Seed data assist — split rows with Ananya where useful, cross-check a sample before it is declared done.

**Ananya** — *Seed Data*
- All 35–40 destinations: Places geography + hand-authored attrs, railSignalConfidence, roadAccess, capacityPrior, baseline.
- 30 businesses with availability (units, price, discount).
- 30-day backfilled pressure history, calendar table, fare table.
- **Blocks every other stage** — cross-check a sample of rows by hand before declaring done.

**Sathvik** — *Pressure Engine*
- Five collectors, access blend, per-destination normalisation, drop-and-renormalise.
- Degraded-road rule: reclassify access as static when road falls back to frequency-only.
- Nightly precompute job into destination_pressure.
- Back-test script — Spearman rank correlation against Ministry footfall series.
- **Owns this and nothing else** — the deepest single subsystem, and everything downstream reads from it.

**Nishith** — *Provider Layer + Agent*
- Adapters: Google Maps, RailRadar, road transport, Amadeus, Open-Meteo — uniform envelope, caching rules, fallback behaviour.
- Local fare estimator.
- ADK agent + Qwen3 + all tools, strict JSON output schema, planner sequence.
- Trip planning core: transport/hotel/place result assembly, route data, itinerary structure.

**Madhuri** — *Substitution + Demo UI + Map + Dashboard*
- Z-scoring, weighted distance, three filters (similarity, reachability, relief), date substitution.
- Calibration script — 120-ish x 120-ish histogram, d*, peak-date survival counts.
- **SwapCard and PressureHeatmap** — the components that carry the demo.
- Map: Places-backed stop picker, route polyline, layer toggles.
- Dashboard aggregations: pressure map, capacity gap, redistribution impact, acceptance rate.

**Bharani** — *Voice Onboarding + Incentive + Budget*
- Full WhatsApp pipeline end to end — not a simulation. The second demo beat.
- Staff/guide branch on the same pipeline.
- Declared availability with discountPct, eligibleForDiscount(), vacancy matching.
- Budget assembly across transport, stay, food, activities, local legs — every estimate labelled.

**Pranay** — *Trust Vertical + Remaining Features*
- Proof-of-Visit: rotating code, mutual attestation, anti-replay, velocity check.
- Offers collection with the atomic claim fix.
- Then, in this order: Community Discovery, Feedback Intelligence, Alerts/Safety, Business Growth ranking, Multilingual service layer.

---

## 5. Two Things That Cannot Be Seeded

**Feedback.** Seed the businesses, not the reviews — seeded review text means the AI summarises your own writing. Get 10–15 real submissions from people outside the team before demo day so theme extraction runs on real text.

**Verified visits.** Do not hardcode visitCount. Build Proof-of-Visit, then run real verifications against the seeded businesses. A true small number survives a judge's question; a fabricated large one does not.

---

## Never Cut

Swap card · WhatsApp voice round-trip · Proof-of-Visit · back-test figure

*Tourism Platform — MVP Schema, Execution Order & Work Split — SIH PS 26204*
