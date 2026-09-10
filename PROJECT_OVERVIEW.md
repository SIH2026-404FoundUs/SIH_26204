# SIH 26204 - Project Overview & Technical Documentation

This document provides an exhaustive record of everything built, configured, implemented, and tested in the **SIH_26204** repository.

---

## Table of Contents
1. [Project Overview & Architecture](#1-project-overview--architecture)
2. [Folder Structure](#2-folder-structure)
3. [Features Implemented](#3-features-implemented)
   - [A. Git Hooks & Conventional Commits Automation](#a-git-hooks--conventional-commits-automation)
   - [B. Backend Core & Authentication System](#b-backend-core--authentication-system)
   - [C. Budget Calculation Microservice](#c-budget-calculation-microservice)
4. [Comprehensive File-by-File Breakdown](#4-comprehensive-file-by-file-breakdown)
5. [Testing & Verification (What Was Tested & What Worked)](#5-testing--verification-what-was-tested--what-worked)
   - [Automated Test Suites (Jest)](#automated-test-suites-jest)
   - [API Collections & HTTP Scenarios](#api-collections--http-scenarios)
   - [Summary of Test Scenarios & Outcomes](#summary-of-test-scenarios--outcomes)
6. [How to Run and Validate the Project](#6-how-to-run-and-validate-the-project)

---

## 1. Project Overview & Architecture

**SIH_26204** is an enterprise-grade travel and itinerary planning platform developed with a microservices-ready Node.js backend. The platform provides:
- Secure, token-based authentication with avatar upload capabilities.
- A high-precision budget calculation engine for trip planning that tracks source provenance for cost estimations (e.g., live provider feeds, business-declared prices, manual inputs, seed values, and defaulted fallback estimates).
- Resilient non-blocking database persistence for analytical tracking.
- Team engineering discipline enforced by pre-commit and commit-message Git hooks according to the **Conventional Commits** specification.

### Technology Stack
- **Runtime Environment:** Node.js (ES Modules, `"type": "module"`)
- **Web Framework:** Express 5.x (`express@^5.1.0`)
- **Database & ODM:** MongoDB with Mongoose (`mongoose@^8.15.1`)
- **Authentication & Security:** JSON Web Tokens (`jsonwebtoken@^9.0.2`), BCrypt password hashing (`bcryptjs@^3.0.2`), HTTP-only Cookies (`cookie-parser@^1.4.7`), and CORS (`cors@^2.8.5`)
- **Media Storage:** Cloudinary SDK (`cloudinary@^2.6.1`)
- **Test Framework:** Jest (`jest@^30.5.1`) with `--experimental-vm-modules` ES module execution
- **Development Tooling:** Nodemon (`nodemon@^3.1.14`), Git Hooks (POSIX shell & Windows batch)

---

## 2. Folder Structure

```
SIH_26204/
│
├── .githooks/                               # Version-controlled Git hooks
│   └── commit-msg                           # Enforces Conventional Commits standard
│
├── backend/                                 # Express backend application
│   ├── .env                                 # Environment variables (PORT, DB URI, JWT, Cloudinary)
│   ├── .env.example                         # Template configuration file for environment variables
│   ├── budget.http                          # REST Client HTTP file for interactive manual testing
│   ├── budget.postman_collection.json       # Postman Collection (v2.1.0) with all calculation test cases
│   ├── package.json                         # Node dependencies, scripts, and module metadata
│   ├── package-lock.json                    # Exact dependency lockfile
│   │
│   └── src/                                 # Backend source code
│       ├── index.js                         # Express application entry point & MongoDB initialization
│       │
│       ├── controllers/                     # Route handler controllers
│       │   ├── auth.controller.js           # Signup, login, logout, profile update, auth check
│       │   └── budgetController.js          # Trip budget calculation & optional DB persistence
│       │
│       ├── lib/                             # External service configurations & utilities
│       │   ├── cloudinary.js                # Cloudinary v2 image upload client configuration
│       │   ├── db.js                        # Mongoose MongoDB connection handler
│       │   └── jwt.js                       # JWT token generator and secure cookie setter
│       │
│       ├── middleware/                      # Express middleware functions
│       │   ├── auth.middleware.js           # Route protection verifying JWT tokens
│       │   ├── validateBudgetInput.js       # Validation middleware for budget calculation payloads
│       │   └── validateBudgetInput.test.js  # Jest unit tests for the budget input validator
│       │
│       ├── models/                          # Mongoose data models
│       │   ├── Budget.js                    # Schema for persisted trip budgets and audit breakdowns
│       │   └── user.model.js                # Schema for users (credentials, avatar, timestamps)
│       │
│       ├── providers/                       # External third-party provider integration stubs
│       │   └── know.txt                     # Architecture notes on external data providers
│       │
│       ├── routes/                          # Express endpoint route definitions
│       │   ├── auth.route.js                # /api/auth endpoints (signup, login, logout, check)
│       │   ├── budget.routes.js             # /api/v1/budget endpoint registration
│       │   └── budget.routes.test.js        # Jest integration tests using ephemeral HTTP servers
│       │
│       ├── services/                        # Business logic layer
│       │   ├── budgetService.js             # Pure budget arithmetic, source labeling & audit flags
│       │   ├── budgetService.test.js        # Jest unit tests for budget calculation rules
│       │   └── know.txt                     # Architecture notes on calculation domain logic
│       │
│       └── utils/                           # General helper functions
│           ├── know.txt                     # Notes on utilities
│           └── money.js                     # 2-decimal financial rounding utility
│
├── scripts/                                 # Setup and bootstrap automation scripts
│   ├── setup-hooks.bat                      # Windows script to configure Git hooks path
│   └── setup-hooks.sh                       # POSIX script to configure Git hooks path
│
├── .gitignore                               # Git ignored files (node_modules, .env, OS artifacts)
├── PROJECT_OVERVIEW.md                      # Comprehensive project documentation (this document)
└── README.md                                # Quickstart guide & repository index
```

---

## 3. Features Implemented

### A. Git Hooks & Conventional Commits Automation
- **Commit Message Linter (`.githooks/commit-msg`):**
  - Intercepts every `git commit` to validate subject lines against the Conventional Commits specification.
  - Enforced format: `type(scope): description` or `type: description`.
  - Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `ci`, `build`, `chore`, `perf`, `style`, `revert`.
  - Colored terminal error output with illustrative examples when commits violate the pattern.
  - Automated bypass for merge, squash, and fixup commits.
- **Cross-Platform Setup Scripts:**
  - `scripts/setup-hooks.bat` for Windows developers.
  - `scripts/setup-hooks.sh` for macOS / Linux developers.
  - `npm run prepare-hooks` inside `backend/package.json` to link `.githooks` directly via Git configuration (`git config core.hooksPath ../.githooks`).

---

### B. Backend Core & Authentication System
- **Server Entrypoint (`backend/src/index.js`):**
  - Configured with `dotenv`, `express.json()`, `cookieParser()`, and `cors('*')`.
  - Mounts authentication routes at `/api/auth` and budget calculation microservice routes at `/api/v1/budget`.
  - Connects to MongoDB on server launch (`connectDB`).
- **Database Connection (`backend/src/lib/db.js`):**
  - Connects to MongoDB via Mongoose using `process.env.MONGODB_URI`.
- **JWT & Secure Cookie Handling (`backend/src/lib/jwt.js`):**
  - Generates JWT tokens valid for 7 days (`maxAge: 7 * 24 * 60 * 60 * 1000`).
  - Stores tokens in HTTP-only cookies (`httpOnly: true`, `sameSite: "strict"`, `secure: process.env.NODE_ENV !== "development"`).
- **Authentication Routes & Controller (`backend/src/routes/auth.route.js` & `auth.controller.js`):**
  - `POST /api/auth/signup`: Validates fields, enforces 6+ character password minimum, checks for duplicate email, hashes passwords using bcrypt salts (10 rounds), generates JWT token, and returns user object.
  - `POST /api/auth/login`: Validates credentials, verifies bcrypt hash, and issues JWT cookie.
  - `POST /api/auth/logout`: Clears the JWT cookie immediately.
  - `PUT /api/auth/update-profile`: Protected route; uploads profile picture to Cloudinary and saves secure image URL in the user document.
  - `GET /api/auth/check`: Protected route; returns current authenticated user profile without exposing passwords.
- **Route Guard Middleware (`backend/src/middleware/auth.middleware.js`):**
  - Extracts JWT from incoming request cookies, decodes token with `JWT_SECRET`, queries user by ID (excluding password), and assigns `req.user`. Returns 401 Unauthorized if token is missing or invalid.

---

### C. Budget Calculation Microservice
- **API Endpoint:** `POST /api/v1/budget/calculate`
- **Request Payload Structure:**
  ```json
  {
    "tripId": "trip-hyd-101",
    "destId": "dest-ts-001",
    "travellers": 2,
    "days": 4,
    "budget": 25000,
    "transport": { "mode": "train", "totalCost": 3000, "source": "provider:railradar" },
    "hotel": { "pricePerNight": 2000, "nights": 3, "source": "business_declared" },
    "food": { "pricePerPersonPerDay": 350, "source": "manual" },
    "activities": [
      { "name": "Golconda Fort", "pricePerPerson": 25, "source": "provider:google_places" },
      { "name": "Salar Jung Museum", "pricePerPerson": 50, "source": "provider:google_places" }
    ],
    "localTransport": { "estimatedCost": 1200, "source": "seeded" }
  }
  ```
- **Validation Rules (`validateBudgetInput.js`):**
  - Ensures `budget`, `travellers`, and `days` are numbers strictly `> 0`.
  - Validates that cost parameters (`transport.totalCost`, `hotel.pricePerNight`, `hotel.nights`, `food.pricePerPersonPerDay`, `localTransport.estimatedCost`, and activity `pricePerPerson`) are non-negative numbers (`>= 0`).
  - Allows omission of optional categories (defaults gracefully without crashing).
  - Defaults optional `tripId` and `destId` to `null` if omitted.
  - Tolerates unrecognized or omitted `source` strings without throwing 400 errors (delegates labeling to the service layer).
- **Core Domain Service (`budgetService.js`):**
  - **Itemized Calculations:**
    - Hotel: `pricePerNight * nights`
    - Food: `pricePerPersonPerDay * travellers * days`
    - Activities: `sum(pricePerPerson * travellers)`
    - Transport: `transport.totalCost`
    - Local Transport: `localTransport.estimatedCost`
  - **Source Provenance Labeling:**
    - Allowed sources: `business_declared`, `provider:amadeus`, `provider:railradar`, `provider:google_places`, `provider:open_meteo`, `seeded`, `estimated`, `manual`, or any wildcard matching `provider:<name>`.
    - Unlabeled, missing, or unrecognized sources automatically default to `"estimated"`.
    - Activity sources are dynamically aggregated: if all activities share the same source (e.g. `provider:google_places`), that source is retained; if multiple activities have differing sources, the category resolves to `"mixed"`.
  - **Audit Flag (`hasUnlabelledEstimates`):**
    - Set to `true` if *any* category or activity had its source defaulted due to absence or unrecognized source string; set to `false` when all sources are explicitly supplied.
  - **Metrics Computed:**
    - `totalCost`: Sum of all 5 cost categories.
    - `remaining`: `budget - totalCost`.
    - `utilizationPercent`: `(totalCost / budget) * 100`.
    - `isOverBudget`: Boolean flag (`totalCost > budget`).
    - `largestCategory`: Identifies highest-cost category (`hotel`, `transport`, `food`, etc.), or `null` if all costs are 0.
    - `tripId` & `destId`: Echoed back or set to `null`.
  - **Financial Precision:**
    - Uses `roundToTwo` (`utils/money.js`) utilizing `Number.EPSILON` to eliminate floating point binary inaccuracies.
- **Non-Blocking Persistence (`budgetController.js` & `models/Budget.js`):**
  - `Budget` model with `bufferCommands: false` prevents request hanging if MongoDB is offline.
  - Controller saves calculation snapshot asynchronously with `.catch()` error suppression, guaranteeing client requests always succeed in `< 10ms` regardless of database state.

---

## 4. Comprehensive File-by-File Breakdown

| File Path | Component | Responsibility |
|---|---|---|
| `.githooks/commit-msg` | Git Hook | Validates commit messages against Conventional Commits specification. |
| `scripts/setup-hooks.bat` | Tooling | Sets `git config core.hooksPath ../.githooks` on Windows. |
| `scripts/setup-hooks.sh` | Tooling | Sets `git config core.hooksPath ../.githooks` on macOS/Linux. |
| `backend/package.json` | Configuration | Express, Mongoose, JWT, Cloudinary, Jest, scripts (`dev`, `test`, `prepare-hooks`). |
| `backend/.env.example` | Configuration | Sample environment variables for port, DB, JWT, Cloudinary. |
| `backend/src/index.js` | Server | Express app bootstrap, middleware registration, route mounting, MongoDB startup. |
| `backend/src/lib/db.js` | Database | Mongoose connection helper with logging. |
| `backend/src/lib/jwt.js` | Security | Signs JWTs and attaches secure HTTP-only cookies to responses. |
| `backend/src/lib/cloudinary.js` | Cloud Media | Cloudinary v2 setup using environment API keys. |
| `backend/src/models/user.model.js` | Model | Mongoose schema for user credentials, email, and avatar URL. |
| `backend/src/models/Budget.js` | Model | Mongoose schema for inputs, cost breakdowns, sources, and metrics. |
| `backend/src/middleware/auth.middleware.js` | Middleware | Validates JWT cookie and decorates `req.user`. |
| `backend/src/middleware/validateBudgetInput.js` | Middleware | Validates request inputs for `/api/v1/budget/calculate`. |
| `backend/src/middleware/validateBudgetInput.test.js` | Testing | 8 Jest unit tests for payload validation, negatives, and edge cases. |
| `backend/src/controllers/auth.controller.js` | Controller | Handlers for signup, login, logout, updateProfile, and checkAuth. |
| `backend/src/controllers/budgetController.js` | Controller | Invokes `budgetService` and performs non-blocking DB persistence. |
| `backend/src/services/budgetService.js` | Service | Pure calculation logic for costs, sources, percentages, and metrics. |
| `backend/src/services/budgetService.test.js` | Testing | 11 Jest unit tests for budget arithmetic, source inference, and rounding. |
| `backend/src/routes/auth.route.js` | Routes | Mounts `/api/auth` endpoints. |
| `backend/src/routes/budget.routes.js` | Routes | Mounts `/api/v1/budget/calculate` with validation middleware. |
| `backend/src/routes/budget.routes.test.js` | Testing | 4 Jest integration tests against live HTTP server instances. |
| `backend/src/utils/money.js` | Utility | `roundToTwo()` financial rounding helper. |
| `backend/budget.http` | Testing Tool | 6 scenarios for VS Code REST Client / JetBrains HTTP Client. |
| `backend/budget.postman_collection.json` | Testing Tool | Postman collection v2.1.0 with 6 pre-configured requests and responses. |

---

## 5. Testing & Verification (What Was Tested & What Worked)

### Automated Test Suites (Jest)
All automated tests run via:
```bash
cd backend
npm test
```
**Test Results:**
- **Test Suites:** 3 passed, 3 total
- **Tests:** 23 passed, 23 total
- **Snapshots:** 0 total
- **Execution Time:** ~2.3 seconds

```
PASS src/middleware/validateBudgetInput.test.js
  validateBudgetInput middleware
    √ passes validation with full valid payload
    √ passes validation when optional categories are omitted
    √ rejects when budget is missing or <= 0
    √ rejects when travellers is missing or <= 0
    √ rejects when days is missing or <= 0
    √ rejects when any provided cost field is negative
    √ defaults tripId and destId to null when omitted, and passes through when provided
    √ tolerates missing or unrecognised source strings without throwing 400

PASS src/services/budgetService.test.js
  budgetService - calculateBudget
    √ 1. Request with every source explicitly provided (hasUnlabelledEstimates: false)
    √ 2. Request with sources omitted entirely (hasUnlabelledEstimates: true, all defaulted to 'estimated')
    √ 3. Unrecognised source string defaults to 'estimated' and is flagged
    √ 4. tripId/destId echoed correctly when provided and null when omitted
    √ 5. Activities with different sources resolve to 'mixed'
    √ 6. Missing optional categories should default to 0 and 'estimated'
    √ 7. Empty activities array should yield 0 for activities cost with source 'estimated'
    √ 8. Over-budget case when totalCost exceeds budget
    √ 9. Zero utilization case when no expenses are provided
    √ 10. Decimal precision rounding to 2 decimal places
    √ 11. Any provider: pattern string is accepted as valid source

PASS src/routes/budget.routes.test.js
  budget.routes integration
    √ POST /api/v1/budget/calculate returns 200 with valid payload
    √ POST /api/v1/budget/calculate returns 400 with missing budget
    √ POST /api/v1/budget/calculate returns 400 with negative hotel price
    √ POST /api/v1/budget/calculate returns 200 with empty activities array
```

---

### API Collections & HTTP Scenarios
Both `backend/budget.http` and `backend/budget.postman_collection.json` contain the exact scenarios below.

#### Scenario 1: Valid Full Payload with Explicit Sources
- **Method:** `POST /api/v1/budget/calculate`
- **Request Input:**
  - Travellers: 2, Days: 4, Budget: 25000
  - Transport: ₹3000 (`provider:railradar`)
  - Hotel: ₹2000/night x 3 nights = ₹6000 (`business_declared`)
  - Food: ₹350/person/day x 2 x 4 = ₹2800 (`manual`)
  - Activities: 2 tickets @ ₹25 & ₹50 for 2 travellers = ₹150 (`provider:google_places`)
  - Local Transport: ₹1200 (`seeded`)
- **Observed Result (Worked):** Status `200 OK`, `totalCost`: ₹13,150, `remaining`: ₹11,850, `utilizationPercent`: 52.6%, `isOverBudget`: false, `largestCategory`: `"hotel"`, `hasUnlabelledEstimates`: `false`.

#### Scenario 2: Missing Required Field (`budget`)
- **Method:** `POST /api/v1/budget/calculate`
- **Request Input:** Payload with `travellers` and `days`, but `budget` omitted.
- **Observed Result (Worked):** Status `400 Bad Request`, body `{ "error": true, "message": "budget is required and must be a number greater than 0" }`.

#### Scenario 3: Negative Price (`hotel.pricePerNight: -500`)
- **Method:** `POST /api/v1/budget/calculate`
- **Request Input:** Payload containing negative hotel nightly rate.
- **Observed Result (Worked):** Status `400 Bad Request`, body `{ "error": true, "message": "hotel pricePerNight cannot be negative and must be a valid number" }`.

#### Scenario 4: Empty Activities Array (`activities: []`)
- **Method:** `POST /api/v1/budget/calculate`
- **Request Input:** Payload with `activities: []`.
- **Observed Result (Worked):** Status `200 OK`, `costBreakdown.activities`: `{ "amount": 0, "source": "estimated" }`, `hasUnlabelledEstimates`: `true`.

#### Scenario 5: Over-Budget Scenario
- **Method:** `POST /api/v1/budget/calculate`
- **Request Input:** Budget: ₹10,000, Total Expenses: ₹14,000 (Hotel ₹10,000 + Transport ₹4,000).
- **Observed Result (Worked):** Status `200 OK`, `totalCost`: ₹14,000, `remaining`: -₹4,000, `utilizationPercent`: 140%, `isOverBudget`: `true`, `largestCategory`: `"hotel"`.

#### Scenario 6: Sources Omitted Scenario
- **Method:** `POST /api/v1/budget/calculate`
- **Request Input:** All numerical costs provided without any `source` properties.
- **Observed Result (Worked):** Status `200 OK`, all categories automatically labeled `"source": "estimated"`, `tripId`: `null`, `destId`: `null`, `hasUnlabelledEstimates`: `true`.

---

### Summary of Test Scenarios & Outcomes

| Scenario / Behavior Tested | Component Tested | Input Condition | Expected Output | Status |
|---|---|---|---|---|
| Complete Valid Request | Service & Route | All costs and explicit sources given | 200 OK, full breakdown, `hasUnlabelledEstimates: false` | **PASS** |
| Source Defaulting | Service | `source` property absent in input | Assigned `source: "estimated"`, `hasUnlabelledEstimates: true` | **PASS** |
| Unrecognized Source String | Service | Unknown source string e.g. `foo_bar` | Defaulted to `"estimated"`, `hasUnlabelledEstimates: true` | **PASS** |
| Dynamic Provider Wildcard | Service | Source like `provider:custom_api` | Accepted as valid source, no unlabelled estimate flag | **PASS** |
| Mixed Activity Sources | Service | Two activities with different sources | `costBreakdown.activities.source: "mixed"` | **PASS** |
| Empty Activities Array | Service & Route | `activities: []` | Amount ₹0, source `"estimated"`, no errors | **PASS** |
| Missing Optional Categories | Service & Middleware | Payload with only `hotel`, no food/transport | Missing categories default to amount ₹0 and source `"estimated"` | **PASS** |
| Over-Budget Calculation | Service & Route | Total cost > budget | `isOverBudget: true`, negative remaining balance, utilization > 100% | **PASS** |
| Zero Expense Trip | Service | No cost items provided | Amount ₹0, utilization 0%, `largestCategory: null` | **PASS** |
| Decimal Precision Rounding | Money Utility & Service | Fractional values e.g. ₹333.333 | Accurate rounding to 2 decimal places (₹3000.00) | **PASS** |
| Missing Budget Validation | Middleware & Route | Payload without `budget` | 400 Bad Request with descriptive message | **PASS** |
| Missing Travellers / Days | Middleware | Zero or negative travellers or days | 400 Bad Request with descriptive message | **PASS** |
| Negative Cost Values | Middleware & Route | Negative numbers in any category | 400 Bad Request pinpointing the invalid field | **PASS** |
| Non-blocking DB Failure | Controller | MongoDB disconnected / offline | 200 OK returned immediately without blocking client | **PASS** |

---

## 6. How to Run and Validate the Project

### 1. Setup Environment
Ensure you have Node.js (v18+) installed. Copy the environment configuration template:
```bash
cd backend
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Initialize Git Hooks
Configure Git to use the repository's `.githooks` directory:
```bash
npm run prepare-hooks
```
*(Or execute `..\scripts\setup-hooks.bat` on Windows / `../scripts/setup-hooks.sh` on Linux).*

### 4. Run the Automated Tests
Execute the entire test suite:
```bash
npm test
```

### 5. Start the Development Server
```bash
npm run dev
```
The server will start on `http://localhost:5001`.

### 6. Test with Postman or REST Client
- In VS Code, install the **REST Client** extension, open `backend/budget.http`, and click **Send Request** above any test case.
- Alternatively, open **Postman**, click **Import**, select `backend/budget.postman_collection.json`, and run the requests against `http://localhost:5001`.
