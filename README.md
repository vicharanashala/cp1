# FAQ Platform

A self-contained **MERN** knowledge platform that unifies the full knowledge lifecycle: an AI chatbot over a curated FAQ, structured query intake with quality gates, and a community Q&A forum whose best answers are promoted back into the canonical FAQ. Automation keeps the knowledge base clean (duplicate detection, gibberish filtering, staleness checks, LRU archival); a reputation system rewards good contributors and a governance layer handles bad ones.

> **The goal:** a knowledge base that *improves itself over time* instead of decaying.

Built as an internship project — open-source, **zero paid infrastructure**, with the externally-dependent pieces (AI model, database, hosting) isolated behind swappable modules so the company can drop in its own production infrastructure later.

---

## Features

| Pillar | What it does |
|---|---|
| **General FAQ + AI Chatbot** | Category-organized FAQ with keyword + semantic search, fronted by a two-tier RAG chatbot (FAQ → community Q&A → AI compose). |
| **Ask a Query** | Structured intake with gibberish detection, opt-in auto-correction, duplicate detection, and context enrichment (email, screenshots). |
| **Q&A Forum** | Community answering, up/down voting (questions & answers), threaded comments, bookmarks, and resolution, with reputation rewards. |
| **Solution Marking Engine** | Promotes the best community answers and resolved threads into the canonical FAQ. |
| **Reputation** | Points, leaderboard, tiered positive badges, admin-issued negative badges. |
| **Moderation & Governance** | Moderation queue, bans, soft-delete + audit log, reporting. |
| **Automated Maintenance** | Scheduled jobs (LRU eviction, staleness, orphan cleanup, soft-delete purge) — each also triggerable from the admin panel. |

> **UI:** the client follows the **"Frozen Precision"** light design system (Inter, glacial-blue palette, hairline surfaces) in a left-sidebar app shell — a personalized home dashboard (reputation ring, streak, recent activity), Markdown-rendered threads, an admin telemetry overview, plus a personal Settings page. The reference design kit lives in [`FrontendReference/`](./FrontendReference). _(Screenshots TODO — run `npm run dev` to preview.)_

---

## Tech stack

- **Frontend:** React (Vite), React Router, Axios
- **Backend:** Node.js, Express (REST + JWT)
- **Database:** MongoDB + Mongoose
- **AI:** Google Gemini free tier via `@google/genai` (`gemini-2.5-flash` for chat, `flash-lite` for cheap checks, `gemini-embedding-001` @ 768 dims)
- **Vector search:** in-app cosine similarity over embeddings stored in MongoDB
- **Scheduler:** `node-cron`
- **Testing/CI:** Jest, Supertest, `mongodb-memory-server`, ESLint, GitHub Actions

See [`PLANNING.md`](./PLANNING.md) for full architecture and rationale, and [`TASK.md`](./TASK.md) for the milestone tracker.

---

## Repository layout

```
.
├── client/        # React (Vite) frontend
├── server/        # Express API
│   ├── config/    # db.js, ai.js  ← swappable boundaries
│   ├── models/    # Mongoose schemas
│   ├── routes/ controllers/ services/ middleware/ jobs/
│   └── uploads/   # Multer local disk storage
├── .github/workflows/ci.yml
├── docker-compose.yml
├── PLANNING.md
└── TASK.md
```

### Swappable boundaries
Two modules are the *only* touchpoints for externally-dependent integrations, so swapping in the company's production infrastructure is a configuration change, not a refactor:

- `server/config/db.js` — the only place that knows the database connection.
- `server/config/ai.js` — the only place that calls the AI provider (chat, cheap calls, embeddings); also houses the request queue + backoff.

---

## Getting started

This is an npm-workspaces monorepo. Dependencies are isolated per workspace in local `node_modules` (the Node equivalent of a virtual environment) — nothing is installed globally.

### Prerequisites
- Node.js ≥ 20
- MongoDB (local, or via the bundled Docker Compose)

### 1. Install
```bash
npm install        # installs root + all workspaces
```

### 2. Configure
```bash
cp .env.example .env
# edit .env — set MONGODB_URI, JWT secrets. Leave AI_API_KEY empty to run AI in mock mode.
```

### 3. Run (local)
```bash
npm run dev        # starts Express (:5000) and Vite (:5173) together
```

### Or run with Docker Compose (one command, reproducible)
```bash
docker compose up --build
```

### Useful scripts
| Command | Description |
|---|---|
| `npm run dev` | Run server + client in watch mode |
| `npm run lint` | Lint all workspaces |
| `npm test` | Run server tests (in-memory Mongo, mocked AI) |
| `npm run build` | Build the client for production |
| `npm run seed` | Seed the database with demo data |

---

## AI & cost model

The MVP runs on the Gemini **free tier** with no billing enabled, so over-quota requests return rate-limit errors — never a bill. The system is built to minimize and survive AI calls: heuristic-first gibberish detection, opt-in auto-correct, cached embeddings, seeded offline embeddings for demo content, a request queue with exponential backoff, and graceful degradation everywhere. Set `AI_API_KEY` to enable live calls; leave it empty to run in mock mode.

> The AI provider, database, and hosting are deliberately swappable. Production should use the company's own keys/tier per its data-governance policy.

---

## Demo

`npm run seed` loads a self-consistent, **offline-embedded** dataset (FAQ entries, questions, a resolved-and-promoted thread, reputation) so you can explore every feature with no live AI calls.

Seed accounts (password in parentheses):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin12345` |
| User | `demo@example.com` | `demo12345` |
| User | `alex@example.com` | `alex12345` |
| User | `sam@example.com` | `sam12345` |

A scripted ~8-minute walkthrough touching nearly every feature lives in the **Demo loop checklist** at the bottom of [`TASK.md`](./TASK.md): register → ask a question (quality gates fire) → answer → resolve → reputation/badges → admin moderation/merge/ban → FAQ promotion → RAG chatbot → trigger a maintenance job → finish on the green CI tab.

> Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE) © 2026 vicharanashala
