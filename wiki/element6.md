# Architecture & DevOps: Built to Swap, Built to Trust

Most student projects hard-wire their database, AI provider, and hosting together. Change one, and half the codebase breaks. Curio was built differently — the entire system is designed so that migrating from a free-tier internship setup to production infrastructure is **a configuration change, not a refactor**.

Here is a plain-language guide to the architectural decisions that make Curio portable, testable, and deployment-ready from day one.

---

## What Makes Curio's Architecture Unique?

1. **Two Swappable Boundaries**: Every database call flows through one file (`db.js`). Every AI call flows through one file (`ai.js`). No other file in the codebase touches MongoDB connections or the Gemini SDK directly. Swap the company's managed database or AI keys in, and nothing else changes.
2. **Zero-Key Development**: Leave the AI key empty and the entire platform — search, duplicate detection, the chatbot — works offline using deterministic mock responses. No quota burn, no network, no flakiness.
3. **One-Command Reproducibility**: Any reviewer can run `docker compose up --build` and have the full stack (database + API server) running. No global installs, no manual configuration.
4. **Tests That Need Nothing External**: The test suite spins up an in-memory database and uses the AI mock layer automatically. No running MongoDB instance, no API keys, no network access — CI passes in a clean container every time.

---

## The Guided Tour of How Curio is Built

### 1. The Monorepo (One Install, Everything Works)

Curio is an npm-workspaces monorepo with two packages — `client` (React/Vite) and `server` (Express). A single `npm install` at the root wires everything up. Unified scripts like `npm run dev` start both servers concurrently, and `npm test` runs the full test suite — no jumping between folders. Vite's dev server is configured to proxy `/api` and `/uploads` requests to the Express backend, so the client uses same-origin relative URLs and never needs to know the backend's port directly.

### 2. The Two Boundaries (The Heart of the Architecture)

This is the most important design decision in the project:

- **`server/config/db.js`** — the *only* file that opens a database connection. It accepts an optional URI override, which is how tests inject an in-memory database without touching the production connection string. To point Curio at a company-managed MongoDB instance, you change one environment variable.
- **`server/config/ai.js`** — the *only* file that calls the AI provider. It exposes four clean methods (embed, batch-embed, cheap JSON check, chat) and handles all rate-limit resilience internally (serial queue + exponential backoff). When no API key is set, every method returns a deterministic offline result — mock embeddings use a hash-based vector generator that produces stable, normalised vectors so cosine similarity still works correctly in dev and test.

This invariant — "nothing else imports the SDK or opens a connection" — is enforced by code review and the PR checklist.

The `npm run seed` command bootstraps the platform with an admin account (`admin@example.com` / `admin12345`) and the full curated FAQ set with pre-computed embeddings. Because those embeddings were generated offline and stored in the seed JSON, search, duplicate detection, and the RAG chatbot all work immediately in mock mode — zero live AI calls needed.

### 3. The Request Pipeline (How a Request Moves Through the Server)

Every request follows a strict layered path: **Route → Controller → Service → Model/Boundary**.

- **Routes** define the HTTP method, path, and middleware chain. No business logic.
- **Controllers** extract request parameters, call the right service, and send the response. They never touch models or boundaries directly.
- **Services** contain all business logic — duplicate detection, gibberish checks, the RAG chatbot pipeline, solution marking. They talk to Mongoose models and the AI boundary.
- **Middleware** handles cross-cutting concerns: JWT verification, ban checks, rate limiting (three tiers: auth, AI, and general writes), file upload validation, and a central error handler.

### 4. The Centralised Config (`env.js` and `constants.js`)

All environment variables are loaded once at startup in `env.js`, which exports a frozen config object. No file in the codebase reads `process.env` directly. A **production safety guard** in this module refuses to start the server if JWT secrets are still set to their well-known dev defaults — so placeholder secrets can never silently secure a real deployment.

All tunable thresholds (duplicate similarity at 0.8, edit window at 15 minutes, LRU archive at 90 days, badge tiers, etc.) live in `constants.js`. Changing a behaviour means editing one file — no hunting for magic numbers.

### 5. The Testing Infrastructure (Fast, Isolated, Key-Free)

Tests use Jest + Supertest + `mongodb-memory-server`. Each suite gets its own ephemeral in-memory database, wiped between test cases for full isolation. The Express app is created via a `createApp()` factory that **never binds to a port** — Supertest injects HTTP requests directly, no real server needed.

The AI layer is automatically in mock mode because no API key is set in the test environment. No mocking library is needed — `ai.js` handles it natively.

Eleven test suites cover the application end-to-end: auth flows, query lifecycle, forum interactions, engagement (votes/bookmarks/likes), social features, FAQ CRUD, badge calculations, admin operations, security gates, and maintenance jobs.

### 6. The CI Pipeline (Lint → Test → Build)

A GitHub Actions workflow runs on every push and PR to `main`. It is the primary quality gate — nothing merges until it is green.

The three steps are sequential: **ESLint across all workspaces → Jest with in-memory Mongo and mocked AI → Vite production build**. No external services, no API keys, no database containers needed in CI. Setting `NODE_ENV=test` triggers three behaviours automatically: `morgan` logging is suppressed, rate limiting is skipped for determinism, and the AI layer operates in mock mode.

A second workflow (`deploy.yml`) re-runs the full verify gate and contains a **commented deployment block** — a template for building a Docker image and pushing it to a registry, ready to enable once the company provides hosting credentials.

### 7. Docker & Deployment

1. `docker-compose.yml` spins up MongoDB and the Express API with a single command. The Vite client is run separately via `npm run dev:client` because Vite's HMR is more useful outside a container. The server Dockerfile copies only the `package.json` files first for layer caching — dependencies are only reinstalled when they change — then copies the source, producing a lean Alpine-based image with only production dependencies.

The production deployment model is simple: the CI pipeline verifies the code, builds a Docker image tagged with the commit SHA, and the company's platform rolls it out. Environment variables (database URI, AI key, JWT secrets) are injected as repository secrets at deploy time.

A `GET /api/health` endpoint reports application status, database connection state, AI mode (mock or live), and uptime — suitable for Docker healthchecks and load-balancer probes.

### 8. Security Layers (Defence in Depth)

Security is not a single feature — it is layered across the entire stack:

- **Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` set on every response. `X-Powered-By` is removed.
- **CORS**: origin-gated to the configured client URL. Unknown origins are rejected before reaching any route.
- **Body limits**: JSON payloads capped at 1MB.
- **Upload validation**: MIME-type checked (images only), extensions derived from the MIME type (not the client-controlled filename), random filenames generated, served with headers that prevent execution as HTML or script.
- **Rate limiting**: three tiers for auth, AI, and general write endpoints, automatically skipped during tests for determinism.
- **Proxy trust**: configurable so rate-limit keying works correctly behind reverse proxies.
