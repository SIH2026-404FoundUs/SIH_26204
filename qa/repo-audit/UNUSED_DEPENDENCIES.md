# Unused Dependency Analysis

## Backend (`backend/package.json`)

| Package | Version | Imported? | Where | Direct/Transitive | Purpose | Status | Confidence |
|---|---|---|---|---|---|---|---|
| axios | listed | Yes | 4 files | Direct | HTTP client (provider calls) | ACTIVE | high |
| bcryptjs | listed | Yes | 1 file (auth.controller.js) | Direct | password hashing | ACTIVE | high |
| cloudinary | listed | Yes | 1 file (lib/cloudinary.js), used by 6 more via that lib | Direct | image upload | ACTIVE | high |
| cookie-parser | listed | Yes | 1 file (index.js) | Direct | JWT cookie parsing | ACTIVE | high |
| cors | listed | Yes | 1 file (index.js) | Direct | CORS middleware | ACTIVE | high |
| dotenv | listed | Yes | 4 files | Direct | env loading | ACTIVE | high |
| express | listed | Yes | 32 files | Direct | web framework | ACTIVE | high |
| express-rate-limit | listed | Yes | 1 file (authRateLimit.js) | Direct | signup/login rate limiting | ACTIVE | high |
| jsonwebtoken | listed | Yes | 2 files | Direct | JWT signing/verification | ACTIVE | high |
| mongoose | listed | Yes | 35 files | Direct | MongoDB ODM | ACTIVE | high |
| nodemailer | listed | Yes | 1 file (lib/mailer.js) | Direct | forgot-password email | ACTIVE (though SMTP env vars are unconfigured in this dev environment — see the earlier `qa/e2e/environment_validation.md` — the *code path* is real, just untested end-to-end) | high |
| multer | listed | Yes | 3 files | Direct | multipart file upload (photos) | ACTIVE | high |
| **socket.io** | **listed (`^4.8.1`)** | **No** | — | — | Presumably intended for real-time push (waitlist/offer notifications, live dashboard updates) | **UNUSED** | **high** |

**socket.io finding detail**: `grep -rn "from [\"']socket\.io\|require([\"']socket\.io\|new Server("` across all of `backend/src` returns zero matches. Every "real-time" feature actually built in this app this session (operator waitlist/offers, authority dashboard, notifications) uses client-side polling (`setInterval` + a `{silent}` fetch flag), not WebSockets. `socket.io` is very likely a dependency installed early for an approach that was later replaced by polling, and never removed from `package.json`.

## Frontend (`frontend/package.json`)

| Package | Imported? | Where | Status | Confidence |
|---|---|---|---|---|
| axios | Yes | `lib/api.js` + `usePlannerStore.js`'s separate AI-service client | ACTIVE | high |
| lucide-react | Yes | dozens of components | ACTIVE | high |
| react, react-dom | Yes | everywhere | ACTIVE | high |
| react-router-dom | Yes | `App.jsx` + several components | ACTIVE | high |
| zustand | Yes | 10 stores | ACTIVE | high |

**No unused frontend dependencies found.** Small, clean dependency list — nothing flagged.

## AI service (`ai-service/requirements.txt`)

**Not individually cross-checked against imports this pass** — Python's import surface (FastAPI, google-adk, and their transitive dependencies) is large and this pass did not have time to verify each pinned package against actual `import` statements the way the two Node projects were checked. Flagged NEEDS MANUAL REVIEW rather than guessed at.
