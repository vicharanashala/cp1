<h1 align="center">Curio Wiki: Platform Documentation</h1>

<p align="center"><em>A knowledge base that improves itself.</em></p>

---

**Curio** is a self-contained community knowledge platform that unifies everything a team needs to capture, organize, and grow its collective knowledge. Featuring a curated FAQ, a grounded AI chatbot, and a structured Q&A forum, Curio is built to **improve itself over time** — automatically promoting high-value community answers into the FAQ, archiving inactive threads, and filtering out low-quality queries before they ever reach the community.

What makes Curio different is that it doesn't decay like a typical wiki. The best community answers are preserved, duplicates are merged, stale content is flagged, and unused threads are tidied away — largely without manual gardening. And because every external dependency (AI model, database, hosting) sits behind a swappable module, moving from a free-tier setup to production infrastructure is a configuration change, not a rewrite.

---

## The Curio Wiki Map

This documentation is written feature-first and in plain language. Follow it in order for the full picture, or jump straight to the area you need:

1. **[Authentication & User Accounts](Authentication-and-User-Accounts)** — User identity, secure register/login, token rotation, profiles, notification preferences, roles, and account ban controls.
2. **[Ask a Query & Forum Engine](Ask-a-Query-and-Forum-Engine)** — Question submission and its quality gates (gibberish, spam, unfinished-question, and duplicate detection, plus an optional "Refine with AI" pass), the support-ticket answering loop, voting, bookmarks, and automated solution finalization.
3. **[Reputation, Badges & Moderation](Reputation-Badges-and-Moderation)** — The upward-only points system, badge tiers, negative flags, the expert-to-moderator pipeline, and admin-verified answers.
4. **[FAQ Knowledge Base & AI Chatbot](FAQ-Knowledge-Base-and-AI-Chatbot)** — Semantic FAQ search, category browsing, promote-to-FAQ, and the consent-gated, grounded chatbot.
5. **[Admin Dashboard & Maintenance](Admin-Dashboard-and-Maintenance)** — Admin control tabs, moderation and attention queues, audit logs, the 15-minute rollback window, and the 8 automated background jobs.
6. **[Architecture, Setup & DevOps](Architecture-Setup-and-DevOps)** — The technical foundation: monorepo layout, the two swappable boundaries, testing infrastructure, and team Git conventions.

---

## What You'll Find Inside

- **A platform built around three pillars** — a curated FAQ fronted by an AI chatbot, a quality-gated query intake, and a community Q&A forum — all tied together by a reputation and governance layer.
- **A knowledge base that grows itself** — resolved community answers are promoted into the official FAQ, so a one-off solution becomes permanent, searchable knowledge.
- **Trust and safety by design** — every contribution is attributed, every admin action is logged, and accidental deletions can be undone within a 15-minute window.
- **Zero-cost by default** — the entire platform runs offline with deterministic mock AI, so development, testing, and demos need no API keys, no quota, and no network access.

> New here? Start with **[Authentication & User Accounts](Authentication-and-User-Accounts)** and read straight through, or open **[Architecture, Setup & DevOps](Architecture-Setup-and-DevOps)** if you want to run Curio locally first.
