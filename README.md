<div align="center">

# CURIO

### A knowledge base that improves itself.

*Ask. Answer. Resolve. Promote. — the full knowledge lifecycle in one MERN platform.*

</div>

---

## What is Curio?

**Curio** is a self-contained community knowledge platform that unifies everything a team needs to capture and grow its collective knowledge:

- a **curated FAQ** fronted by an **AI chatbot**,
- a **structured query intake** that gates out noise before it ever reaches the community,
- a **Q&A forum** where members answer each other, vote, and discuss, and
- a **reputation + governance layer** that rewards good contributors and keeps the knowledge base clean automatically.

The big idea: instead of a wiki that **decays** as it ages, Curio is a knowledge base that **improves itself over time** — the best community answers are promoted back into the canonical FAQ, duplicates are merged, stale content is flagged, and unused threads are archived, all without manual gardening.

Built as an open-source internship project with **zero paid infrastructure**: the externally-dependent pieces (AI model, database, hosting) are isolated behind swappable modules so production infrastructure can be dropped in later as a config change.

---

## Feature overview

| Pillar | What it does |
|---|---|
| **FAQ + AI Chatbot** | Category-organized FAQ with hybrid keyword + semantic search, fronted by a two-tier RAG chatbot (FAQ → resolved community threads → AI compose). |
| **Ask a Query** | Structured intake with gibberish detection, opt-in grammar auto-correction, duplicate detection, categories/tags, optional anonymity, screenshots, and contact email. |
| **Q&A Forum** | Any member can answer; up/down voting on questions **and** answers, threaded comments, bookmarks, reporting, and resolution. |
| **Solution Marking Engine** | The asker (or an admin) accepts the best answer; resolved, high-value threads are promoted into the canonical FAQ. |
| **Reputation & Badges** | Points, leaderboard, tiered reputation badges, admin-awarded custom badges, and admin-issued moderation flags. |
| **Admin & Governance** | A telemetry dashboard, moderation queue, duplicate merge, bans/roles, full badge control, FAQ management, and an audit log. |
| **Automated Maintenance** | Scheduled jobs (LRU archival, staleness checks, orphan cleanup, soft-delete purge, badge recalc, embedding refresh) — each also triggerable from the admin panel. |

> **Access:** the whole app sits behind a login gate — visitors land on a sign-in / sign-up screen and are taken into the app only after authenticating.

---

## How Curio handles **queries**

A query moves through a clear lifecycle, with quality gates at the front door so the community only ever sees real, well-formed questions.

**1. Intake & quality gates** — when a member asks a question:
- **Gibberish detection** — a fast heuristic (word-likeness scoring) blocks nonsense submissions; borderline cases escalate to an AI check. Blocked attempts count as spam strikes.
- **Grammar assist** — an opt-in "Check grammar" pass cleans up spelling/clarity *without changing meaning*; the original text is preserved.
- **Duplicate detection** — the question is embedded and compared (cosine similarity) against existing ones. Above the similarity threshold the user is shown the likely duplicate and can either jump to it or **post anyway** (which flags it for moderator review rather than silently rejecting).
- **Context** — category, tags, optional anonymity, screenshots, and a contact email can be attached.

**2. The forum & resolution** — once posted, a query is **Open**:
- Any logged-in member can post an **answer** (Markdown supported). The first answer flips the status to **Answered**.
- Questions and answers both support **up/down voting**; answers can have **threaded comments**; members can **bookmark** questions and **report** bad content.
- The **Solution Marking Engine** lets the question's author — *or an admin* — accept an answer as the solution. This starts a short grace period, after which the thread is finalized as **Resolved** and the answerer is rewarded.
- The asker can also mark any answer **"User found helpful"** — a lighter endorsement, separate from the single accepted solution, that stays attached to the thread.
- **Escalation:** a member holding the **Expert** badge can flag a question as **"Needs admin attention,"** routing it to the admin attention queue.
- Resolved, high-value threads can be **promoted into the FAQ**, turning a one-off answer into permanent, searchable knowledge.

**3. Status lifecycle:** `Open → Answered → Resolved → (Archived)`. Unused resolved threads are LRU-archived over time and quietly un-archived the moment someone opens them again. If an answer is later deleted (including by an admin), the thread's status is **automatically reconciled** — a question never shows as "resolved" once it has no answers left, and a deleted accepted answer clears the solution.

---

## How Curio handles **badges & reputation**

Reputation is earned, not given — and it drives the badge system.

**Points are awarded for real contribution:**

| Action | Points |
|---|---|
| Your answer is **accepted** as the solution | **+15** |
| Your answer is **upvoted** | **+2** each |

> Points reward **answering**, not asking — posting or resolving your own question earns nothing. Downvotes never deduct an author's points (no griefing), and you can't vote on or accept your own content.

**Reputation badges** unlock automatically as points accumulate:

| Badge | Unlocks at |
|---|---|
| 🥉 **Helper** | 50 pts |
| 🥈 **Contributor** | 150 pts |
| 🥇 **Expert** | 500 pts |
| 🏆 **Legend** | 1000 pts |

