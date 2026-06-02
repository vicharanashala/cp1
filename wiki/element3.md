# Reputation, Badges & Moderation

## Points System

Users earn reputation points through contributions. Points never go negative (floor is 0).

| Action                                   | Points | Trigger                                                  |
| ---------------------------------------- | ------ | -------------------------------------------------------- |
| Answer accepted (marked helpful)         | +15    | Question author resolves their query                     |
| Answer liked (upvoted)                   | +2     | Per upvote from the question author (only they can rate) |
| Query resolved (asker's question closed) | +5     | Awarded to the asker                                     |

Only answer upvotes move reputation. Downvotes never deduct points (avoids griefing). The single entry point for all points changes is `awardPoints()` in `server/services/badgeService.js`.

---

## Positive Badge Tiers

Badges are earned automatically when a user's points reach a threshold. They are synced on every points change and recalculated daily by the M7 job (`recalcAllBadges`).

| Tier        | Key           | Icon   | Threshold |
| ----------- | ------------- | ------ | --------- |
| Newcomer    | `newcomer`    | (none) | 0 pts     |
| Helper      | `helper`      | 🥉     | 30 pts    |
| Contributor | `contributor` | 🥈     | 100 pts   |
| Expert      | `expert`      | 🥇     | 200 pts   |
| Legend      | `legend`      | 🏆     | 300 pts   |

Definitions live in `server/config/constants.js` → `POSITIVE_BADGES`. Client-side mirror in `client/src/lib/reputation.js`.

### Badge Display

- `topBadge(badgeKeys)` returns the single highest-tier badge for display under a user's name.
- `standing(points)` returns the current tier, next tier, points-to-next, and a progress percentage.
- `badgeDefs(keys)` maps stored badge keys to full definitions for a badges strip.

### Expert → Moderator Invitation

When a user reaches Expert (200 pts), they automatically receive a system notification inviting them to apply for moderator access from their Settings page. The application sets `moderator_requested = true` for admin review.

---

## Negative Badges

Admin-issued or spam-escalated penalties on a user's account. Defined in `server/config/constants.js` → `NEGATIVE_BADGES`.

| Badge      | Key          | Icon | Effect                                                      |
| ---------- | ------------ | ---- | ----------------------------------------------------------- |
| Warning    | `warning`    | ⚠️   | Informational only                                          |
| Restricted | `restricted` | 🚫   | `requires_approval = true` — all posts need admin clearance |
| Suspended  | `suspended`  | ☠️   | Permanent ban (`is_banned = true`, `ban_expires_at = null`) |

### Spam Escalation (Automatic)

The spam escalation ladder in `server/services/spamService.js` applies penalties at strike thresholds:

| Strike Count | Penalty          | Effect                          |
| ------------ | ---------------- | ------------------------------- |
| 1            | Warning          | No badge, just a logged strike  |
| 2            | ⚠️ Warning badge | Plus 24h temporary ban          |
| 5            | 🚫 Restricted    | Requires approval for all posts |
| 10           | ☠️ Suspended     | Permanent ban                   |

Higher tiers win — a single `recordSpamStrike()` call applies the most severe penalty the user's count has reached.

### Admin-Issued Negative Badges

Admins can manually issue or revoke negative badges via `userService.issueNegativeBadge()` / `revokeNegativeBadge()`. All issuances are logged to the Audit Log and trigger a notification to the affected user.

---

## Admin-Verified Answers

Admins can mark an answer as "verified" (`server/services/answerService.js` → `setVerified()`). This:

1. Sets `answer.is_verified = true` and records `verified_by` (admin's ID).
2. Awards the answerer a **persistent** Admin Verified badge (`custom_badges` array on the User model) — kept even if the answer is later unverified.
3. Verified answers sort above all others in the answer list (`listAnswers` sorts by `is_verified: -1` first).
