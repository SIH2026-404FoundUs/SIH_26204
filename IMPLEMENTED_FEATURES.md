# Sahyatri — Detailed Implementation Documentation

**Repository:** `SIH_26204`  
**Documentation scope:** Features and infrastructure currently present in the source code  
**Snapshot date:** 9 September 2026

## 1. Product overview

Sahyatri is a tourism and trip-planning platform designed around three connected users:

1. **Travellers** plan trips using pressure-aware recommendations, maps, routes, costs, alerts, and safety tools.
2. **Operators** register tourism businesses, onboard workers, manage waitlists/offers, and verify visits.
3. **Authorities** monitor destination pressure, capacity, demand redistribution, acceptance rates, and community submissions.

The repository is split into three applications:

- `frontend/` — React/Vite web application.
- `backend/` — Express/MongoDB REST API.
- `ai-service/` — FastAPI service containing the AI planner, deterministic planning tools, onboarding transcription/extraction, and travel-brief generation.

The main product idea already implemented is **pressure-aware tourism planning**: before generating a final itinerary, the system checks how crowded the requested destination is. If pressure is high, the traveller is shown alternative destinations or dates and can accept or decline the redistribution suggestion.

## 2. Technology stack

### Frontend

- React 19
- Vite
- React Router
- Zustand for application state
- Axios for API calls
- Tailwind CSS
- Lucide React icons
- Google Maps integration through the Google Maps JavaScript API

### Backend

- Node.js with ES modules
- Express 5
- MongoDB with Mongoose
- JWT authentication
- HTTP-only cookies
- bcrypt password hashing
- Multer for uploads
- Cloudinary integration for media
- Nodemailer support for password recovery
- CORS and rate limiting
- Jest and in-memory MongoDB test support

### AI service

- Python
- FastAPI
- Google ADK
- LiteLLM
- Gemini-compatible model configuration
- Pydantic response/request validation
- Faster-Whisper for voice transcription
- ReportLab for PDF generation
- Requests-based communication with the Express backend

## 3. Implemented frontend experience

### 3.1 Public pages

The public application includes:

- `/` — Sahyatri landing page.
- `/signin` — login screen.
- `/signup` — account creation screen.
- `/forgot-password` — password-reset request screen.
- `/reset-password` — password reset using a token.
- `/explore` — public destination pressure exploration/heatmap.
- `/explore/:destId` — destination-specific pressure detail.
- `/businesses` — public business discovery.
- `/alerts` — public safety advisory view.

The landing page explains what Sahyatri does, the roles supported by the platform, and the pressure-aware planning flow.

### 3.2 Authentication and account management

Implemented authentication behavior includes:

- Traveller/operator/authority signup.
- Login with server-issued JWT cookie.
- Logout and cookie/session cleanup.
- Authentication check on application startup.
- Automatic redirect to the correct role home page after login or refresh:
  - Traveller → `/home`
  - Operator → `/operator`
  - Authority → `/authority`
- Protected routes for authenticated users.
- Role-gated routes for operators and authorities.
- Forgot-password request.
- Reset-password flow.
- Change-password flow for logged-in users.
- Profile updates.
- Password visibility toggle.
- Password strength checklist and password policy helpers.

The frontend does not store the JWT in local storage. It uses `withCredentials` and asks the backend whether the current HTTP-only session is valid.

### 3.3 Traveller trip planner

The main traveller planner is available at `/home`.

The planner accepts:

- Starting location.
- Destination.
- Start date.
- End date.
- Number of travellers.
- Budget in INR.
- Travel interests/preferences.

The frontend sends the request to the AI service and handles both planner outcomes:

#### Normal planning outcome

When pressure is below the configured gate, the planner returns a trip summary directly.

#### Pressure-gated outcome

When the destination pressure score reaches the configured threshold, planning pauses and returns:

- Pressure score.
- Pressure components.
- Requested destination information.
- Alternative destinations.
- Alternative dates.
- Possible budget savings/redistribution information.
- A trip draft identifier.

The traveller can then:

- Accept a destination alternative.
- Accept an alternative date.
- Decline the suggestion and continue with the requested destination.

No final plan is generated after the gate until the traveller submits an explicit decision.

### 3.4 AI-generated trip plan output

The generated trip plan can contain:

- Plain-language trip summary.
- Weather information.
- Route distance and duration.
- Hotel/place recommendations.
- Train availability/status.
- Local transport fare estimation.
- Road-service information.
- Tourism pressure score.
- Pressure component details.
- Alternative destinations or dates.
- Cost breakdown.
- Day-by-day itinerary.
- Relevant businesses.
- Practical travel tips.

