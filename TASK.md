# TASK.md

> **Living task tracker.** Active work, milestones, backlog, and anything discovered mid-process.
> Convention: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked. Add new items as they surface — never delete, mark done. Reference `PLANNING.md` for the *why*.

**Last updated:** 2026-05-30
**Current focus:** Phase 2 — "Frozen Precision" frontend redesign + the backend features it implies (Milestones 9–14). MVP (1–8) shipped.
**Build approach:** vertical slice — one complete end-to-end loop before going wide. Phase 2 ships **one milestone per PR**, pushed cleanly, implemented only with the maintainer's go-ahead.

---

## Milestones (overview)

| # | Milestone | Theme | Status |
|---|---|---|---|
| 1 | Foundation | Workspaces, models, auth, CI, Docker | `[x]` |
| 2 | Ask a Query | AI showcase: intake + quality gates | `[x]` |
| 3 | Forum + Solution Engine | Answers, likes, resolution, points | `[x]` |
| 4 | Badges & Bans | Reputation + governance basics | `[x]` |
| 5 | FAQ + Chatbot + Notifications | RAG + knowledge promotion | `[x]` |
| 6 | Admin | Dashboard + moderation tooling | `[x]` |
| 7 | Maintenance crons | Scheduled jobs + manual triggers | `[x]` |
| 8 | Polish & ship | Design, docs, deploy-ready | `[x]` |
| — | **Phase 2 — Frozen Precision redesign** | _frontend parity + the backend it implies_ | |
| 9 | Design system & app shell | Light theme tokens + sidebar shell (FE) | `[x]` |
| 9 | Design system & app shell | Light theme tokens + sidebar shell (FE) | `[ ]` |
| 10 | Home & FAQ re-skin | Dashboard + FAQ to reference (FE) | `[ ]` |
| 11 | Forum & thread re-skin | Filters/sort/pagination + Markdown (FE) | `[ ]` |
| 12 | Admin dashboard re-skin | KPIs + needs-attention + audit feed (FE) | `[ ]` |
| 13 | Engagement backend | Votes, bookmarks, answer counts (BE+FE) | `[ ]` |
| 14 | Activity/comments/settings | Feed, replies, settings, avatars (BE+FE) | `[ ]` |

---

## Active work

> The handful of tasks being worked on right now. Pull from the milestone below as capacity frees up.

- [x] _All milestones complete — only the manual demo-video recording remains_

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

- [x] FAQ accordion UI, category-organized
- [x] FAQ keyword + semantic search
- [x] Two-tier RAG chatbot: embed → Tier 1 FAQ → Tier 2 community Q&A → compose (`flash`)
- [x] Chatbot citations + graceful fallback on no-match / 429
- [x] Chatbot session persistence (`chatbot_sessions`)
- [x] Resolved-Q&A → FAQ promotion (with `source`, `source_query_id`)
- [x] Notifications: polling `unread-count` endpoint + notification panel/bell
- [x] Personalized greeting banner (time-of-day + login streak)

---

## Milestone 6 — Admin

Goal: the control room.

- [x] Admin dashboard (key metrics overview)
- [x] FAQ manager (CRUD, sort order, mark outdated)
- [x] Moderation queue (duplicates, reports, spam, outdated, gibberish flags)
- [x] Query amalgamation: AI groups similar queries → admin merge into canonical thread
- [x] Merge action (combine) / dismiss (keep both) for flagged duplicates
- [x] User management (roles, bans, badges)
- [x] Audit log viewer
- [x] Maintenance page with manual triggers for every cron job

---

## Milestone 7 — Maintenance crons

Goal: wire all scheduled jobs + deletion-with-audit.

- [x] LRU eviction (daily) — archive resolved queries unaccessed 90+ days; auto-unarchive on access
- [x] Badge recalculation (daily)
- [x] Staleness check (weekly) — flag outdated answers
- [x] Orphan cleanup (weekly) — remove orphaned likes/sessions
- [x] Embedding refresh (weekly) — re-embed updated content
- [x] Soft-delete purge (monthly) — hard-delete items soft-deleted >30 days, with audit
- [x] Confirm every job is a plain function + admin-triggerable

