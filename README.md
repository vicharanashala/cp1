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
| **FAQ + AI Chatbot** | Category-organized FAQ with hybrid keyword + semantic search. Both the **search bar** and the **AI chatbot** answer from the FAQ first and **ask before checking the community forum** — if there's no FAQ match they prompt *"Not in the FAQ — do you want me to check the forum?"* and only search the forum (then redirect to the matching thread) once you say yes. |
| **Ask a Query** | Structured intake with gibberish detection, opt-in grammar auto-correction, duplicate detection, **admin-curated categories/tags** (users pick from the list or "Others" — no free-form tagging), a required **joining date** and **contact email**, and screenshots. Posting is always attributed — **no anonymous posting**. |
| **Q&A Forum** | A support-ticket model: any member answers (but **not on their own question**); only the poster — or a moderator/admin — rates/closes answers, and discussion stays poster ↔ answerer (no peer voting or cross-talk). Question voting, bookmarks, full-text + semantic **forum search**, and reporting included; resolved questions sink to the bottom of the list. |
| **Solution Marking Engine** | The poster (or a moderator/admin) marks an answer "helpful" to close the thread; **admins can mark an answer "Admin Verified"**; resolved, high-value threads can be promoted into the canonical FAQ. |
| **Reputation & Badges** | Points, tiered reputation badges (shown under each author's name in the forum), an **Admin Verified** badge, admin-awarded custom badges, and admin-issued moderation flags. |
| **Admin & Governance** | A telemetry dashboard, moderation queue, duplicate merge, a **moderators roster**, **15-minute rollback** of deletions, **admin-curated taxonomy**, bans/roles, full badge control, FAQ management (with a **duplicate guard**), and an audit log. |
| **Automated Maintenance** | Scheduled jobs (LRU archival, staleness checks, orphan cleanup, soft-delete purge, badge recalc, embedding refresh) — each also triggerable from the admin panel. |

> **Access:** the whole app sits behind a login gate — visitors land on a sign-in / sign-up screen and are taken into the app only after authenticating.

---

## How Curio handles **queries**

A query moves through a clear lifecycle, with quality gates at the front door so the community only ever sees real, well-formed questions.

**1. Intake & quality gates** — when a member asks a question:
- **Gibberish detection** — a fast heuristic (word-likeness scoring) blocks nonsense submissions; borderline cases escalate to an AI check. Blocked attempts count as spam strikes.
- **Grammar assist** — an opt-in "Check grammar" pass cleans up spelling/clarity *without changing meaning*; the original text is preserved.
- **Duplicate detection** — the question is embedded and compared (cosine similarity) against existing ones. Above the similarity threshold the user is shown the likely duplicate and can either jump to it or **post anyway** (which flags it for moderator review rather than silently rejecting).
- **Context** — a **category and tags chosen from an admin-curated list** (users can't invent their own; an "Others" tag covers the gaps), a **required joining date and contact email**, and screenshots. Posting is **never anonymous** — every question is attributed to its author.

**2. The forum & resolution** — once posted, a query is **Open**:
- Any logged-in member can post an **answer** (Markdown supported), flipping the question to **Answered** — **except the asker, who can't answer their own question**.
- **Support-ticket interaction model — no user ↔ user cross-talk.** The forum is a conversation between a member and the **question poster**, not a free-for-all: only the **poster** (or a moderator/admin) can rate answers, and discussion under an answer is limited to the **poster and that answer's own author**. Other members can read and answer, but can't vote on or comment on each other's answers. (Questions themselves can still be up/down voted, bookmarked, and reported — reporting opens a short reason form.)
- The poster (or a **moderator/admin**) marks the best answer **"User found helpful,"** which **closes the question for answers**, records it as the solution, and rewards the answerer; un-marking reopens the thread.
- **Admin verification** — an admin can mark any answer **"Admin Verified."** Verified answers are pinned to the top of the thread and earn their author the persistent **Admin Verified** badge.
- **Editing window** — authors can edit their own question or answer for **15 minutes** after posting; afterwards the content is locked.
- **Escalation:** a member holding the **Expert** badge — or any **moderator** — can flag a question as **"Needs admin attention,"** routing it to the admin attention queue.
- **Browsing & search** — the forum list keeps unanswered questions up top and **sinks resolved ones to the bottom**; questions are searchable (keyword + semantic). The knowledge-base search and the chatbot only reach into the forum **after the user opts in** (see *Finding answers* below) — the forum is never silently mixed into FAQ results.
- **Attachments** — screenshots are shown as "*N attachments added — click to view*" and open in an in-app **zoomable viewer** (no forced downloads).
- Resolved, high-value threads can be **promoted into the FAQ**, turning a one-off answer into permanent, searchable knowledge.

**3. Status lifecycle:** `Open → Answered → Resolved → (Archived)`. Unused resolved threads are LRU-archived over time and quietly un-archived the moment someone opens them again. If an answer is later deleted (including by a moderator/admin), the thread's status is **automatically reconciled** — a question never shows as "resolved" once it has no answers left, and a deleted accepted answer clears the solution. Deletions are **reversible by an admin or moderator for 15 minutes** via the admin Rollback view.

---

## How Curio helps you **find answers**

The FAQ is always the first place we look — and we only reach into the community forum **with your permission**. The search bar and the chatbot follow the same two-step contract:

**FAQ search bar** (the *Browse FAQs* page)
1. As you type, Curio searches the **curated FAQ** semantically and shows matching entries.
2. If nothing matches, the page asks: **"Not in the FAQ — do you want me to check in the forum?"** with a **Yes, check the forum** button. The forum database is *not* touched until you click it.
3. On **Yes**, Curio searches the community forum and lists matching questions; clicking one **redirects you to that forum thread**. If the forum has nothing either, it points you to *raise a query*.

**AI chatbot** (the floating assistant)
1. The assistant answers from the **FAQ first** and cites the FAQ entry it used.
2. If the FAQ has no confident answer, it does **not** silently search the forum — it replies *"I couldn't find this in the FAQ. Do you want me to check the community forum?"* with **Yes / No** buttons.
3. On **Yes**, it searches the resolved community Q&A and, on a match, **redirects you to the forum thread** (a clickable citation). On **No**, it stays put and suggests browsing the FAQ or raising a query.

This keeps FAQ answers authoritative and makes any jump into community-sourced content an explicit, opt-in choice. Under the hood the chatbot's `/api/chatbot/ask` accepts a `check_forum` flag: the first call returns `source_tier: "await_forum"`, and the follow-up with `check_forum: true` returns the `community` match (or a `fallback`).

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
| 🥉 **Helper** | 30 pts |
| 🥈 **Contributor** | 100 pts |
| 🥇 **Expert** | 200 pts |
| 🏆 **Legend** | 300 pts |

Every profile shows the **full badge catalog** (earned vs. locked, with the points needed) plus a reputation tier and progress toward the next tier. The **highest badge a member holds is shown under their name** throughout the forum, so good contributors are visible where they contribute.

**Admin-controlled badges** (see below) layer on top of the automatic ones:
- **Admin Verified** ✅ — granted automatically to a member when an admin marks one of their answers "Admin Verified"; the badge is kept even if the answer is later unverified.
- **Custom badges** — admins can *create and award* a free-form badge (name + icon + reason) and *revoke* it later.
- **Moderation flags** — ⚠️ Warning, 🚫 Restricted, ☠️ Suspended — issued and revoked by admins to govern behavior. Restriction gates a user behind post-approval; suspension bans them.

**Becoming a moderator** — when a member reaches the **Expert** tier they're notified that they can **apply to moderate**, and can send a request from their Settings. **Admins decide** who actually becomes a moderator (and can grant or revoke it for anyone, regardless of badge tier). A **moderator** can delete/restore queries and answers, **mark answers helpful**, **escalate questions for admin attention**, and **re-categorise/re-tag** a question from the forum — without the full admin toolkit.

---

## How **admins** manage everything, seamlessly

Admins get a dedicated dashboard and inline controls across the app — moderation is always one click from where the content lives.

**Dashboard & insight**
- **System overview** — live KPIs (users, open questions, resolution rate, moderation load, AI status).
- **Needs Attention** — actionable cards (**questions escalated for admin attention**, flagged content, pending approvals, open questions) that deep-link straight to the work.
- **Queries by Category** — central grouping of all technical queries by topic with open / answered / resolved counts and deep links.
- **Attention queue** — questions escalated by Expert members/moderators, grouped by category; the queue lists each asker **by their email id** — click an email to open the question.
- **Audit log** — every privileged action is recorded and reviewable.
- **Quieter notifications** — admins don't get pinged for routine answer/like/comment activity (they moderate, not farm reputation).

**Content & community control**
- **Moderation queue** — review reported/flagged/duplicate items; resolve or dismiss.
- **Duplicate merge & amalgamation** — merge a duplicate into its canonical thread (answers move over automatically), or cluster related questions for review.
- **Inline powers in the forum** — verify answers, mark helpful, re-categorise/re-tag, and delete right where the content lives.
- **Approve any answer as the solution** — not just the asker; admins can mark the accepted answer on any thread.
- **Delete any query or answer** — with automatic status reconciliation, plus a **15-minute Rollback** view to restore anything deleted by mistake (by anyone).
- **Categories & Tags** — curate the category and tag lists that users may choose from.
- **FAQ management** — create, edit, mark-outdated, or delete FAQ entries (with a **near-duplicate guard** that warns before adding a FAQ that already exists), and promote resolved threads into the FAQ.

**People & reputation**
- **Bans** (timed or permanent) and **role management** (promote/demote admins).
- **Moderators** — grant or revoke moderator access for any user (independent of badge tier); pending Expert requests are flagged in the user list, and a dedicated **Moderators roster** lists everyone with moderation powers.
- **Full badge control** — verify answers, award custom badges, and revoke custom or moderation badges.
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

`npm run seed` starts the platform from a clean slate — a single admin account plus the curated, **offline-embedded** FAQ set, so search and the RAG chatbot work with zero live AI calls. There are no demo users, points, or forum questions; everyone else self-registers and the forum fills up organically.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@example.com` | `admin12345` |

A scripted ~8-minute walkthrough lives in the **Demo loop checklist** at the bottom of [`TASK.md`](./TASK.md): register → ask a question (quality gates fire) → answer → resolve → reputation/badges → admin moderation/merge/ban → FAQ promotion → RAG chatbot → trigger a maintenance job.

> Contributions welcome — see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE) © 2026 vicharanashala
