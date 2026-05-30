// Centralized, tunable thresholds and enums (PLANNING §11, §9).
// Keeping these in one place makes the system's behavior easy to adjust.

export const ROLES = Object.freeze({
  USER: 'user',
  ADMIN: 'admin',
});

export const QUERY_STATUS = Object.freeze({
  OPEN: 'open',
  ANSWERED: 'answered',
  RESOLVED: 'resolved',
  ARCHIVED: 'archived',
});

export const MODERATION_TYPE = Object.freeze({
  DUPLICATE: 'duplicate',
  REPORT: 'report',
  SPAM: 'spam',
  OUTDATED: 'outdated',
  GIBBERISH: 'gibberish',
});

export const MODERATION_STATUS = Object.freeze({
  PENDING: 'pending',
  RESOLVED: 'resolved',
  DISMISSED: 'dismissed',
});

export const NOTIFICATION_TYPE = Object.freeze({
  ANSWER: 'answer',
  COMMENT: 'comment',
  LIKE: 'like',
  ACCEPT: 'accept',
  RESOLUTION: 'resolution',
  BADGE: 'badge',
  BAN: 'ban',
  SYSTEM: 'system',
});

export const FAQ_SOURCE = Object.freeze({
  ADMIN: 'admin',
  QA: 'qa',
});

// Reputation: positive badges (tiered) keyed by points threshold.
export const POSITIVE_BADGES = Object.freeze([
  { key: 'helper', label: 'Helper', icon: '🥉', threshold: 50 },
  { key: 'contributor', label: 'Contributor', icon: '🥈', threshold: 150 },
  { key: 'expert', label: 'Expert', icon: '🥇', threshold: 500 },
  { key: 'legend', label: 'Legend', icon: '🏆', threshold: 1000 },
]);

// Negative badges (admin-issued).
export const NEGATIVE_BADGES = Object.freeze({
  WARNING: { key: 'warning', label: 'Warning', icon: '⚠️' },
  RESTRICTED: { key: 'restricted', label: 'Restricted', icon: '🚫' },
  SUSPENDED: { key: 'suspended', label: 'Suspended', icon: '☠️' },
});

// Points awarded for contributions.
export const POINTS = Object.freeze({
  ANSWER_ACCEPTED: 15,
  ANSWER_LIKED: 2,
  QUERY_RESOLVED: 5,
});

// Spam escalation thresholds (Nth offense → penalty). PLANNING §9.
export const SPAM_THRESHOLDS = Object.freeze({
  WARN_AT: 1,
  BAN_AT: 2, // 24h ban + ⚠️ negative badge
  RESTRICT_AT: 5, // 🚫 requires approval
  SUSPEND_AT: 10, // ☠️
});

// Time windows.
export const GRACE_PERIOD_HOURS = 48; // solution finalization
export const AUTO_BAN_HOURS = 24; // spam auto-ban
export const LRU_ARCHIVE_DAYS = 90; // archive unaccessed resolved queries
export const SOFT_DELETE_PURGE_DAYS = 30; // hard-delete after this
export const STALENESS_DAYS = 180; // flag answers older than this

// Quality gates.
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.8; // >80% → flag duplicate
export const MAX_ANSWERS_KEPT_ON_RESOLVE = 3;

// RAG chatbot: minimum cosine similarity for a retrieved doc to count as a match.
export const CHATBOT_MATCH_THRESHOLD = 0.3;

// Query amalgamation: cosine similarity to group "related" queries for admin
// review (broader than the strict duplicate threshold).
export const AMALGAMATION_SIMILARITY_THRESHOLD = 0.6;

// Embedding dimensions (fixed). Mirrors AI_EMBED_DIMS env default.
export const EMBEDDING_DIMS = 768;