---

## Milestone 8 — Polish & ship

Goal: portfolio-grade, reproducible, demo-ready.

- [x] Design system pass (consistent components, theme) — focus states, transitions, cohesive dark theme
- [x] Mobile responsiveness — nav wrap, stacked headers, horizontally-scrollable admin tables
- [x] `express-rate-limit` on sensitive/expensive endpoints — auth, AI, and new `writeLimiter` on content writes
- [x] Consistent error handling + graceful AI degradation everywhere — central error middleware; AI mock/backoff/fallback
- [x] Seed full demo dataset with offline-embedded content (zero live AI on browse)
- [x] README (run instructions, features, MVP/swappable note, demo accounts + demo loop)
- [x] CONTRIBUTING (commit + PR rules)
- [x] `.github/` PR + issue templates
- [x] Confirm LICENSE before publishing — MIT present
- [x] Deploy workflow with commented deploy block (enable on company creds)
- [ ] Rehearse + record ~8-min demo loop — **manual step** (script ready in the checklist below; recording is a human task)

---

# Phase 2 — "Frozen Precision" redesign (Milestones 9–14)

> Added 2026-05-30 after studying the `FrontendReference/` "Frozen Precision" Stitch design kit. Full gap analysis lives in **`FRONTEND_GAP_REPORT.md`**. The reference is the source of truth for UI/UX.
>
> **Rules for this phase:** each milestone is **one clean PR** off `main`, pushed and opened for review; work begins only with the maintainer's explicit go-ahead, one milestone at a time. Frontend re-skin milestones (9–12) rely solely on **existing APIs**; backend milestones (13–14) add new endpoints and wire them into the already-re-skinned UI. Every PR must keep `lint` / `test` / `build` green. Commits: Conventional Commits w/ scope, no Co-Authored-By trailer.

## Milestone 9 — Design system & app shell

Goal: the light "Frozen Precision" foundation everything else builds on. **Frontend-only.**

- [x] Add **Inter** + port `DESIGN.md` tokens (color palette, 8px spacing rhythm, radii, type scale) into `styles.css`; switch dark → light theme
- [x] Button variants (primary solid / secondary outline / ghost), 1px-hairline cards, input focus glow, chips/tags per spec
- [x] **Left-sidebar app shell** (brand "Knowledge Hub" header; nav: Home / FAQ / Ask a Query / Forum / Leaderboard / Profile; footer: Settings / Support) wrapping all routes
- [x] Top bar: global search field, notification bell, user avatar (initials)
- [x] "+ New Entry" sidebar button → `/ask`; Settings / Support placeholder routes
- [x] Preserve existing features under the new shell (chatbot widget, ban banner); responsive (sidebar collapses on mobile)
- [ ] Add **Inter** + port `DESIGN.md` tokens (color palette, 8px spacing rhythm, radii, type scale) into `styles.css`; switch dark → light theme
- [ ] Button variants (primary solid / secondary outline / ghost), 1px-hairline cards, input focus glow, chips/tags per spec
- [ ] **Left-sidebar app shell** (brand "Knowledge Hub" header; nav: Home / FAQ / Ask a Query / Forum / Leaderboard / Profile; footer: Settings / Support) wrapping all routes
- [ ] Top bar: global search field, notification bell, user avatar (initials)
- [ ] "+ New Entry" sidebar button → `/ask`; Settings / Support placeholder routes
- [ ] Preserve existing features under the new shell (chatbot widget, ban banner); responsive (sidebar collapses on mobile)

## Milestone 10 — Home dashboard & FAQ re-skin

Goal: match the reference Home + FAQ screens. **Frontend-only (existing APIs).**

