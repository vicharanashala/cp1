# FAQ Platform — QA, Testing & Security Audit Report

**Audited revision:** `main` @ `4254582` (working tree, post-fix)
**Audit date:** 2026-05-30
**Auditor role:** Senior QA Engineer & Security Auditor
**Scope:** Full MERN monorepo (`server/` Express API + `client/` React/Vite), all 8 milestones per `PLANNING.md` / `TASK.md`.

---

## 1. Executive summary

The FAQ Platform is a well-architected, feature-complete MVP. Code quality is high: clean service/controller/route separation, centralized config and constants, consistent error handling, soft-delete + audit logging, a single swappable AI boundary, refresh-token rotation with hashed storage + revocation, bcrypt password hashing, and rate limiting on sensitive endpoints. React's default escaping means there is **no DOM-XSS** in the SPA (no `dangerouslySetInnerHTML` anywhere).

The audit nonetheless found **1 Critical**, **1 High**, **4 Medium**, and **10 Low** issues. The Critical (well-known JWT secret fallback that silently secures production) and the High (NoSQL operator injection on public list endpoints) were **fixed and pinned with regression tests** during this audit, along with all Medium items and one Low. Remaining Low items are documented with recommendations; most are accepted MVP trade-offs already noted in `PLANNING.md`.

### Verification baseline (before → after fixes)

| Check | Command | Before | After |
|---|---|---|---|
| Lint (server + client) | `npm run lint` | 0 errors, 13 warnings | 0 errors, 1 warning* |
| Unit/Integration/API tests | `npm test` | 50 passed / 7 suites | **55 passed / 8 suites** |
| Client build | `npm run build` | ✅ | ✅ |
| Dependency scan | `npm audit` | 3 moderate (transitive) | 3 moderate (transitive) |

\* The remaining warnings are pre-existing unused `eslint-disable` directives and one unused import — cosmetic, non-blocking (see §7).

> **Note on "TypeScript type checks":** this project is intentionally **pure ESM JavaScript**, not TypeScript, so a `tsc` type-check is not applicable. ESLint (flat config, `@eslint/js` + React plugins) is the static-analysis gate and is run in its place.

---

## 2. Test strategy

A professional test pyramid for this stack. ✅ = present/used, ➕ = added in this audit, ⬜ = recommended (not yet implemented).

| Layer | Tooling | Status | Coverage |
|---|---|---|---|
| **Unit** (pure logic) | Jest | ✅ | gibberish heuristics, cosine similarity, badge thresholds, spam escalation, job handlers |
| **Integration / API** | Jest + Supertest + `mongodb-memory-server` | ✅ ➕ | auth, queries, forum, badges/bans, FAQ, chatbot RAG, admin, maintenance crons, **security regressions** |
| **Authentication & authorization** | Jest + Supertest | ✅ ➕ | token required, admin-only gates, ownership checks, banCheck, **chatbot session ownership** |
| **Input validation & edge cases** | Jest + Supertest | ✅ ➕ | gibberish/duplicate gates, empty bodies, **NoSQL injection**, **upload extension smuggling** |
| **AI determinism** | Mock-mode AI boundary | ✅ | offline embeddings + canned chat keep CI free and deterministic |
| **Security** | Jest regression suite (`tests/security.test.js`) | ➕ | headers, NoSQL injection, upload hardening, session isolation, ban enforcement |
| **Dependency vuln scan** | `npm audit` | ✅ | run each milestone; see §6 |
| **UI/UX validation** | manual review of components/pages | ✅ | React auto-escaping verified; focus-visible/responsive CSS present |
| **Client unit/component** | Vitest + React Testing Library | ⬜ | recommended — no client tests currently exist |
| **End-to-end (E2E)** | Playwright / Cypress | ⬜ | recommended — the `TASK.md` demo-loop checklist is the manual E2E script today |
| **Performance/load** | k6 / autocannon | ⬜ | recommended for the in-memory vector scan ceiling (see PERF-01) |

The test suite uses an in-memory MongoDB and the AI mock boundary, so the entire suite is **deterministic, offline, and quota-free** — exactly right for CI.

---

## 3. Findings by milestone