The planner validates response structure before displaying it. Invalid or incomplete responses are surfaced as user-facing errors rather than silently rendered as invented data.

### 3.5 Map and route experience

The authenticated map is available at `/map`.

Implemented map functionality includes:

- Full-screen map layout.
- Destination markers.
- Tourist/place markers.
- Business/place categories.
- Route polyline rendering.
- Route details panel.
- Distance and duration display.
- Travel mode selection.
- Map zoom and positioning controls.
- Map layer controls.
- Destination selection from map info windows.
- Pressure heatmap layer.
- Recommendation overlay.
- Stop-picker panel.
- Trip-planner sidebar.
- Trip summary panel.
- AI assistant card.

The frontend contains both standard and premium map/summary components, including richer trip summaries, AI insights, travel brief download, weather advice, and hidden-gem suggestions.

### 3.6 Explore and destination pressure

The Explore experience provides:

- India/destination pressure visualization.
- Date selection for pressure readings.
- Destination-level pressure details.
- Pressure score coloring/badges.
- Heatmap visualization.
- Component-level pressure explanation.
- Loading, error, and empty states.

Pressure data is loaded from the backend map endpoint and rendered from the returned destination rows rather than fabricated in the UI.

### 3.7 Trips

The `/trips` page provides a traveller's saved trips.

Implemented behavior includes:

- Loading trips for the authenticated user.
- Ownership-scoped trip retrieval.
- Loading and error states.
- Display of previously generated/saved plans.

The planner uses the authenticated user's ID when creating or saving a trip so that the trip history is associated with the correct account.

### 3.8 Destination and business discovery

Implemented discovery features include:

- Destination picker grouped by state.
- Human-readable destination labels from destination slugs.
- Fallback slug humanization for new/unlisted destination IDs.
- Destination detail screen.
- Business search.
- Business listing cards.
- Business type/category display.
- Business photos/place photos where available.
- Public destination and safety information.

The frontend currently keeps a destination label/grouping catalogue in `frontend/src/lib/destinations.js` because the backend destination endpoint is not yet a fully queryable destination catalogue for all UI picker needs.

### 3.9 Safety features

The safety area includes:

- Safety advisory display.
- Trip-specific alerts.
- Emergency contacts by destination.
- Shareable trip links.
- Revocable shared-trip links.
- Complaint submission.
- Traveller complaint history.
- Visit verification.

Visit verification supports two sides:

- Operators display a rotating verification code for a registered business.
- Travellers or other permitted users submit the code to verify a visit.

### 3.10 Waitlists and offers

Traveller-facing waitlist/offer functionality includes:

- Joining a business waitlist.
- Viewing personal waitlists.
- Cancelling a waitlist entry.
- Viewing available offers.
- Claiming an offer.
- Receiving offer-related notifications through the application flow.

The backend contains matching logic that filters/ranks waitlist entries against an operator's offer.

### 3.11 Notifications

The frontend includes a notifications page and store for user-facing updates, including offer, waitlist, alert, and workflow-related notifications where returned by the backend.

### 3.12 Shared frontend UI system

Reusable UI elements implemented include:

- Buttons with variants and loading state.
- Cards.
- Badges.
- Alerts.
- Empty states.
- Loading states.
- Modal dialogs.
- Form fields.
- Page headers.
- Destination selectors.
- Consistent authenticated page containers.
- Role and authentication guards.

The frontend includes responsive layouts, icon-based navigation, consistent error handling, and role-aware navigation.

## 4. Operator implementation

### 4.1 Operator routes and pages

Operator pages include:

- `/operator` — operator home/console.
- `/register-business` — register a business.
- `/hire-people` — browse or onboard workers.
- `/operator/waitlist` — manage waitlists and create offers.
- `/visits` — operator visit-verification code view.

### 4.2 Business registration

Operators can submit:

- Business name.
- Business type.
- Destination.
- Capacity.
- Owner phone number.
- Nearest landmark.
- Languages spoken.
- Amenities.
- Meals offered.
- Minimum and maximum price range.

Registered businesses are loaded back into the operator UI and used by other operator workflows.

### 4.3 Worker hiring and onboarding

The worker flow supports:

- Selecting a destination.
- Selecting a worker type/category.
- Browsing onboarded workers.
- Revealing a worker contact through an authenticated backend action.
- Entering a worker phone number.
- Uploading a voice recording describing the worker's skills, role, languages, and experience.
- Sending the onboarding upload to the backend/AI processing flow.