- [ ] Home: three action cards — Ask the Assistant / Browse the FAQ / Ask the Community
- [ ] Home: reputation ring (points) + level & "pts to next tier" **derived client-side** from badge thresholds; streak chip in the header
- [ ] Home: recent-badges strip (from the current user's profile)
- [ ] FAQ: category accordions with **article counts**; "PROMOTED FROM Q&A" tag (`source === 'qa'`); per-category "view all"; semantic-search indicator
- [ ] FAQ: "Still can't find it? → **Open a Ticket**" CTA → `/ask`
- [ ] _Recent Activity feed deferred to M14 (needs backend)_

## Milestone 11 — Forum list & question thread re-skin

Goal: match Community Discussions + Question Thread. **Frontend (existing APIs) + Markdown.**

- [ ] Forum list: filter dropdowns (category / tag / status — already supported by `listQueries`), "Newest First" sort, **pagination control** (`total/page/limit` already returned)
- [ ] Forum list: card layout with status badge, body excerpt, author initials + relative time
- [ ] Question thread: re-skin to the reference; answer sort toggle ("Highest Voted" is already the default order)
- [ ] **Rich-text answer composer toolbar** (bold / italic / code / link) + **Markdown & code-block rendering** for questions/answers (e.g. `react-markdown` + highlighter)
- [ ] Preserve existing actions: like, mark solution, report, edit/delete, promote-to-FAQ
- [ ] _Question votes / downvotes / answer-count badges / replies deferred to M13–14_

## Milestone 12 — Admin dashboard re-skin

Goal: match the "System Overview" screen. **Frontend (existing APIs + small derivations).**

- [ ] KPI cards: Total Users, Open Questions, **Resolution Rate %** (resolved/total, derived), Mod Queue Size + load indicator, AI Status (from `/health`)
- [ ] "Needs Attention" panel aggregating existing data: flagged content (reports), stale docs (`is_outdated`), pending approvals (`requires_approval`) — each linking to the relevant tab
- [ ] Recent Audit Log feed on the overview (`listAudit`, latest N)
- [ ] Keep the Moderation / Users / FAQ / Audit / Maintenance tabs

## Milestone 13 — Engagement backend (votes, bookmarks, answer counts)

Goal: the data the reference cards & threads imply. **Backend + UI wiring.**

- [ ] **Answer counts** on `listQueries` (aggregation or denormalized counter) → show on forum cards
- [ ] **Question voting** (decision: up/down on queries) — model/fields + endpoints + UI vote rail
- [ ] **Answer downvote** — extend likes into signed votes (or keep upvote + add downvote) + UI
- [ ] **Save / bookmark questions** — `Bookmark` model + create/delete/list endpoints + bookmark button on the thread
- [ ] Tests for every new endpoint; lint / test / build green

## Milestone 14 — Activity, comments, settings & profile backend

Goal: remaining reference features that need backend. **Backend + UI wiring.**

- [ ] **Recent-activity feed** endpoint (aggregate the user's queries/answers/saves) → Home feed
- [ ] **Reply / comment on answers** — `Comment` model + endpoints (threading) + UI
- [ ] **Settings page** — `GET`/`PATCH /api/users/me` for `notification_prefs` (+ basic profile)
- [ ] **Avatars** — avatar field or initials/Gravatar across the UI; show author reputation on answer cards
- [ ] Formalize **level/tier + pts-to-next** in the profile API (replacing M10's client derivation); add admin **resolution_rate** + AI uptime metric
- [ ] Tests; lint / test / build green; refresh README screenshots

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

- **2026-05-30** — QA & security audit completed (`AUDIT_REPORT.md`); fixes + regression suite on branch `fix/security-audit` (PR #1).
- **2026-05-30** — Adopted the `FrontendReference/` "Frozen Precision" design kit as the UI source of truth. Gap analysis in `FRONTEND_GAP_REPORT.md` → Phase 2 (Milestones 9–14) added above.

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
