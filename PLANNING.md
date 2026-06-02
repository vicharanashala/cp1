# PLANNING.md

> **Single source of truth for the project's vision, architecture, constraints, and conventions.**
> Read this at the start of every work session before touching code. Keep it current — if a decision changes, update it here.

**Project:** FAQ Platform — a self-contained MERN knowledge platform
**Context:** Internship project · open-source · zero paid infrastructure · code in company GitHub repo · CI/CD via GitHub Actions

---

## 1. Vision

Organizations accumulate knowledge faster than they can organize it: common questions get re-asked, answers go stale, duplicate threads fragment information, and low-quality content erodes trust. Most FAQ or forum tools solve only one slice of this.

This platform unifies the **full knowledge lifecycle** in one system. A user can ask the AI chatbot, submit a formal query, or browse and answer in the community forum — and the best community answers are promoted back into the canonical FAQ. Automation keeps the knowledge base clean (duplicate detection, gibberish filtering, staleness checks, LRU archival) while a reputation system rewards good contributors and a governance layer handles bad ones.

**The goal:** a knowledge base that *improves itself over time* instead of decaying.

---

## 2. Goals & scope

**Primary goal:** deliver a working MVP that demonstrates the entire feature set end-to-end at **zero infrastructure cost**, built so the externally-dependent pieces (AI models, database, hosting) are cleanly swappable for the company's own production infrastructure later.

### In scope (MVP)
- All three user-facing pillars: FAQ + chatbot, Ask a Query, Q&A forum.
- Content-quality automation: gibberish detection, auto-correction, duplicate detection, amalgamation.
- Reputation: points, positive + negative badges, an admin-verified badge.
- Moderation & governance: queue, bans, soft-delete + audit, reporting.
- Automated maintenance: LRU eviction, staleness, orphan cleanup, purge.
- In-app notifications, personalized greeting.
- Admin dashboard.
- CI pipeline (lint/test/build) + reproducible local run.

### Explicitly deferred to production (company-owned)
- Production hosting (company server).
- Production AI models / keys (company-provided).
- Production database (company-managed MongoDB).
- Dedicated vector index at large scale.
- Real-time transport upgrade (WebSockets) if needed beyond polling.

---

## 3. Constraints

The MVP runs entirely on free, self-contained components. These are hard boundaries for the internship deliverable.

| Constraint | Resolution |
|---|---|
| No external paid services | Everything self-hosted or free-tier |
| Image storage | Multer → local `uploads/` directory, served as static files |
| Vector search | In-app cosine similarity over embeddings stored in MongoDB |
| Notifications | In-app only, via lightweight polling (no email/SMS) |
| AI model | Google Gemini free tier (swappable in production) |
| CI/CD | GitHub Actions only |
| Cost ceiling | No billing enabled → over-quota returns rate-limit errors, never a bill |