### 4.4 Waitlist and flash offers

Operators can:

- Select one of their businesses.
- View people waiting for availability.
- Create a flash offer.
- Set offer date.
- Set original price.
- Set discount percentage.
- Set offer validity duration.
- Trigger matching/notification behavior for eligible waitlist entries.

### 4.5 Operator visit verification

The operator page displays a live rotating verification code for a selected business. The purpose is to allow a traveller to prove that they visited the business without requiring the operator to manually enter traveller information.

### 4.6 Operator console limitation

The `/operator` console shell exists, but the actual availability/discount/growth-management console is intentionally marked **Coming soon**. The component documents that it requires a declared-availability endpoint and a reliable account-to-business link.

## 5. Authority implementation

The authority dashboard is available at `/authority` and is role protected.

Implemented dashboard sections include:

- Pressure section.
- Capacity-gap table.
- Redistribution impact.
- Acceptance rate.
- Refresh-all-sections action.
- Tabbed dashboard navigation.
- Loading, empty, and error states.

The dashboard can display:

- Destination pressure information.
- Capacity pressure/gaps.
- Number of redirected trips.
- Total budget moved through redirection.
- Average pressure relief.
- Traveller acceptance rate.
- Community-submission review queue.

The dashboard is intended to give authorities visibility into whether pressure-aware planning is actually redistributing tourism demand.

## 6. Community contribution and moderation

The community flow supports:

- Traveller place suggestions.
- Community submission forms.
- Photo uploads.
- Queue retrieval for moderators.
- Authority review actions.
- Approval/rejection workflow.

The same `/community` route branches by authenticated role:

- Travellers see the submission UI.
- Authorities see the moderation/review UI.

Frontend branching is only a user-experience convenience. Backend authorization remains the actual security boundary.

## 7. Backend API implementation

The Express service is mounted from `backend/src/index.js` and exposes the following route groups.

### 7.1 Authentication

Base path: `/api/auth`

- `POST /signup`
- `POST /login`
- `POST /logout`
- `GET /check`
- `POST /forgot-password`
- `POST /reset-password`
- `PATCH /change-password`
- `PUT /update-profile`

Authentication routes include rate limiting where appropriate and use protected middleware for authenticated actions.

### 7.2 Budget calculation

Base path: `/api/v1/budget`

- `POST /calculate`

The budget service validates input and calculates a cost breakdown with source/provenance information. It supports cost components such as accommodation, food, transport, activities, contingency, subtotal, and grand total.

### 7.3 Pressure

Base path: `/api/v1/pressure`

- `GET /map`
- `GET /:destId`

Pressure calculations use destination and signal data and expose component-level information, confidence/degraded/stale indicators, and source metadata where available.

### 7.4 Weather, trains, places, routes, fares, and roads

Implemented data routes include:

- `GET /api/weather`
- `GET /api/trains`
- `GET /api/places`
- `GET /api/places/photo`
- `POST /api/routes`
- `GET /api/fare`
- `GET /api/road`
- `GET /api/geocode`
- `GET /api/destinations`

These routes provide the deterministic data used by the AI planner and map/trip UI.

### 7.5 Alternatives/substitution

Base path: `/api/alternatives`

- `POST /`

The alternatives engine can compare destinations and dates using pressure, reachability, budget estimates, interests, and other available signals. It ranks and filters alternatives rather than simply returning an unfiltered destination list.

### 7.6 Trips

Base path: `/api/v1/trips`

- `POST /`
- `GET /`
- `GET /summary`
- `GET /:id`
- `PATCH /:id`

Trip records are used for drafts, completed plans, traveller history, and authority-level trip analytics. The summary route is authority protected.

### 7.7 Businesses and bookings

Base paths:

- `/api/v1/businesses`
- `/api/v1/bookings`

Business endpoints:

- `GET /search`
- `GET /mine`
- `GET /:id/contact`
- `POST /`

Booking endpoints:

- `POST /`
- `GET /mine`
- `GET /business/:businessId`

### 7.8 Offers and waitlists

Base paths:

- `/api/v1/offers`
- `/api/v1/waitlist`

Offer endpoints:

- `GET /`
- `POST /`
- `POST /:id/claim`

Waitlist endpoints:

- `POST /`
- `GET /mine`
- `GET /business/:businessId`
- `DELETE /:id`

### 7.9 Alerts and safety