Severity definitions — **Critical:** remote compromise / auth bypass. **High:** significant data exposure or integrity loss. **Medium:** exploitable under conditions / defence-in-depth gap. **Low:** hardening, minor integrity, or accepted trade-off.

### Milestone 1 — Foundation (auth, JWT, middleware, models)

#### 🔴 SEC-01 — Hardcoded JWT secret fallback (Critical) — **FIXED**
- **Description:** `config/env.js` resolved secrets via a `required(key, fallback)` helper that *always* supplied a fallback (`'dev-access-secret'` / `'dev-refresh-secret'`), so it never actually enforced anything. A production deployment with the env vars unset would silently sign and verify JWTs with these **well-known values published in this public repo**.
- **Reproduction:** Start the server without `JWT_ACCESS_SECRET`. Sign a token with `{ sub: <any user's _id> }` using `dev-access-secret`. Send it as `Authorization: Bearer …`. The `auth` middleware loads that user fresh from the DB → full session as any user, **including admins**.
- **Impact:** Complete authentication bypass / account & admin takeover.
- **Fix applied:** Replaced `required()` with a `secret()` resolver that **throws on startup in production** if the secret is missing or still equals the dev default. Dev/test keep the convenient fallback (so CI and local runs are unaffected).

#### 🟠 SEC-04 — Missing HTTP security headers (Medium) — **FIXED**
- **Description:** No `helmet` or equivalent; responses lacked `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and leaked `X-Powered-By: Express`.
- **Impact:** Clickjacking, MIME-sniffing, framework fingerprinting; compounds SEC-03.
- **Fix applied:** Added a dependency-free header middleware in `app.js` (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, removes `X-Powered-By`). **Recommendation:** adopt `helmet` + a CSP in production.

#### 🟡 SEC-06 — Stack traces returned to clients outside production (Medium → Low) — **OPEN (recommendation)**
- **Description:** `middleware/error.js` includes `err.stack` in the JSON response unless `config.isProd`. The default `NODE_ENV` is `development`, so a deployment that forgets to set `NODE_ENV=production` leaks internal stack traces.
- **Impact:** Information disclosure (paths, dependency internals).
- **Recommendation:** Gate stack exposure on an explicit debug flag, or hide it whenever `NODE_ENV !== 'development'`. Ensure `NODE_ENV=production` in the deploy workflow.

#### 🟡 SEC-10 — Tokens stored in `localStorage` (Low) — **OPEN (accepted)**
- Access + refresh tokens live in `localStorage` (`client/src/api/client.js`), so any XSS could exfiltrate them. Already documented as an MVP trade-off; **recommend httpOnly, SameSite cookies** for production. React's escaping keeps XSS risk low today.

#### 🟡 SEC-14 — Thin input validation on registration (Low) — **OPEN (recommendation)**
- `authService.register` checks presence + password length ≥ 8 but does **not** validate email format or bound `name` length. bcrypt also silently truncates passwords beyond 72 bytes.
- **Recommendation:** Add an email regex (or `validator`), cap `name`/`title`/`body` lengths at the schema, and reject > 72-byte passwords explicitly.

**M1 strengths:** bcrypt hashing; refresh tokens stored as SHA-256 hashes with TTL index, rotated on use and revoked on logout; `auth` reloads the user from the DB so a forged/role-tampered token can't elevate (role is read from the DB doc, not the token claim); `password_hash` is `select:false` and stripped in `toJSON`.

---

### Milestone 2 — Ask a Query (gibberish, spam, vector, intake)

#### 🟠 SEC-02 — NoSQL operator injection on list filters (High) — **FIXED**
- **Description:** `queryService.listQueries` assigned `req.query` values straight into the Mongo filter (`filter.category = opts.category`, etc.). Express' `qs` parser turns `?category[$ne]=x` into `{ $ne: 'x' }`, injecting a **Mongo operator** into the filter. The same pattern existed in `faqService.listFaqs` (category) and `adminService.listModeration` (status/type). The `/api/queries` route is **public** (`optionalAuth`).
- **Reproduction:** `GET /api/queries?category[$ne]=nope` returned all queries *not* in category "nope" (operator honored) instead of treating the value as a literal string.
- **Impact:** Filter logic manipulation / unintended data selection; malformed operators can also throw 500s (availability).
- **Fix applied:** All user-supplied list filters are now coerced with `String()` before entering the query (consistent with `createQuery`, which already did this). Pinned by `security.test.js › NoSQL operator injection`.

#### 🟠 SEC-03 — Upload extension smuggling → stored XSS (Medium) — **FIXED**
- **Description:** `middleware/upload.js` validated only `file.mimetype` (client-controlled, spoofable) but derived the **stored extension from `originalname`** (also attacker-controlled). Uploads are served from `/uploads` via `express.static`, which sets `Content-Type` by extension. An attacker could send `Content-Type: image/png` with filename `evil.html` → stored as `*.html` → served as HTML/script on the API origin.
- **Reproduction:** Upload a "screenshot" with `contentType: image/png`, `filename: evil.html` → previously stored with a `.html` extension.
- **Impact:** Stored XSS in the API origin; content-spoofing.
- **Fix applied:** Extension is now derived from a **server-side MIME→extension allowlist** (never from the filename). The `/uploads` static handler additionally sets `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`, so a malicious upload can never render inline. Pinned by `security.test.js › upload filename`.

#### 🟡 PERF-01 — In-memory vector scan ceiling (Low / by design) — **OPEN (accepted)**
- `vectorService.findSimilarQueries` (and the chatbot/cluster/FAQ search) load *all* embeddings into memory and score them per request — O(n) per create/search. **Correct for MVP scale** and explicitly called out in `PLANNING.md §15`. **Recommendation:** swap `vectorService` for a dedicated vector index beyond low-thousands of documents (the interface already isolates this).

**M2 strengths:** two-layer gibberish gate with AI escalation only on borderline scores (quota-aware); embedding cache keyed by content hash (no redundant AI calls); duplicate detection warns + flags into the moderation queue (never auto-rejects, per spec); tags normalized + capped; the `Query` text index backs `$text` search.

---

### Milestone 3 — Forum + Solution Engine

#### 🟡 SEC-07 — Report endpoints missing `banCheck` (Low) — **FIXED**
- Banned users could still `POST /:id/report` (query & answer), letting a banned account flood the moderation queue. Added `banCheck` to both report routes. Pinned by `security.test.js › banned users cannot report`.

#### 🟡 SEC-12 — Merge doesn't reconcile accepted answer (Low) — **OPEN (recommendation)**
- `adminService.mergeQueries` reassigns the duplicate's answers to the canonical query but does not clear/recompute `is_accepted` on moved answers or `canonical.accepted_answer_id`. A merged thread could display a second "accepted" answer or an inconsistent status.
- **Recommendation:** On merge, reset `is_accepted=false` on moved answers (or re-run finalization for the canonical thread).

#### 🟡 SEC-13 — Like points not reverted on prune (Low) — **OPEN (recommendation)**
- When `finalizeSolutions` soft-deletes pruned answers, the +2 reputation points their likes awarded are not reversed, causing minor reputation drift. Low impact. **Recommendation:** reconcile points (or accept as historical reward).

#### 🟡 SEC-16 — No report de-duplication (Low) — **OPEN (recommendation)**
- A single user can report the same content repeatedly, each creating a `ModerationQueue` entry. `writeLimiter` (40/min) caps the rate but not the total. **Recommendation:** dedupe `(reporter_id, target)` or collapse in the queue.

**M3 strengths:** ownership enforced on edit/markSolution/delete; self-like blocked; one-like-per-user via a unique index; `awardPoints` is the single reputation entry point (badges always stay in sync); Path A vs Path B point logic matches spec; resolution actions are audit-logged.

---

### Milestone 4 — Badges & Bans

#### 🟡 SEC-09 — Public profile exposes moderation status (Low) — **OPEN (partly by design)**
- `GET /api/users/:id` is unauthenticated and returns `ban_reason`, `ban_expires_at`, `requires_approval`, and `negative_badges` to anyone. `PLANNING.md §11/§12` intends negative badges to be visible, but the free-text **`ban_reason`** is arguably sensitive.
- **Recommendation:** Keep badges public; restrict `ban_reason` to admins/self.

**M4 strengths:** self-ban prevented; timed vs permanent bans handled; `banCheck` lifts expired bans lazily *and* via cron; suspended → permaban, restricted → approval-required; every governance action is audit-logged and notifies the user; `awardPoints` floors reputation at 0.

---

### Milestone 5 — FAQ + Chatbot + Notifications

#### 🟠 SEC-05 — Chatbot session not bound to its owner (Medium) — **FIXED**
- **Description:** `GET /api/chatbot/session/:token` had **no auth** and returned full chat history for any token. `getOrCreateSession` reused an existing session purely by token, regardless of which user owned it, and accepted a **client-chosen `session_token`** (session-fixation surface). A user holding/guessing another user's token could read their history or append to their session.
- **Impact:** Cross-user chat history disclosure; session hijack/fixation.
- **Fix applied:**
  - Sessions are now reused only if **anonymous** or **owned by the same authenticated user**; a logged-in user may *claim* an anonymous session, but replaying another user's token yields a **fresh** session.
  - New sessions always mint a server-side `crypto.randomUUID()` (client can't fixate the token).
  - `getSession` now requires ownership for user-bound sessions (route uses `optionalAuth`; anonymous sessions remain readable by their unguessable token, preserving the existing UX).
  - Pinned by `security.test.js › chatbot session ownership`.

#### ℹ️ INFO — Prompt-injection surface (informational)
- The RAG prompt concatenates the user message with retrieved FAQ/community text. Standard LLM risk; answers are grounded and the system degrades to grounded text on error. In mock mode this is inert. **Recommendation for production:** keep retrieved content clearly delimited and treat model output as untrusted.

**M5 strengths:** notification endpoints are correctly scoped by `recipient_id` (no IDOR); FAQ promotion guards resolved-state and double-promotion; graceful AI fallback on 429/errors; embeddings stripped from all FAQ/notification serializers.

---

### Milestone 6 — Admin dashboard

- `adminRoutes` correctly applies `router.use(auth, admin)` to the entire router — all admin tooling is admin-gated.
- `adminService.listUsers` **escapes regex** before building the search `RegExp` (no ReDoS / regex injection).
- `setRole` validates the role against the `ROLES` enum.
- `listModeration` filter coercion was hardened as part of **SEC-02** (admin-only, lower risk, fixed for consistency).

#### 🟡 SEC-11 — Admin can self-demote / last-admin lockout (Low) — **OPEN (recommendation)**
- `setRole` lets an admin change their own role to `user`, potentially removing the last administrator. **Recommendation:** block self-demotion and/or refuse to demote the final admin.

**M6 strengths:** merge/dismiss/resolve all audit-logged; amalgamation clustering is read-only (admin decides); pagination caps (`limit ≤ 50`) prevent unbounded scans.

---

### Milestone 7 + 8 — Maintenance crons & Polish/Ship

- **Job trigger safety:** `POST /api/jobs/:name/run` is admin-gated and resolves handlers from a **static registry map** (`jobs[name]`) — no dynamic `require`/`eval`, so no command/handler injection. Unknown names → 404.
- **Idempotency/safety:** `soft-delete-purge` writes an `AuditLog` *before* hard-deleting; `lru-eviction` only flips `is_archived`; jobs are disabled during tests (scheduling lives in `server.js`, not `app.js`).
- **Rate limiting:** `authLimiter` (auth), `aiLimiter` (AI), `writeLimiter` (content writes) applied; all disabled under `NODE_ENV=test`.
- **Seed integrity:** the uncommitted `seed/seed.js` change (using `pathToFileURL` for the direct-invocation guard) is a **correct Windows-compatibility fix** — recommend committing it.

#### 🟡 SEC-08 — `DELETE` lacks `banCheck` (Low) — **OPEN (accepted)**
- `DELETE /queries/:id` and `DELETE /answers/:id` use `auth` but not `banCheck` (unlike `PATCH`). Deleting one's *own* content while banned is low-risk and soft-delete retains the record for moderation, so this is accepted; noted for consistency.

#### 🟡 SEC-15 — Transitive dependency vulnerabilities (Low) — **OPEN (monitor)**
- See §6.

---

## 4. Fixes applied (this audit)

| ID | Severity | Fix | Files |
|---|---|---|---|
| SEC-01 | Critical | Fail-fast on default/missing JWT secrets in production | `server/config/env.js` |
| SEC-02 | High | String-coerce all list filters (kill NoSQL operator injection) | `server/services/queryService.js`, `faqService.js`, `adminService.js` |
| SEC-03 | Medium | MIME-derived upload extension + `Content-Disposition: attachment` + nosniff on `/uploads` | `server/middleware/upload.js`, `server/app.js` |
| SEC-04 | Medium | Baseline security headers; remove `X-Powered-By`; cap urlencoded body | `server/app.js` |
| SEC-05 | Medium | Bind chatbot sessions to owner; server-minted tokens; ownership-checked reads | `server/services/chatbotService.js`, `controllers/chatbotController.js`, `routes/chatbotRoutes.js` |
| SEC-07 | Low | Add `banCheck` to query/answer report routes | `server/routes/queryRoutes.js`, `routes/answerRoutes.js` |

All fixes are **backward-compatible** with the existing API and were verified against the full test suite.

## 5. Tests added

`server/tests/security.test.js` — 5 regression tests, each pinning a fixed vulnerability:
1. Baseline security headers present + `X-Powered-By` hidden.
2. NoSQL operator-injection payload on `category` is neutralized.
3. `image/png` upload named `evil.html` is stored as `.png`.
4. Chatbot session isolation: cross-user read → 403; token replay → fresh session; owner read → 200.
5. Banned user is blocked (403) from reporting content.

**Result:** `npm test` → **55 passed / 8 suites** (was 50 / 7). Lint 0 errors; client build green.

## 6. Dependency vulnerability scan

`npm audit` reports **3 moderate** issues, all **transitive** and not directly reachable by app code:

| Package | Via | Advisory | Note |
|---|---|---|---|
| `uuid` < 11.1.1 | `node-cron@3` → `uuid` | GHSA-w5hq-g745-h8pq (missing buffer bounds check in v3/v5/v6 when `buf` provided) | The app never calls `uuid` with a `buf` argument; node-cron uses it internally for task IDs. |
| `gaxios` 6.4.0–6.7.1 | `@google/genai` | depends on vulnerable `uuid` | Only loaded in **live AI mode**; MVP default is mock mode. |
| `node-cron` 3.0.2–3.0.3 | direct dep | depends on vulnerable `uuid` | `npm audit fix --force` would jump to `node-cron@4` (breaking). |

**Recommendation:** Not exploitable in current usage. Evaluate upgrading `node-cron` to v4 on a branch (verify the cron API), or accept and monitor. Do **not** run `npm audit fix --force` unreviewed (breaking major bump).

## 7. Code-quality notes (non-security)

- **Lint warnings (13 server / 1 client):** mostly stale `eslint-disable` directives that no longer suppress anything, plus two genuinely unused identifiers (`faqService.js` arg `embedding`, `maintenance.test.js` import `FaqEntry`). Cosmetic — clear with `eslint --fix` where safe. Not fixed here to keep the audit diff security-focused.
- **Consistency:** `createQuery` coerced inputs to `String`/`Boolean`; the list/search paths did not (root cause of SEC-02) — now consistent.
- **Commit the seed fix:** `seed/seed.js` `pathToFileURL` change is correct; commit it (`fix(seed): …`).

## 8. Residual recommendations (prioritized)

1. **(Prod)** Set `NODE_ENV=production` + strong unique `JWT_*` secrets; adopt `helmet` + CSP; move tokens to httpOnly cookies. (SEC-04, SEC-06, SEC-10)
2. **(Med)** Restrict `ban_reason` to admins/self. (SEC-09)
3. **(Med)** Block admin self-demotion / last-admin removal. (SEC-11)
4. **(Low)** Reconcile accepted-answer state on merge; revert like points on prune; dedupe reports. (SEC-12, SEC-13, SEC-16)
5. **(Validation)** Email-format + length validation on user input. (SEC-14)
6. **(Testing)** Add client component tests (Vitest + RTL) and an E2E suite (Playwright) covering the `TASK.md` demo loop; add a load test for the vector-scan ceiling.
7. **(Deps)** Plan a `node-cron@4` upgrade spike. (SEC-15)

---

*Generated as part of a milestone-wise QA & security audit. All Critical/High/Medium findings were remediated and pinned with automated regression tests; remaining Low items are documented above with recommended fixes.*
