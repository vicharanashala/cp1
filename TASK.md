# TASK.md

> **Living task tracker.** Active work, milestones, backlog, and anything discovered mid-process.
> Convention: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked. Add new items as they surface — never delete, mark done. Reference `PLANNING.md` for the *why*.

**Last updated:** 2026-05-29
**Current focus:** Milestone 5 — FAQ + Chatbot + Notifications (Milestones 1–4 complete & pushed)
**Build approach:** vertical slice — one complete end-to-end loop before going wide.

---

## Milestones (overview)

| # | Milestone | Theme | Status |
|---|---|---|---|
| 1 | Foundation | Workspaces, models, auth, CI, Docker | `[x]` |
| 2 | Ask a Query | AI showcase: intake + quality gates | `[x]` |
| 3 | Forum + Solution Engine | Answers, likes, resolution, points | `[x]` |
| 4 | Badges & Bans | Reputation + governance basics | `[x]` |
| 5 | FAQ + Chatbot + Notifications | RAG + knowledge promotion | `[ ]` |
| 6 | Admin | Dashboard + moderation tooling | `[ ]` |
| 7 | Maintenance crons | Scheduled jobs + manual triggers | `[ ]` |
| 8 | Polish & ship | Design, docs, deploy-ready | `[ ]` |

---

## Active work

> The handful of tasks being worked on right now. Pull from the milestone below as capacity frees up.

- [ ] _Milestones 1–4 complete — pull from Milestone 5_

---

## Milestone 1 — Foundation

Goal: a runnable skeleton with auth, models, green CI, and one-command startup.

- [x] Initialize monorepo workspaces (`client/`, `server/`) + root tooling
- [x] Configure ESLint (shared config) and base npm scripts (`lint`, `test`, `build`, `dev`)
- [x] `server/config/db.js` — single DB connection module (swappable boundary)
- [x] `server/config/ai.js` — single AI module stub with request queue + backoff scaffold (swappable boundary)
- [x] Define Mongoose models: users, refresh_tokens, queries, answers, notifications, moderation_queue, audit_log, faq_entries, likes, chatbot_sessions
- [x] JWT auth: access + refresh tokens; refresh-token hash store; bcrypt password hashing
- [x] Auth endpoints: register, login, refresh, logout (revoke refresh token)
- [x] Role/ban middleware: `auth`, `admin`, `banCheck`
- [x] React shell (Vite) + router + `AuthContext` + axios client with token refresh
- [x] `.github/workflows/ci.yml` — lint → test → build (green); `mongodb-memory-server` + mocked AI
- [x] `docker-compose.yml` — Express + Mongo + client, one-command run
- [x] Seed script skeleton (structure + offline embedding hook for later)

---

## Milestone 2 — Ask a Query (AI showcase)

Goal: the full quality-gated intake flow, the project's standout AI feature.

- [x] Query submission form: title, body (markdown), category, tags, anonymous toggle
- [x] Screenshot upload via Multer → local `uploads/`; served as static files
- [x] Optional `contact_email` context enrichment
- [x] Gibberish detection — Layer 1 heuristics (length, repeated chars, dictionary-word ratio)
- [x] Gibberish detection — Layer 2 AI escalation on borderline cases only (`flash-lite`)
- [x] Spam escalation wiring: increment `spam_flag_count`, apply 1st/2nd/5th/10th penalties
- [x] Auto-correct: opt-in "Check grammar" button → diff modal → preserve `original_body`
- [x] Embedding on create/edit via `ai.js`; cache (never re-embed unchanged text)
- [x] `vectorService.js` — in-app cosine similarity search
- [x] Duplicate detection: >80% match → warn → View existing / Post anyway (flag + queue)
- [x] Soft-delete for own queries
- [x] Query detail + list views

---

## Milestone 3 — Forum + Solution Engine

Goal: community answering loop with reputation rewards.

- [x] Post answers (markdown)
- [x] Like / upvote answers (one per user via `likes`)
- [x] Notifications on answer / like / accept / resolution
- [x] Solution Marking — Path A: author marks → 48h grace → points awarded
- [x] Solution Marking — Path B: no selection → auto-keep most-liked after 48h → no points
- [x] Prune extra answers (>3) on resolution; set status = resolved
- [x] Points system + leaderboard
- [x] Faulty-content reporting via report modal (queries + answers)
- [x] LRU access tracking on every view (`last_accessed_at`, `access_count`)
- [x] Solution finalization cron (daily) + manual trigger