Base paths:

- `/api/v1/alerts`
- `/api/v1/safety`

Alert endpoints:

- `GET /`
- `GET /for-trip`
- `POST /`

Safety endpoints:

- `GET /emergency-contacts/:destId`
- `POST /trips/share`
- `GET /trips/share/:token`
- `POST /trips/share/:token/revoke`
- `POST /complaints`
- `GET /complaints/mine`

### 7.10 Visits

Base path: `/api/v1/visits`

- `POST /verify`
- `GET /operator-code/:businessId`

### 7.11 Community

Base path: `/api/community`

- `POST /photos`
- `POST /submissions`
- `GET /submissions/queued`
- `POST /submissions/:id/review`

### 7.12 User preferences

Base path: `/api/v1/users`

- `GET /:id/preferences`
- `PATCH /:id/preferences`

### 7.13 Authority dashboard

Base path: `/api/v1/dashboard`

- `GET /pressure`
- `GET /capacity`
- `GET /redistribution`
- `GET /acceptance`

### 7.14 WhatsApp onboarding webhook

Base path: `/api/webhook/whatsapp`

- `GET /` — Meta webhook verification handshake.
- `POST /` — inbound WhatsApp messages.

The webhook handles text, audio, and image messages, including media retrieval, transcription/extraction, image upload, draft confirmation, and replay protection.

## 8. AI service implementation

The AI service is a separate FastAPI application.

### 8.1 AI planning endpoints

- `GET /health`
- `POST /api/plan-trip`
- `POST /api/plan-trip/confirm`

The planner performs request validation, authentication forwarding, backend data retrieval, pressure gating, trip-draft persistence, and final trip generation.

### 8.2 Planner architecture

The travel agent is divided into two stages:

1. **Data-gathering agent**
   - Calls tools for weather, trains, places, routes, fares, roads, pressure, alternatives, alerts, businesses, preferences, costs, and itinerary optimization.
   - Is instructed not to invent missing numbers.
   - Stores gathered findings.

2. **Formatter agent**
   - Converts findings to a strict `TripSummary` schema.
   - Leaves fields null or empty when real data was unavailable.
   - Produces a predictable response for the frontend.

This separation prevents tool-calling and structured-output concerns from interfering with each other on providers that do not support both modes in a single call.

### 8.3 AI tools

Implemented tool modules include:

- `weather.py`
- `trains.py`
- `places.py`
- `routes.py`
- `fare.py`
- `road.py`
- `pressure.py`
- `alternatives.py`
- `alerts.py`
- `businesses.py`
- `itinerary.py`
- `trip_cost.py`
- `user_preferences.py`

The tools call the Express backend through a shared backend client so that timeout, headers, and error handling are not duplicated throughout the service.

### 8.4 Deterministic planning logic

Not all planning behavior is delegated to the LLM. Deterministic logic handles:

- Date validation.
- End-date validation.
- Pressure threshold evaluation.
- Trip-draft persistence.
- Alternative selection handling.
- Date shifting while preserving trip length.
- Cost arithmetic.
- Itinerary ordering/optimization.
- Photo URL attachment.
- Response schema validation.

This makes the main product rule — redistributing demand away from high-pressure destinations — enforceable on every planning request.

### 8.5 AI onboarding

Endpoints include:

- `POST /onboarding/transcribe`
- `POST /onboarding/extract`
- `POST /internal/ai/recommendation`
- `POST /internal/ai/travel-brief`
- `POST /internal/travel-brief/pdf`

Implemented onboarding behavior includes:

- Audio upload.
- Whisper transcription.
- CUDA availability/probe fallback to CPU.
- Language-aware extraction prompts.
- Extraction of business/worker fields from natural-language messages.
- Recommendation generation.
- Travel brief generation.
- PDF travel brief generation.

### 8.6 Travel brief

The travel brief can include:

- Explanation of the plan.
- Weather advice.
- Practical advice.
- Hidden gems.
- Trip details.
- Generated PDF output.

The frontend provides a download action that requests the PDF from the AI service and downloads it as `sahyatri-travel-brief.pdf`.

## 9. Backend data models

Mongoose models currently present include:

- `User`
- `AuthToken`
- `Trip`
- `Budget`
- `DestinationPressure`
- `DestinationDemand`
- `Business`
- `BusinessAvailability`
- `Booking`
- `Visit`
- `Offer`
- `Waitlist`
- `CommunitySubmission`
- `Feedback`
- `Alert`
- `Complaint`
- `ShareableTrip`
- `AuditLog`
- `AlternativeSuggestion`

