# SIH 26204 - Travel Planning & Microservices Platform

Welcome to the **SIH_26204** repository. This project powers an itinerary and travel planning backend featuring user authentication and an intelligent trip budget calculation microservice with source-provenance auditing.

> 📖 **Comprehensive Documentation:** For a complete deep-dive into the codebase, folder structure, features, Jest tests, and API verification, see [PROJECT_OVERVIEW.md](file:///c:/Projects/SIH_26204/PROJECT_OVERVIEW.md).

---

## Key Highlights

- 🔐 **Authentication System:** JWT in HTTP-only cookies, password hashing with bcrypt, profile image uploads via Cloudinary.
- 💰 **Budget Calculation Microservice (`POST /api/v1/budget/calculate`):** High-precision financial calculations with source provenance tracking (`business_declared`, `provider:*`, `seeded`, `estimated`, `manual`, and `mixed`).
- 🛡️ **Defensive Validation:** Comprehensive middleware guarding against missing, zero, or negative cost parameters.
- ⚡ **Non-Blocking Persistence:** Asynchronous MongoDB analytics logging that never blocks client responses even if database connectivity fluctuates.
- 🧪 **23 Passing Automated Tests:** 100% passing Jest test suites covering middleware, services, and live route integrations.
- 📦 **API Tooling Included:** Pre-built `budget.http` (REST Client) and `budget.postman_collection.json` (Postman v2.1) ready to run.
- 🪝 **Conventional Commits Git Hooks:** Version-controlled `.githooks/commit-msg` ensuring standardized commit messages across all contributors.

---

## Quickstart

### 1. Setup & Install Dependencies
```bash
cd backend
npm install
npm run prepare-hooks
```

### 2. Configure Environment Variables
Create a `.env` file in `backend/` based on `.env.example`:
```env
PORT=5001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
NODE_ENV=development
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Run Automated Tests
```bash
npm test
```
*Expected: 3 Test Suites, 23 Tests, all passing.*

### 4. Start Development Server
```bash
npm run dev
```
The server will start listening at `http://localhost:5001`.

---

## Repository Map

- [PROJECT_OVERVIEW.md](file:///c:/Projects/SIH_26204/PROJECT_OVERVIEW.md) - Full technical architectural report and file catalog.
- [backend/budget.http](file:///c:/Projects/SIH_26204/backend/budget.http) - Interactive REST Client requests with expected responses.
- [backend/budget.postman_collection.json](file:///c:/Projects/SIH_26204/backend/budget.postman_collection.json) - Ready-to-import Postman collection.
- [backend/src/services/budgetService.js](file:///c:/Projects/SIH_26204/backend/src/services/budgetService.js) - Core calculation engine.
- [backend/src/middleware/validateBudgetInput.js](file:///c:/Projects/SIH_26204/backend/src/middleware/validateBudgetInput.js) - Input validation middleware.
- [backend/src/models/Budget.js](file:///c:/Projects/SIH_26204/backend/src/models/Budget.js) - Mongoose database schema.
- [backend/src/routes/budget.routes.js](file:///c:/Projects/SIH_26204/backend/src/routes/budget.routes.js) - Budget calculation route definitions.
- [backend/src/routes/auth.route.js](file:///c:/Projects/SIH_26204/backend/src/routes/auth.route.js) - Authentication route definitions.