**Free-tier reality:** Gemini quotas were cut substantially in Dec 2025 (~10 RPM and a few hundred to ~1,000 requests/day, shared across the whole project — extra keys don't help). Pro models are paid-only, so the plan uses only Flash + embedding models. The tight quota is the main runtime risk and drives the AI strategy (§8).

---

## 4. The core concept

Three **user-facing pillars**, supported by two **automation engines** and an **admin/governance layer**.

```
   PILLAR 1                PILLAR 2                 PILLAR 3
 General FAQ +           Ask a Query             Q&A Forum
 AI Chatbot          (structured intake)     (community answers)
      │                     │                       │
      └─────────┬───────────┴───────────┬───────────┘
                │                        │
       Solution Marking Engine    Two-Tier RAG Pipeline
       (promotes best answers)    (FAQ → community → AI)
                │                        │
                └───────────┬────────────┘
                            │
                  Admin & Governance Layer
        (moderation, bans, badges, audit, maintenance)
```

- **Pillar 1 — General FAQ + AI Chatbot:** curated, category-organized FAQ with keyword + semantic search, fronted by a chatbot that answers from the knowledge base.
- **Pillar 2 — Ask a Query:** structured submission with quality gates (gibberish, auto-correct, duplicate detection) and context enrichment (email, screenshots).
- **Pillar 3 — Q&A Forum:** community answering, liking, and resolution, with reputation rewards.
- **Solution Marking Engine:** decides the canonical answer(s) for a query and promotes resolved Q&A into the FAQ.
- **Consent-gated two-tier RAG pipeline:** the chatbot retrieves from the FAQ first; if there's no confident match it **asks permission** before searching the community Q&A, then composes an AI response and redirects to the forum thread (with graceful fallback).
- **Admin & Governance:** everything that keeps the system healthy and trustworthy.

---

## 5. Architecture

```
                ┌──────────────────────────────────┐
                │  React (Vite) ── client/          │
                │  polling for notification counts   │
                └────────────────┬──────────────────┘
                                 │ REST (JSON) + JWT
                ┌────────────────▼──────────────────┐
                │  Express API ── server/            │
                │  auth · queries · answers · faq ·  │
                │  chat · notifications · admin       │
                │  services/ · jobs/ · middleware/    │
                └───┬────────────┬─────────────┬─────┘
                    │            │             │
          ┌─────────▼─┐    ┌─────▼──────┐  ┌───▼──────────┐
          │ MongoDB   │    │ ai.js      │  │ uploads/     │
          │ (Mongoose)│    │ (Gemini)   │  │ (Multer)     │
          │ ⇄ swap    │    │ ⇄ swap     │  │ local disk   │
          └───────────┘    └────────────┘  └──────────────┘
```

### Swappable boundaries (critical design principle)
The two externally-dependent integrations are isolated behind single modules so the "company swaps in its own DB and AI" path is a configuration change, not a refactor:

- `server/config/db.js` — the only place that knows the database connection.
- `server/config/ai.js` — the only place that calls the AI provider (chat, cheap calls, embeddings); also houses the request queue + backoff.

Keep these the *only* touchpoints. No other file should `import` the Gemini SDK or open a DB connection directly.

### Project layout (target)
```
.
├── client/                 # React (Vite) frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── context/        # AuthContext, etc.
│       └── api/            # axios wrappers
├── server/
│   ├── config/             # db.js, ai.js  ← swappable boundaries
│   ├── models/             # Mongoose schemas
│   ├── routes/             # express routers
│   ├── controllers/
│   ├── services/           # vectorService, gibberish, solution engine, etc.
│   ├── middleware/         # auth, admin, banCheck, rate-limit
│   ├── jobs/               # node-cron jobs (also manually triggerable)
│   └── uploads/            # Multer local disk storage
├── .github/
│   ├── workflows/ci.yml
│   └── ISSUE_TEMPLATE/ , PULL_REQUEST_TEMPLATE.md
├── docker-compose.yml
├── PLANNING.md
└── TASK.md
```

---

## 6. Tech stack & rationale

| Layer | Technology | Why |
|---|---|---|
| Frontend | React (Vite) + CSS Modules | Fast HMR, component model, scoped styles |
| Backend | Node.js + Express (REST) | Simple, ubiquitous, matches team skills |
| Database | MongoDB + Mongoose | Flexible schema; easy local + managed parity |
| Vector search | In-app cosine similarity | Zero extra infra; correct for MVP-scale corpora |
| Chat/LLM | `gemini-2.5-flash` via `@google/genai` | Free tier; current (2.0 retired); modern unified SDK |
| Cheap AI calls | `gemini-2.5-flash-lite` | Cheapest/fastest for high-volume gibberish + auto-correct |
| Embeddings | `gemini-embedding-001` (768 dims) | Free-tier eligible; replaces shut-down text-embedding-004 |
| File storage | Multer → local `uploads/` | No object-store dependency; persists on a real server |
| Scheduler | `node-cron` (+ manual triggers) | Works on always-on server; jobs demoable on demand |
| Auth | JWT (access + refresh, refresh stored & revocable) + bcrypt | Stateless access + real logout/invalidation |
| Real-time | Polling | Removes always-open-connection requirement; trivial to host |
| CI/CD | GitHub Actions | Required; lint → test → build |
| Dev/demo orchestration | Docker Compose | One-command, reproducible run for any reviewer |

### Key libraries
- **Backend:** express, mongoose, jsonwebtoken, bcrypt, multer, node-cron, @google/genai, express-rate-limit.
- **Frontend:** react, react-router, axios, vite.
- **Testing/CI:** jest, supertest, mongodb-memory-server, eslint.

---

## 7. Data model (conceptual)

MongoDB collections (Mongoose). Full schema definitions live in `server/models/`; this is the overview. Embeddings are fixed at **768 dimensions**; all destructive actions go through **soft-delete + audit log**.

- **users** — identity, `role`, `points`, `badges[]`, `negative_badges[]`, `spam_flag_count`, `is_banned` / `ban_expires_at` / `ban_reason`, `login_streak`, `last_login_at`, notification prefs.
- **refresh_tokens** — `{ user_id, token_hash, expires_at, revoked }`; makes logout actually invalidate sessions.
- **queries** — content + `status`, `category`, `tags` (both drawn from the admin **taxonomy**), `is_anonymous` (retained but always `false` — **anonymous posting is disabled**); admin verification; context enrichment (a **required** `contact_email` + `joining_date`, `screenshots[]`); duplicate/merge (`is_flagged_duplicate`, `duplicate_of`, `similarity_score`, `merge_status`, `merged_into`, `merged_from[]`); `reports[]`; community engagement (`vote_score`, `needs_attention`); LRU (`last_accessed_at`, `access_count`, `is_archived`); soft-delete fields (incl. `deleted_by` for the 15-min rollback); `embedding[768]`; `grace_period_deadline`.
- **answers** — `body`, `like_count`, `is_accepted`, `is_helpful`, admin verification (`is_verified`, `verified_by`); auto-correction (`original_body`, `was_auto_corrected`); outdated flags; soft-delete (incl. `deleted_by`); `reports[]`. Authors may edit within a 15-minute window.
- **taxonomy** — admin-curated `{ kind: 'category' | 'tag', name, slug }`; the only categories/tags users can pick (plus the built-in "Others" tag).
- **votes** / **bookmarks** — per-user question up/down votes and saved questions.
- **comments** — threaded replies under an answer (poster ↔ answer-author only), soft-deleted.
- **notifications** — `recipient_id`, `type`, `title`, `message`, `link`, related IDs, `is_read`. (Routine answer/like/comment notifications are suppressed for admin recipients.)
- **moderation_queue** — `type`, `status`, related query/answer, `duplicate_of_query_id`, `similarity_score`, resolution metadata.
- **audit_log** — `action`, `entity_type`, `entity_id`, `performed_by`, `details` snapshot.
- **faq_entries** — `category`, `question`, `answer`, `sort_order`, `source` (admin/qa), `source_query_id`, LRU fields, `is_outdated`, `embedding[768]`, soft-delete. Admin creation runs a near-duplicate guard.
- **likes** — `{ answer_id, user_id, value }` (signed: upvote/downvote).
- **users** — also carries `is_moderator` / `moderator_requested` and admin-authored `custom_badges[]` (incl. the auto-granted **Admin Verified** badge).
- **chatbot_sessions** — `session_token`, `user_id`, `messages[]` (role, content, source_tier, citations, timestamp).

---

## 8. AI & rate-limit strategy

The tight free-tier quota is the main runtime risk, so the system is built to **minimize and survive AI calls**:

- **Heuristic-first gibberish** — AI only on borderline cases.
- **Opt-in auto-correct** — a button, not an automatic call on every submit.
- **Embedding cache** — embed once on create/edit; never re-embed unchanged text.
- **Seeded embeddings** — all demo content is embedded once, offline, so browsing/search/chatbot-retrieval make zero live calls.
- **Queue + exponential backoff** on HTTP 429.
- **Graceful degradation** — AI features fall back instead of erroring.
- **Model routing** — `flash-lite` for cheap/high-volume checks; `flash` for chat.

> Note: free-tier inputs may be used by Google for training. Production must use the company's own keys/tier per its data-governance policy.

---

## 9. Key feature flows

### Duplicate detection → moderator merge (never auto-reject)
```
Submit query → embed → cosine similarity search
  similarity > 80% ?
    NO  → save normally
    YES → warn "Similar to: [match]"
          ├ View existing → navigate to match
          └ Post anyway  → save WITH flag → moderation_queue
                           → moderator: [Merge] | [Dismiss]
```

### Gibberish detection + escalation
```
Submit → Layer 1 heuristics (length, repeated chars, dictionary-word ratio)
       → borderline? → Layer 2 AI check {is_valid, confidence, reason}
PASS → submit
FAIL → block + increment spam_flag_count
       1st → warning · 2nd → ⚠️ + 24h ban · 5th → 🚫 (approval) · 10th → ☠️
```

### Auto-correction (opt-in)
```
User clicks "Check grammar" → AI returns {corrected, changes[]}
  changes? → diff modal [Accept All] / [Keep Original]
  store original_body if corrected
```

### Solution Marking Engine
```
Path A: author marks answer → 48h grace → finalize (keep accepted + any with more likes) → points awarded
Path B: no selection → 48h after first answer → auto-keep most liked → no points
Both: prune extras (if >3), status = resolved, promote into knowledge base
```

### Consent-gated two-tier RAG chatbot

The chatbot (and the FAQ search bar) answer from the FAQ first and **ask before
searching the community forum** — the forum is never silently mixed into FAQ
results.

```
Message → embed → Tier 1: search FAQ
        → FAQ hit → compose answer with citation (gemini-2.5-flash), point to the FAQ
        → FAQ miss → source_tier:"await_forum" → "Not in the FAQ. Check the forum?" (Yes/No)
            → user says Yes (re-ask with check_forum:true)
                → Tier 2: search resolved community Q&A
                → match → answer + citation that redirects to the forum thread
                → no match / 429 → graceful fallback ("browse the FAQ / raise a query")
            → user says No → stay in the FAQ; forum DB never queried
```

---

## 10. Scheduled jobs

Run via `node-cron`; each is a plain function **also triggerable from the admin panel** (so jobs can be demoed on a click, not on a timer).

| Job | Schedule | Purpose |
|---|---|---|
| Solution finalization | Daily | Resolve queries past their 48h grace period |
| Ban expiry | Hourly | Lift expired 24h bans |
| LRU eviction | Daily | Archive queries unaccessed 90+ days |
| Badge recalculation | Daily | Award/check badge eligibility |
| Staleness check | Weekly | Flag potentially outdated answers |
| Orphan cleanup | Weekly | Remove orphaned likes/sessions |
| Soft-delete purge | Monthly | Hard-delete items soft-deleted >30 days |
| Embedding refresh | Weekly | Re-embed updated content |

---

## 11. Reputation & thresholds

- **Positive badges (tiered):** 🥉 Helper (30 pts) · 🥈 Contributor (100) · 🥇 Expert (200) · 🏆 Legend (300). The highest badge a member holds is shown under their name in the forum.
- **Admin Verified ✅** — auto-granted to a member when an admin marks one of their answers verified (kept even if later unverified).
- **Negative badges (admin-issued):** ⚠️ Warning · 🚫 Restricted · ☠️ Suspended, visible on profiles.
- **Spam escalation:** 1st warning · 2nd ⚠️ + 24h ban · 5th 🚫 · 10th ☠️.
- **LRU archival:** 90 days unaccessed. **Edit & rollback windows:** authors edit their own posts for 15 min; admins/mods can undo a deletion for 15 min.
- All thresholds are reasonable defaults, centralized in `server/config/constants.js` and easily tunable.

---

## 12. Security & governance

- **Auth:** short-lived JWT access tokens + refresh tokens whose hashes are stored and revoked on logout; bcrypt password hashing.
- **Authorization:** role middleware (`auth`, `admin`, `banCheck`) gates protected/admin routes; non-admins get 403.
- **Abuse handling:** gibberish gate + escalating spam penalties + 24h auto-ban + negative badges.
- **Data integrity:** soft-delete everywhere with an audit log (who/what/when + data snapshot); scheduled purge for true deletion. Deletions are reversible by an admin/moderator for 15 minutes; authors may edit their own content for 15 minutes after posting.
- **Attribution:** **anonymous posting is disabled** — every question is attributed to its author (the `is_anonymous` field is retained for legacy data but always `false`). Production should use company AI keys.
- **Taxonomy control:** users can only apply admin-curated categories/tags (or the built-in "Others" tag), enforced server-side — they can't inject their own.
- **Rate limiting:** `express-rate-limit` on sensitive/expensive endpoints.

---

## 13. Hosting, CI/CD & deployment model

**GitHub Actions is the pipeline, not the host.** It lints, tests, builds, and (later) triggers deployment; it cannot run an always-on server, database, or persistent file storage.

- **MVP demo:** runs locally (Express `:5000`, Vite `:5173`, MongoDB + uploads + cron all local), orchestrated by Docker Compose for one-command reproducibility. Demonstrated via screenshare + recorded video (remote work, judged by the repo).
- **Production:** the company's own server — a persistent process supports `node-cron`, local uploads, and managed MongoDB exactly as designed. The deploy workflow builds the client and contains a commented deploy block to enable once server credentials are provided.

**CI specifics:** server tests use `mongodb-memory-server` (no DB service needed) and **mock the AI layer** (no key, no quota burn, no flakiness). Workflow: **lint → test → build** on every push/PR.

---

## 14. Repo & engineering conventions

The repo is public and treated as a portfolio piece.

- **Conventional Commits** with scopes — `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`. Example: `feat(queries): flag >80% duplicates into the moderation queue`.
- **Clean, incremental history**; focused branches (`feat/...`, `fix/...`); squash-merge PRs.
- **README** (run instructions, features, MVP/swappable note, demo video) + **CONTRIBUTING** (commit + PR rules).
- **`.github/` templates** (PR + issue) and a confirmed **LICENSE** before publishing.
- **Reproducible run** via Docker Compose so any visitor can spin it up.
- **Build as a vertical slice** — one complete end-to-end loop before going wide, so there's something demoable early.

---

## 15. Scale boundary & future roadmap

The MVP is honest about its scale limit: in-app cosine similarity loads embeddings into memory, which is correct for hundreds–low-thousands of documents. Beyond that, swap `vectorService.js` for a dedicated vector index — the rest of the duplicate/RAG logic is unaffected.

**Roadmap (post-MVP):**
- [ ] Pluggable AI-provider interface (beyond Gemini).
- [ ] Dedicated vector index for large corpora.
- [ ] Object-storage adapter for uploads.
- [ ] WebSocket option for real-time notifications.
- [ ] Internationalization.

---

## 16. Decisions log

| Decision | Rationale |
|---|---|
| Drop Socket.IO → polling | Removes always-open-connection requirement; trivial to host; fine for MVP traffic |
| In-app cosine (not Atlas Vector Search) | Zero extra infra; correct at MVP scale |
| `gemini-2.5-flash` + `flash-lite` | Gemini 2.0 Flash retired (March 2026); Pro models are paid-only |
| `gemini-embedding-001` @ 768 dims | `text-embedding-004` shut down (Jan 2026); 768 dims keeps storage/compute light |
| `@google/genai` SDK | Legacy `@google/generative-ai` is end-of-life |
| Refresh-token store | Stateless JWT can't be invalidated; storing refresh tokens enables real logout |
| Heuristic-first + opt-in AI | Stays within tightened free-tier quota; avoids accidental cost/limits |
| Local demo, company server for prod | GitHub can't host the backend; persistent server supports cron/uploads as designed |
| Docker Compose + seed + demo video | Repo is the deliverable (remote work); must be reproducible and self-demonstrating |
| Soft-delete + audit everywhere | Safe, reversible deletion with accountability |
| Email notifications skipped | Avoids external service dependency; in-app only |
| `mongodb-memory-server` + mocked AI in CI | Keeps CI fast, deterministic, key-free, and quota-safe |
| **Anonymous posting disabled** (was: hide identity, keep author_id) | A support-FAQ context needs accountable, attributable questions; identity is always shown |
| **Admin-curated taxonomy** (categories/tags) | Keeps the knowledge base consistent — users choose from a vetted list or "Others", not free text |
| **Joining date required on questions** | Captures programme context for moderators; no posting without it |
| **15-min edit window + 15-min delete rollback** | Lets authors fix slips and admins/mods undo mistakes, without leaving content editable/destroyed forever |
| **Admin-verified answers + badge** | An authoritative signal on top of community "helpful"; rewards the answerer |
| **Leaderboard removed** | De-emphasised public ranking in favour of per-author badges shown in-context |
| **Can't answer your own question** | Reinforces the support-ticket model (others help the asker) |
| Thresholds (badges 30/100/200/300; spam 2/5/10; LRU 90d; edit/rollback 15m) | Reasonable defaults, centralized in `constants.js`, easily tunable |