These models cover identity, planning, pressure measurement, business capacity, offers, waitlists, safety, moderation, and analytics.

## 10. Background jobs and operational behavior

The backend includes jobs for:

- Precomputing destination pressure.
- Polling safety/weather alerts.
- Aggregating demand.
- Expiring offers.

The alert polling scheduler starts with the server, performs an initial run, and then repeats at a fixed interval. A failed polling run is logged and does not crash the main server process.

## 11. Security and reliability measures

Implemented security/reliability measures include:

- JWT-based authentication.
- HTTP-only cookies.
- Password hashing with bcrypt.
- Protected backend routes.
- Role-based backend authorization.
- Frontend authentication and role guards.
- Rate limiting on sensitive authentication actions.
- CORS allow-list configuration.
- Request validation using middleware/Pydantic.
- User ownership scoping for trip data.
- Service-auth support for internal AI/backend calls.
- Upload handling with Multer.
- Webhook verification for WhatsApp.
- Duplicate/replay handling for WhatsApp messages.
- Graceful handling of unavailable external providers.
- Explicit response envelopes for provider failures.
- Loading, empty, and error states across the UI.

Frontend role guards are not treated as the real security boundary. The backend validates authorization for protected operations.

## 12. External integrations

The repository contains integration paths for:

- Google Maps Places.
- Google Maps Routes.
- Google Maps geocoding/photo retrieval.
- Weather provider/Open-Meteo-related flows.
- Train/rail data adapters.
- Road transport/service data.
- Cloudinary media storage.
- WhatsApp/Meta webhook and media APIs.
- Gemini/Google ADK/LiteLLM.
- Faster-Whisper.
- Nodemailer/password recovery.

Some integrations can use seeded, estimated, or fallback values when live credentials or provider data is unavailable. Provider provenance is retained where supported so fallback data is not represented as live data.

## 13. Seed data and local development support

The repository includes seed and fixture data for:

- Destinations.
- Businesses.
- Availability.
- Calendar data.
- Fares.
- Pressure history.
- Test destinations such as Manali and Shimla.

Developer support includes:

- Backend seed command.
- Vite development server.
- Express development server with Nodemon.
- Frontend production build.
- Backend Jest tests.
- Postman collections.
- REST Client HTTP examples.
- Render deployment configuration.
- Vercel frontend configuration.
- Conventional Commit git hook setup.

## 14. Testing implemented so far

The backend contains tests for several areas, including:

- Budget calculations.
- Budget input validation.
- Waitlist behavior.
- Substitution/alternative logic.
- Pressure services.
- Alert services.
- Shareable trips.
- Business models.
- Business availability.
- Destination demand.
- Onboarding behavior.
- WhatsApp webhook behavior.
- WhatsApp replay handling.
- WhatsApp audio/image processing.

The AI service contains tests for:

- Transcription backend fallback behavior.
- Extraction prompt behavior.
- Pending-field extraction context.

The repository also contains Postman and HTTP scenarios for manually exercising APIs.

## 15. Current route map

### Public routes

- `/`
- `/signin`
- `/signup`
- `/forgot-password`
- `/reset-password`
- `/explore`
- `/explore/:destId`
- `/businesses`
- `/alerts`

### Authenticated routes

- `/home`
- `/map`
- `/trips`
- `/swap`
- `/trip-confirmation`
- `/visits`
- `/community`
- `/services`
- `/notifications`
- `/offers`
- `/safety`
- `/profile`

### Operator routes

- `/operator`
- `/register-business`
- `/hire-people`
- `/operator/waitlist`

### Authority routes

- `/authority`

### Backwards-compatible redirects

- `/login` → `/signin`
- `/pressure` → `/explore`
- `/planner` → `/home`
- `/map-preview` → `/map`
- `/verify-email` → `/signin`

## 16. Known limitations and unfinished areas

The following items are present in the repository but should not be described as fully complete:

1. **Operator console availability management** is currently a Coming Soon screen because the required declared-availability API and account-to-business linkage are not complete.
2. **Amadeus integration** is intentionally unavailable when credentials are absent; the adapter returns an explicit unavailable response rather than fake flight/hotel data.
3. **Some external data** can fall back to seeds, estimates, mocks, or provider-degraded responses depending on environment configuration.
4. **Destination picker data** is partly mirrored in the frontend because the backend destination catalogue is not yet a complete queryable UI source.
5. **Email verification** is not part of the current signup flow; signup logs the user in directly.
6. **Some UI capabilities depend on environment variables** such as the backend URL, AI service URL, Google Maps keys, database configuration, Cloudinary configuration, and provider credentials.
7. **Live provider availability** cannot be guaranteed without valid credentials, network access, and provider-side service availability.

