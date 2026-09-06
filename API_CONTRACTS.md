# API_CONTRACTS.md

Every HTTP endpoint that crosses a person-to-person boundary. Update your row
whenever your endpoint's request or response shape changes — don't let a
teammate discover a rename at integration time.

| Endpoint | Owner | Request | Response | Errors |
|---|---|---|---|---|
| `GET /api/weather` | Nishith | `?lat, lng, date` | `{ok, data:{maxTemp, precipProb}, meta}` | 400 missing param |
| `GET /api/trains` | Nishith | `?trainNumber, source, destination, journeyDate, classCode, quotaCode` | `{ok, data:{trainNumber, trainName, days:[{date, waitlistDepth, rawStatus, availableSeats?}]}, meta}` | 400 missing param, honest `ok:false` on RailRadar errors (ARP, invalid train, etc) |
| `GET /api/places` | Nishith | `?query, lat, lng, radiusMeters` | `{ok, data:[{placeId, name, lat, lng, rating}], meta}` | 400 missing param |
| `POST /api/routes` | Nishith | `{originLat, originLng, destLat, destLng, mode}` | `{ok, data:{distanceKm, durationMinutes}, meta}` | 400 missing param |
| `GET /api/fare` | Nishith | `?city, mode, distanceKm` | `{ok, data:{mode, distanceKm, fareINR}, meta}` | 400 unknown city/mode |
| `GET /api/road` | Nishith | `?destId` | `{ok, data:{corridor, operators, frequencyPerDay}, meta}` — always `confidence:"low", estimate:true` | 400 missing destId, `ok:false` if destId not in seed |
| `GET /api/geocode` | Nishith | `?address` | `{ok, data:{lat, lng, formattedAddress}, meta}` | `ok:false` if no location found |
| `GET /api/pressure/:destId` | Sathvik | `?date` | `{score (number\|null), components, dateVaryingSubtotal, staticSubtotal, dropped, degraded}` | 404 if destId not tracked |
| `POST /api/alternatives` | Madhuri (route not yet built — Nishith wiring) | `{origin, destId, startDate, endDate, travellers, budgetINR, interests}` | `{requested:{destId,displayName,pressure,breakdown}, places:[...], dates:[...], relaxedRelief}` | TBD |
| `POST /api/visits/verify` | Pranay | `{businessId, code}` | `{visitId, tierAfter}` | 400, 409 |
| `POST /api/availability/:id` | Bharani | `{date, units, ...}` | `{ok: true}` | 400 |

## Naming contract
`destId` everywhere — always the canonical slug from Ananya's seed
(e.g. `"manali"`). Never a Google Place ID, never a display name.