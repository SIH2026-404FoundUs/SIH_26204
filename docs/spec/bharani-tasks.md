# Tourism Platform — Bharani: Voice Onboarding + Incentive + Budget

SIH PS 26204 · Real WhatsApp pipeline — the second demo beat

**Scope:** The voice onboarding pipeline is the second demo beat, alongside the swap card — build the real WhatsApp integration, not the simulation fallback. The incentive engine is what makes the swap card an actual redirect rather than a price comparison. Budget is the smaller, more mechanical third piece.

---

## 1. Voice Onboarding — Real WhatsApp, Not a Simulation

A homestay owner sends a voice note in Hindi describing their property; the platform turns it into a live, discoverable listing with declared availability and an enquiry/contact handoff. This should run on stage, live, on a real phone — it is one of the two moments that make the demo memorable rather than another AI-itinerary pitch.

**Say "discoverable," not "bookable":** The platform does not take payment or hold hotel inventory (see Pranay's merchant-of-record note). A judge will ask "can I actually book this room through your platform?" — the correct answer is: for the MVP, we surface participating businesses and their declared availability, then hand off the booking to the operator directly. Do not describe the onboarding output as a "bookable listing" anywhere — in code comments, in the demo script, or to the team — since that overclaims a checkout flow this build does not have.

### 1.1 Conversation state machine

```
AWAITING_CONSENT   -> first inbound message returns consent text; reply required

AWAITING_VOICE     -> operator sends a voice note describing the property

TRANSCRIBING       -> faster-whisper, language auto-detected

EXTRACTING         -> Qwen3 under the strict JSON schema (Section 1.3)

AWAITING_PHOTOS    -> 3-5 images -> Cloudinary

FOLLOWUP           -> one question per null required field, in the operator's language,
                      returned as a voice note; loop until required fields are non-null

AWAITING_DATES     -> "which dates are open, and what discount?" -> writes availability

DRAFT_CONFIRM      -> read the listing back; operator replies YES or a correction

LIVE               -> written to businesses, verificationTier: "self-declared"
```

State is stored on the business draft document, keyed by `lastWhatsAppMessageId` for idempotency — Meta retries webhooks, and a replayed message must not advance state twice.

### 1.2 Getting the audio — the part people miss

WhatsApp media arrives as an ID, not a file. Two calls are required, and the URL from the first expires in minutes.

```
GET https://graph.facebook.com/v21.0/{media_id}        -> returns a short-lived URL

GET <that url>  with Authorization: Bearer WHATSAPP_TOKEN  -> the actual bytes

// the second call needs the auth header — easy to miss, breaks silently otherwise
```

- **Transcription: faster-whisper distil-large-v3. Do not use large-v3 on CPU.** On CPU with int8 it runs at roughly 1–3× realtime, turning a 60-second voice note into up to 90 seconds of silence during the demo beat you cannot afford to lose. Use a GPU if at all available.
- Benchmark AI4Bharat IndicWhisper against faster-whisper on a 15-sample set across at least 4 languages before demo day, and use whichever wins on word error rate. Hindi performs acceptably out of the box; Marathi and Bengali degrade noticeably. Regional varieties (Kumaoni, Bhojpuri) collapse towards standard Hindi — know this failure mode before the stage, not on it.
- Store the transcript, discard the raw audio after extraction — audio is personal data and there is no reason to retain it.

### 1.3 Extraction schema — strict

```json
{
  "name":            string | null,
  "type":            "homestay"|"guesthouse"|"guide"|"driver"|"cook" | null,
  "capacity":        integer | null,
  "priceRangeINR":   { "min": integer, "max": integer } | null,
  "amenities":       string[],
  "meals":           string[],
  "nearestLandmark": string | null,
  "languages":       string[],
  "seasonalNotes":   string | null
}
```

**Prompt rule:** return null for anything not explicitly stated in the transcript.

**Post-check:** every non-null string field must appear, in substance, in the transcript before the listing is allowed to go LIVE — an invented amenity is a correctness bug, not a stylistic nicety.

**Required for LIVE:** name, type, capacity, priceRangeINR, nearestLandmark.

### 1.4 Guides, drivers and cooks — same pipeline

Same webhook, same state machine, a different schema branch keyed on `type`. Staff listings write to `businesses` and mirror into `staff_profiles` with skills, languages, availability and `serviceAreaDestIds`. This is the Local Staff & Guide Marketplace feature at near-zero marginal cost — do not build a second pipeline for it.

### 1.5 Registration assist

Collect the fields a state homestay registration application requires inside the same voice conversation: owner identity, property address, rooms let, facilities, whether the owner resides on premises. Generate a pre-filled PDF in the state's prescribed format with a spoken summary of what remains.

- **The platform assists towards registration. It does not certify, approve, or submit on the operator's behalf,** and the UI must never imply otherwise. Nothing generated here is transmitted to any authority by the platform.

### 1.6 Demo risk — keep an internal fallback

The real WhatsApp pipeline has a long dependency chain: Meta webhook, media download, Whisper, Qwen3, MongoDB. If any external link fails mid-demo, the whole beat fails with it.

- **Real WhatsApp stays the primary, on-stage path.** But also wire an internal-only upload endpoint (a raw voice file, not WhatsApp) that feeds the exact same Whisper → Qwen3 → MongoDB pipeline downstream of the webhook. Never present this as the feature — it exists purely so that if WhatsApp fails in the room, the same pipeline can still be shown working from a pre-recorded file.

---

## 2. Incentive Engine — What Makes the Swap Real

**Why this is not optional:** Without a real reason to switch, the swap card is just a price comparison — which any OTA already does. The discount, funded by the operator from a room that would otherwise sit empty, is what converts "here is a cheaper place" into an actual redirect. This closes the loop.

### 2.1 Declared availability, not predicted occupancy

A homestay onboarded sixty seconds ago has no booking history — no occupancy forecast can exist for it. Triggering discounts on a forecast would permanently exclude exactly the new supply this platform exists to formalise. The trigger is therefore what the operator explicitly declared, captured in the AWAITING_DATES onboarding step.

```
eligibleForDiscount(business, destId, date) =
      business_availability.find({businessId, date, isOpen: true})
  &&  pressure(destId, date).score < 0.30        // Sathvik's endpoint

discountPct    = that availability row's discountPct, capped at 40
effectivePrice = priceRangeINR.min * (1 - discountPct / 100)
```

- The operator sets and changes open dates and discount by one-tap WhatsApp reply. The platform never applies a discount the operator did not declare.

### 2.2 BUSINESS_AVAILABILITY schema

```
{ businessId, date, resourceType: "room"|"table"|"slot"|"seat",
  units: { total, available },              // required for vacancy matching, not optional
  pricePerNight, discountPct (<=40), isOpen,
  source: "business_declared", updatedAt }

UNIQUE(businessId, date, resourceType)
```

- **The unit count is what makes vacancy matching and the capacity gap computable.** An earlier draft of the schema had only `{date, isOpen, discountPct}` with no room count — that version cannot answer "how many rooms are actually available," which is the whole point of the feature.

### 2.3 Vacancy matching + destination demand

This is Feature 9 (Digital Passport & Vacancy Matching). Demand comes from aggregating your own platform's trip intent — not from pretending you have real-time inventory of every hotel in India.

```
// destination_demand — written nightly from trips
{ destId, date, travellers, estimatedRooms, generatedFrom: "trip_planning", updatedAt }

// name this roomDemandGap, NOT capacityGap — Sathvik's pressure engine also has a
// field called capacityGap and it is a different, normalised 0..1 quantity. Two
// different formulas sharing one name is how someone reads the wrong number on
// the dashboard three days before the demo.
roomDemandGap = estimatedRooms - sum(business_availability.units.available for that destId/date)

// Individual match, when a traveller searches directly:
query business_availability where destId, date range open, price <= budget
rank by (price, distance, verificationTier, availability)
```

**Scope boundary:** This maintains business-declared availability, not real hotel inventory ownership. Do not claim real-time inventory of every hotel — that requires PMS integrations this MVP does not have.

---

## 3. Budget — Smart Budget & Expense Planner

Deterministic, not model-generated. Qwen3 never invents a price — it calls tools, JavaScript adds the numbers.

```
foodCost = mealRate * mealsPerDay * travellers * days     // mealRates: budget/standard/premium
hotelCost = pricePerNight * nights * rooms                // after any applied discount
localTransport = Nishith's fare estimator, per leg

total = transport + hotelCost + foodCost + activities + localTransport
contingency = total * 0.10                                 // shown as its own line, not absorbed
grandTotal = total + contingency
```

- Every number carries an "Estimated" badge in the UI — these are never live provider prices, and presenting them as such is a correctness claim you cannot back.
- **Over-budget handling:** if `estimatedTotal > userBudget`, show the overage and offer four concrete reduction options — reduce hotel cost, use train instead of flight, remove an activity, or choose a lower-pressure alternative. That last option is a direct hook into Madhuri's swap card.

---

## 4. Interfaces

| You consume from | What you need |
| --- | --- |
| Ananya (seed) | 30 seeded businesses with realistic, varied availability to build and test the incentive engine against before real onboarding data exists |
| Sathvik (pressure) | `pressure(destId, date)` for the `eligibleForDiscount()` gate |
| Nishith (adapters) | Route distance/duration for the fare estimator; Amadeus for hotel baseline pricing |

| You provide to | What they need from you |
| --- | --- |
| Madhuri (swap card) | `discountSourceBusinessId` and `discountPct` on any alternative that has a live discount, so the card can show a real number, not just a saving estimate |
| Nishith (agent) | `search_businesses()` ranking that prioritises onboarded, discounted supply; `calculate_trip_cost()` tool wraps your budget logic |
| Pranay (community/feedback) | `businesses` collection populated with real, non-seed listings once onboarding is live — his features read this too |

---

## 5. Definition of Done

| Check | Passes when |
| --- | --- |
| Onboarding end-to-end | A voice note from a phone not owned by a team member produces a LIVE listing with declared availability, in under 3 minutes, without a team member intervening. |
| Extraction honesty | The post-check catches an invented amenity in a manual test — verify this actually fires, do not just assume the prompt prevents it. |
| Discount gate | A business created 60 seconds ago, with one declared open date, correctly surfaces a discount with zero booking history behind it. |
| Vacancy matching | `roomDemandGap` computes correctly for a destination with known seeded demand and availability — spot-check the arithmetic by hand once. This is a raw room count, not Sathvik's normalised `capacityGap` — do not conflate the two on the dashboard. |
| Budget | Every line item in a sample trip carries the correct estimate label, and the over-budget warning triggers with all four reduction options shown. |

*Tourism Platform — SIH PS 26204 — Individual Work Package*