## 17. End-to-end primary flows

### Traveller planning flow

1. Traveller opens Sahyatri.
2. Traveller signs up or logs in.
3. Traveller enters origin, destination, dates, budget, travellers, and interests.
4. Frontend submits the request to the AI service.
5. AI service authenticates/associates the request and gathers backend data.
6. Pressure is evaluated.
7. If pressure is high, alternatives are displayed and the request pauses.
8. Traveller accepts an alternative or declines.
9. AI service confirms the decision and generates the final plan.
10. Traveller views summary, route, map, cost, itinerary, pressure, alerts, and businesses.
11. Traveller can save/view the trip and download a PDF travel brief.

### Operator business flow

1. Operator signs in.
2. Operator registers a business.
3. Operator views businesses associated with the account.
4. Operator browses or onboards workers.
5. Operator views waitlisted travellers.
6. Operator opens a flash offer.
7. Matching waitlist users can be notified/receive the offer.
8. Operator displays a rotating visit-verification code.

### Authority monitoring flow

1. Authority signs in.
2. Authority opens the dashboard.
3. Dashboard loads pressure, capacity, redistribution, and acceptance data.
4. Authority refreshes or switches dashboard sections.
5. Authority reviews community submissions and approves/rejects them.

## 18. Overall implementation status

The repository currently contains a working full-stack foundation with:

- A multi-role tourism product UI.
- A pressure-aware planner.
- A REST backend with MongoDB models.
- A separate AI orchestration service.
- Maps, routes, places, costs, alerts, safety, business, community, waitlist, and authority workflows.
- Authentication, authorization, validation, background jobs, testing, and deployment configuration.

The strongest completed product path is the traveller trip-planning flow from authentication through pressure-aware planning, alternative selection, map/trip presentation, saved trips, safety information, and downloadable travel brief. The main clearly unfinished user-facing area is the operator availability-management console.

## 19. Swap Card implementation

The generated-trip Swap Card is implemented as a non-blocking map banner. It is
shown only when the existing Pressure Engine reports a high destination/date
signal and a verified candidate is available. Dismissing the card hides it for
the current trip session.

### Backend flow

- `ai-service/app/tools/alternatives.py` exposes `find_alternative(trip)` and
  `find_alternative_dates(trip)`.
- Both functions are adapters over the existing `/api/alternatives` pipeline;
  they do not duplicate crowd or pressure scoring.
- Destination and date checks run independently against the original trip.
- When both candidates exist, the combined budget difference is the sum of the
  two candidate budget differences. Combined pressure is not calculated by
  adding/subtracting scores: the Pressure Engine is called again for the
  alternative destination on the alternative dates.
- `ai-service/app/main.py` runs these checks after the requested trip has been
  generated and attaches the result at `trip.alternatives.swapOffers`.
- The trip remains usable even if optional swap enrichment fails.

### Frontend flow

- `frontend/src/components/swap/SwapCard.jsx` renders destination-only,
  date-only, and combined variants with reason bullets, pressure, and budget
  values.
- `frontend/src/components/map/EverythingMap.jsx` places the card near the map
  top without blocking the map.
- Preview opens the existing `RecommendationOverlay` comparison flow and reuses
  the backend-provided reason bullets.
- Apply calls `usePlannerStore.applySwap`, which regenerates the trip for the
  selected destination/date so hotels, itinerary, route, weather, and other
  downstream data are refreshed.
- Preview cancellation never mutates the current trip.

## 20. My Trips history and details

The `/trips` page now provides an expandable history rather than only a
one-line summary. Each saved trip can show its itinerary days and stops,
starting point, route distance/duration, budget, selected hotel, traveller
count, redistribution result, and a travel-brief download action when an
itinerary is available.

The page also includes destination/origin search and clear loading, error,
empty, and no-match states. Normal plans are persisted after generation by
`ai-service/app/services/trip_drafts.py`; pressure-confirmed plans continue to
use the existing draft/confirm persistence path. Persistence failures do not
discard a valid generated plan.

The page also provides dashboard summary cards for total trips, planned trips,
redistributed trips, and savings, along with All/Planned/Redistributed/Draft
filters and newest/oldest sorting.