---

## Milestone 4 — Badges & Bans

Goal: reputation made visible + first governance teeth.

- [x] Positive badges auto-award: Helper/Contributor/Expert/Legend (50/150/500/1000)
- [x] Negative badges admin-issued: Warning / Restricted / Suspended
- [x] 24h auto-ban for spam + live countdown banner
- [x] Manual ban / unban (admin)
- [x] Ban expiry cron (hourly) + manual trigger
- [x] Profile page showing points, badges, negative badges

---

## Milestone 5 — FAQ + Chatbot + Notifications

Goal: the knowledge surface + self-improving loop.

- [ ] FAQ accordion UI, category-organized
- [ ] FAQ keyword + semantic search
- [ ] Two-tier RAG chatbot: embed → Tier 1 FAQ → Tier 2 community Q&A → compose (`flash`)
- [ ] Chatbot citations + graceful fallback on no-match / 429
- [ ] Chatbot session persistence (`chatbot_sessions`)
- [ ] Resolved-Q&A → FAQ promotion (with `source`, `source_query_id`)
- [ ] Notifications: polling `unread-count` endpoint + notification panel/bell
- [ ] Personalized greeting banner (time-of-day + login streak)

---

## Milestone 6 — Admin

Goal: the control room.

- [ ] Admin dashboard (key metrics overview)
- [ ] FAQ manager (CRUD, sort order, mark outdated)
- [ ] Moderation queue (duplicates, reports, spam, outdated, gibberish flags)
- [ ] Query amalgamation: AI groups similar queries → admin merge into canonical thread
- [ ] Merge action (combine) / dismiss (keep both) for flagged duplicates
- [ ] User management (roles, bans, badges)
- [ ] Audit log viewer
- [ ] Maintenance page with manual triggers for every cron job

---

## Milestone 7 — Maintenance crons

Goal: wire all scheduled jobs + deletion-with-audit.

- [ ] LRU eviction (daily) — archive resolved queries unaccessed 90+ days; auto-unarchive on access
- [ ] Badge recalculation (daily)
- [ ] Staleness check (weekly) — flag outdated answers
- [ ] Orphan cleanup (weekly) — remove orphaned likes/sessions
- [ ] Embedding refresh (weekly) — re-embed updated content
- [ ] Soft-delete purge (monthly) — hard-delete items soft-deleted >30 days, with audit
- [ ] Confirm every job is a plain function + admin-triggerable

---

## Milestone 8 — Polish & ship

Goal: portfolio-grade, reproducible, demo-ready.

- [ ] Design system pass (consistent components, theme)
- [ ] Mobile responsiveness
- [ ] `express-rate-limit` on sensitive/expensive endpoints
- [ ] Consistent error handling + graceful AI degradation everywhere
- [ ] Seed full demo dataset with offline-embedded content (zero live AI on browse)
- [ ] README (run instructions, features, MVP/swappable note, demo video)
- [ ] CONTRIBUTING (commit + PR rules)
- [ ] `.github/` PR + issue templates
- [ ] Confirm LICENSE before publishing
- [ ] Deploy workflow with commented deploy block (enable on company creds)
- [ ] Rehearse + record ~8-min demo loop (see PLANNING §13 / demo strategy)

---

## Backlog (post-MVP / nice-to-have)

- [ ] Pluggable AI-provider interface (beyond Gemini)
- [ ] Dedicated vector index for large corpora (swap `vectorService.js`)
- [ ] Object-storage adapter for uploads
- [ ] WebSocket option for real-time notifications
- [ ] Internationalization (i18n)

---

## Discovered during work

> Anything found mid-process that wasn't in the original plan: bugs, edge cases, refactors, decisions to revisit. Date each entry.

- _none yet_

---

## Demo loop checklist (rehearsal)

The ~8-minute path that touches nearly every feature:

- [ ] Register → personalized greeting
- [ ] Ask a question → gibberish caught → auto-correct suggests fix → duplicate warning fires → attach screenshot
- [ ] Second user answers → like → mark resolved → points + badge appear → leaderboard updates
- [ ] Switch to admin → dashboard → moderation queue → merge duplicate → ban spammer (countdown banner)
- [ ] Push resolved Q&A into FAQ → chatbot answers via RAG
- [ ] Trigger LRU / staleness jobs on a click
- [ ] Finish on the green GitHub Actions tab