Every profile shows the **full badge catalog** (earned vs. locked, with the points needed) plus a reputation tier and progress toward the next tier. A **leaderboard** ranks the top contributors.

**Admin-controlled badges** (see below) layer on top of the automatic ones:
- **Custom badges** — admins can *create and award* a free-form badge (name + icon + reason) and *revoke* it later.
- **Moderation flags** — ⚠️ Warning, 🚫 Restricted, ☠️ Suspended — issued and revoked by admins to govern behavior. Restriction gates a user behind post-approval; suspension bans them.

---

## How **admins** manage everything, seamlessly

Admins get a dedicated dashboard and inline controls across the app — moderation is always one click from where the content lives.

**Dashboard & insight**
- **System overview** — live KPIs (users, open questions, resolution rate, moderation load, AI status).
- **Needs Attention** — actionable cards (flagged content, pending approvals, open questions) that deep-link straight to the work.
- **Queries by Category** — central grouping of all technical queries by topic with open / answered / resolved counts and deep links.
- **Attention queue** — questions escalated by Expert members, grouped by category and ordered by posting date then the asker's joining date; clear each once handled.
- **Audit log** — every privileged action is recorded and reviewable.

**Content & community control**
- **Moderation queue** — review reported/flagged/duplicate items; resolve or dismiss.
- **Duplicate merge & amalgamation** — merge a duplicate into its canonical thread (answers move over automatically), or cluster related questions for review.
- **Approve any answer as the solution** — not just the asker; admins can mark the accepted answer on any thread.
- **Delete any query or answer** — with automatic status reconciliation so threads never end up in an inconsistent state.
- **FAQ management** — create, edit, mark-outdated, or delete FAQ entries, and promote resolved threads into the FAQ.

**People & reputation**
- **Bans** (timed or permanent) and **role management** (promote/demote admins).
- **Full badge control** — award custom badges, and revoke custom or moderation badges.
- **Self-moderation guard** — admins cannot ban, suspend, or badge **their own** account; the controls are hidden on your own profile and disabled on your own row.

**Automation** — six scheduled maintenance jobs (LRU archival, staleness checks, orphan cleanup, soft-delete purge, badge recalculation, embedding refresh) run on a cron schedule and can also be triggered on demand from the admin panel.

---

## Tech stack

- **Frontend:** React (Vite), React Router, Axios — a left-sidebar app shell in the "Frozen Precision" light design system (Inter type, glacial-blue palette), with Markdown-rendered threads and a personalized home dashboard.
- **Backend:** Node.js, Express (REST + JWT with access/refresh rotation)
- **Database:** MongoDB + Mongoose
- **AI:** Google Gemini free tier via `@google/genai` (`gemini-2.5-flash` chat, `flash-lite` cheap checks, `gemini-embedding-001` @ 768 dims). Runs in deterministic **mock mode** offline when no key is set.
- **Vector search:** in-app cosine similarity over embeddings stored in MongoDB
- **Scheduler:** `node-cron`
- **Testing/CI:** Jest, Supertest, `mongodb-memory-server`, ESLint, GitHub Actions

See [`PLANNING.md`](./PLANNING.md) for full architecture and [`TASK.md`](./TASK.md) for the milestone tracker.

---

## Getting started

This is an npm-workspaces monorepo — dependencies are isolated per workspace in local `node_modules`, nothing global.

**Prerequisites:** Node.js ≥ 20, and MongoDB (local or via the bundled Docker Compose).

```bash
npm install                 # install root + all workspaces
cp .env.example .env        # set MONGODB_URI + JWT secrets; leave AI_API_KEY empty for mock mode
npm run seed                # load the offline demo dataset (incl. the imported FAQ set)
npm run dev                 # Express on :5000, Vite on :5173
```

Or run everything with one reproducible command:

```bash
docker compose up --build
```

**Useful scripts**

| Command | Description |
|---|---|
| `npm run dev` | Server + client in watch mode |
| `npm run lint` | Lint all workspaces |
| `npm test` | Server tests (in-memory Mongo, mocked AI) |
| `npm run build` | Production client build |
| `npm run seed` | Seed demo data + import FAQs |

### Swappable boundaries
Two modules are the *only* touchpoints for external infrastructure, so swapping in production services is configuration, not a refactor:
- `server/config/db.js` — the single place that knows the database connection.
- `server/config/ai.js` — the single place that calls the AI provider (chat, cheap calls, embeddings) + the request queue and backoff.

---

## Demo

`npm run seed` starts the platform from a clean slate — a single admin account plus the curated, **offline-embedded** FAQ set, so search and the RAG chatbot work with zero live AI calls. There are no demo users, points, or forum questions; everyone else self-registers and the forum/leaderboard fill up organically.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin12345` |

A scripted ~8-minute walkthrough lives in the **Demo loop checklist** at the bottom of [`TASK.md`](./TASK.md): register → ask a question (quality gates fire) → answer → resolve → reputation/badges → admin moderation/merge/ban → FAQ promotion → RAG chatbot → trigger a maintenance job.

> Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE) © 2026 vicharanashala
