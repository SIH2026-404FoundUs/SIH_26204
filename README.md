```
tourism-platform/
├── package.json                  ← root: npm install/build/start --prefix both
├── API_CONTRACTS.md
│
├── backend/
│   ├── package.json
│   └── src/
│       ├── controllers/
│       │   ├── pressure.controller.js
│       │   ├── alternatives.controller.js
│       │   ├── business.controller.js
│       │   ├── availability.controller.js
│       │   ├── trip.controller.js
│       │   ├── visit.controller.js
│       │   ├── offer.controller.js
│       │   ├── waitlist.controller.js
│       │   ├── community.controller.js
│       │   ├── feedback.controller.js
│       │   ├── alert.controller.js
│       │   └── auth.controller.js
│       │
│       ├── routes/
│       │   ├── pressure.route.js
│       │   ├── alternatives.route.js
│       │   ├── business.route.js
│       │   ├── availability.route.js
│       │   ├── trip.route.js
│       │   ├── visit.route.js
│       │   ├── offer.route.js
│       │   ├── waitlist.route.js
│       │   ├── community.route.js
│       │   ├── feedback.route.js
│       │   ├── alert.route.js
│       │   └── auth.route.js
│       │
│       ├── models/                        ← matches every collection, 1:1
│       │   ├── destination.model.js
│       │   ├── destinationPressure.model.js
│       │   ├── destinationDemand.model.js
│       │   ├── business.model.js
│       │   ├── businessAvailability.model.js
│       │   ├── trip.model.js
│       │   ├── visit.model.js
│       │   ├── offer.model.js
│       │   ├── waitlist.model.js
│       │   ├── communitySubmission.model.js
│       │   ├── feedback.model.js
│       │   ├── alert.model.js
│       │   ├── complaint.model.js
│       │   ├── emergencyContact.model.js
│       │   ├── user.model.js
│       │   └── auditLog.model.js
│       │
│       ├── middleware/
│       │   ├── auth.middleware.js
│       │   ├── validate.middleware.js
│       │   └── rateLimit.middleware.js
│       │
│       ├── lib/                            ← third-party client setup only
│       │   ├── db.js                       ← MongoDB connection
│       │   ├── cloudinary.js
│       │   ├── whatsapp.js                 ← Meta client init
│       │   └── crypto.js                   ← Ed25519/HMAC helpers, if kept
│       │
│       ├── services/                       ← the real logic, one folder per OWNER
│       │   ├── pressure/                   ← Sathvik
│       │   ├── substitution/               ← Madhuri
│       │   ├── incentive/                  ← Bharani
│       │   ├── onboarding/                 ← Bharani
│       │   ├── pov/                        ← Pranay
│       │   ├── waitlist/                   ← Pranay
│       │   ├── community/                  ← Pranay
│       │   ├── feedback/                   ← Pranay
│       │   └── alerts/                     ← Pranay
│       │
│       ├── providers/                      ← Nishith — external API adapters
│       │   ├── googlemaps.provider.js
│       │   ├── railradar.provider.js
│       │   ├── roadtransport.provider.js
│       │   ├── amadeus.provider.js
│       │   └── openmeteo.provider.js
│       │
│       ├── jobs/
│       │   ├── precomputePressure.job.js
│       │   ├── aggregateDemand.job.js
│       │   ├── pollAlerts.job.js
│       │   └── expireOffers.job.js
│       │
│       ├── seeds/                          ← Ananya — plain data, run once
│       │   ├── destinations/
│       │   │   ├── shimla.json
│       │   │   ├── manali.json
│       │   │   └── ... (35-40 files)
│       │   ├── businesses.js
│       │   ├── calendar.js
│       │   └── fares.js
│       │
│       └── server.js
│
├── frontend/
│   ├── package.json
│   └── src/
│       ├── components/
│       │   ├── swap/
│       │   ├── pressure/
│       │   ├── map/
│       │   ├── onboarding/
│       │   ├── business/
│       │   └── common/
│       │
│       ├── pages/                          ← one subfolder per page
│       │   ├── planner/TripPlannerPage.jsx
│       │   ├── discover/DiscoverPage.jsx
│       │   ├── dashboard/DashboardPage.jsx
│       │   └── business/BusinessConsolePage.jsx
│       │
│       ├── store/                          ← singular, matches convention
│       │   ├── useAuthStore.js
│       │   ├── useTripStore.js
│       │   ├── usePressureStore.js
│       │   └── usePreferenceStore.js
│       │
│       ├── lib/
│       │   ├── axios.js
│       │   └── googleMaps.js
│       │
│       ├── App.jsx
│       └── main.jsx
│
├── ai-service/                              ← FastAPI, no equivalent in the reference
│   └── app/
│       ├── main.py
│       ├── agents/
│       ├── tools/
│       └── onboarding/
│
├── scripts/
│   ├── backtest.js
│   └── calibrateDistance.js
│
└── docs/

```