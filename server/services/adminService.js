import { User } from '../models/User.js';
import { Query } from '../models/Query.js';
import { Answer } from '../models/Answer.js';
import { FaqEntry } from '../models/FaqEntry.js';
import { ModerationQueue } from '../models/ModerationQueue.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from './notificationService.js';
import { cosineSimilarity } from './vectorService.js';
import {
  ROLES,
  QUERY_STATUS,
  MODERATION_STATUS,
  NOTIFICATION_TYPE,
  AMALGAMATION_SIMILARITY_THRESHOLD,
  ROLLBACK_WINDOW_MINUTES,
} from '../config/constants.js';

const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const paginate = (opts) => {
  const limit = Math.min(Number(opts.limit) || 20, 50);
  const page = Math.max(Number(opts.page) || 1, 1);
  return { limit, page, skip: (page - 1) * limit };
};

/** Dashboard metrics overview. */
export async function getMetrics() {
  const [users, banned, queries, open, resolved, answers, faqs, pendingModeration, needsAttention] =
    await Promise.all([
      User.countDocuments({ is_deleted: false }),
      User.countDocuments({ is_deleted: false, is_banned: true }),
      Query.countDocuments({ is_deleted: false }),
      Query.countDocuments({ is_deleted: false, status: QUERY_STATUS.OPEN }),
      Query.countDocuments({ is_deleted: false, status: QUERY_STATUS.RESOLVED }),
      Answer.countDocuments({ is_deleted: false }),
      FaqEntry.countDocuments({ is_deleted: false }),
      ModerationQueue.countDocuments({ status: MODERATION_STATUS.PENDING }),
      Query.countDocuments({ is_deleted: false, needs_attention: true }),
    ]);
  const resolution_rate = queries ? Math.round((resolved / queries) * 1000) / 10 : 0;
  return {
    users,
    banned,
    queries,
    open,
    resolved,
    answers,
    faqs,
    pending_moderation: pendingModeration,
    needs_attention: needsAttention,
    resolution_rate,
  };
}

/** Every moderator (and admins, who moderate implicitly), for the admin roster. */
export async function listModerators() {
  const mods = await User.find({
    is_deleted: false,
    $or: [{ is_moderator: true }, { role: ROLES.ADMIN }],
  })
    .select('name email role is_moderator points createdAt')
    .sort({ role: 1, name: 1 })
    .lean();
  return mods.map((u) => ({
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    is_moderator: Boolean(u.is_moderator),
    is_admin: u.role === ROLES.ADMIN,
    points: u.points,
    since: u.createdAt,
  }));
}

/** Paginated user list with optional name/email search. */
export async function listUsers(opts = {}) {
  const { limit, page, skip } = paginate(opts);
  const filter = { is_deleted: false };
  if (opts.q) {
    const rx = new RegExp(escapeRegex(opts.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('name email role is_moderator moderator_requested points badges negative_badges is_banned ban_expires_at requires_approval createdAt')
      .lean(),
    User.countDocuments(filter),
  ]);
  return { items: items.map((u) => ({ ...u, id: u._id })), total, page, limit };
}

/** Admin: change a user's role. */
export async function setRole(admin, userId, role) {
  if (!Object.values(ROLES).includes(role)) throw ApiError.badRequest('Invalid role');
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  user.role = role;
  await user.save();
  await AuditLog.create({
    action: 'user.set_role',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: { role },
  });
  return { ok: true, role };
}

/** Moderation queue, filterable by status (default pending) and type. */
export async function listModeration(opts = {}) {
  const { limit, page, skip } = paginate(opts);
  const filter = {};
  // Coerce to strings so query-string operator objects can't be injected.
  filter.status = opts.status ? String(opts.status) : MODERATION_STATUS.PENDING;
  if (opts.type) filter.type = String(opts.type);

  const [items, total] = await Promise.all([
    ModerationQueue.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('query_id', 'title status')
      .populate('duplicate_of_query_id', 'title')
      .populate('raised_by', 'name')
      .lean(),
    ModerationQueue.countDocuments(filter),
  ]);
  return { items, total, page, limit };
}

async function closeModeration(admin, id, status, note) {
  const item = await ModerationQueue.findById(id);
  if (!item) throw ApiError.notFound('Moderation item not found');
  item.status = status;
  item.resolved_by = admin._id;
  item.resolved_at = new Date();
  item.resolution_note = note ?? null;
  await item.save();
  return item;
}

export async function resolveModeration(admin, id, note) {
  await closeModeration(admin, id, MODERATION_STATUS.RESOLVED, note);
  return { ok: true };
}

export async function dismissModeration(admin, id, note) {
  const item = await closeModeration(admin, id, MODERATION_STATUS.DISMISSED, note);
  // Dismissing a duplicate flag clears it from the query.
  if (item.query_id) {
    await Query.updateOne(
      { _id: item.query_id },
      { is_flagged_duplicate: false, duplicate_of: null, similarity_score: null, merge_status: 'none' },
    );
  }
  return { ok: true };
}

/**
 * Merge a duplicate query into a canonical one: reassign its answers, archive
 * it, link both directions, and resolve any pending duplicate flags.
 */
export async function mergeQueries(admin, { canonicalId, duplicateId, moderationId }) {
  if (!canonicalId || !duplicateId) throw ApiError.badRequest('canonicalId and duplicateId are required');
  if (String(canonicalId) === String(duplicateId)) {
    throw ApiError.badRequest('Cannot merge a query into itself');
  }

  const [canonical, duplicate] = await Promise.all([
    Query.findOne({ _id: canonicalId, is_deleted: false }),
    Query.findOne({ _id: duplicateId, is_deleted: false }),
  ]);
  if (!canonical || !duplicate) throw ApiError.notFound('Query not found');

  // Combine: move the duplicate's answers under the canonical thread.
  await Answer.updateMany({ query_id: duplicate._id, is_deleted: false }, { query_id: canonical._id });

  duplicate.merge_status = 'merged';
  duplicate.merged_into = canonical._id;
  duplicate.is_flagged_duplicate = false;
  duplicate.status = QUERY_STATUS.ARCHIVED;
  duplicate.is_archived = true;
  await duplicate.save();

  if (!canonical.merged_from.some((q) => String(q) === String(duplicate._id))) {
    canonical.merged_from.push(duplicate._id);
    await canonical.save();
  }

  // Resolve the triggering item and any pending duplicate flags for this query.
  if (moderationId) await closeModeration(admin, moderationId, MODERATION_STATUS.RESOLVED, 'Merged');
  await ModerationQueue.updateMany(
    { query_id: duplicate._id, status: MODERATION_STATUS.PENDING },
    { status: MODERATION_STATUS.RESOLVED, resolved_by: admin._id, resolved_at: new Date(), resolution_note: 'Merged' },
  );

  await AuditLog.create({
    action: 'query.merge',
    entity_type: 'query',
    entity_id: duplicate._id,
    performed_by: admin._id,
    details: { merged_into: String(canonical._id) },
  });
  await notify({
    recipientId: duplicate.author_id,
    type: NOTIFICATION_TYPE.SYSTEM,
    title: 'Your question was merged',
    message: `Merged into: ${canonical.title}`,
    link: `/queries/${canonical._id}`,
    queryId: canonical._id,
  });

  return { ok: true, canonical_id: canonical._id, duplicate_id: duplicate._id };
}

/**
 * Amalgamation: greedily cluster active queries whose embeddings are similar
 * above the amalgamation threshold, so an admin can merge related threads.
 */
export async function findQueryClusters() {
  const queries = await Query.find({
    is_deleted: false,
    is_archived: false,
    embedding: { $exists: true, $ne: null },
  })
    .select('title category embedding createdAt')
    .lean();

  const used = new Set();
  const clusters = [];

  for (let i = 0; i < queries.length; i++) {
    if (used.has(String(queries[i]._id))) continue;
    const group = [{ id: queries[i]._id, title: queries[i].title, category: queries[i].category }];
    used.add(String(queries[i]._id));

    for (let j = i + 1; j < queries.length; j++) {
      if (used.has(String(queries[j]._id))) continue;
      const score = cosineSimilarity(queries[i].embedding, queries[j].embedding);
      if (score >= AMALGAMATION_SIMILARITY_THRESHOLD) {
        group.push({
          id: queries[j]._id,
          title: queries[j].title,
          category: queries[j].category,
          score: Math.round(score * 1000) / 1000,
        });
        used.add(String(queries[j]._id));
      }
    }

    if (group.length > 1) clusters.push(group);
  }
  return clusters;
}

/**
 * Group active queries by category with a per-status breakdown — the central
 * "technical queries by topic" view for the admin dashboard.
 */
export async function queriesByCategory() {
  const rows = await Query.aggregate([
    { $match: { is_deleted: false } },
    { $group: { _id: { category: '$category', status: '$status' }, n: { $sum: 1 } } },
  ]);

  const map = new Map();
  for (const r of rows) {
    const category = r._id.category || 'general';
    if (!map.has(category)) {
      map.set(category, { category, total: 0, open: 0, answered: 0, resolved: 0, archived: 0 });
    }
    const entry = map.get(category);
    entry.total += r.n;
    if (r._id.status in entry) entry[r._id.status] += r.n;
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}

/**
 * Questions an Expert has flagged as needing admin attention, grouped **by
 * category**, then ordered by the asker's joining date, then the question's
 * posting date — the order the admin works the list in.
 */
export async function listAttentionQueries() {
  const queries = await Query.find({ needs_attention: true, is_deleted: false })
    .populate('author_id', 'name email createdAt')
    .populate('attention_flagged_by', 'name')
    .lean();

  // Grouped by category, then ordered by the asker's joining date, then by the
  // question's posting date — the order the admin works the list in.
  queries.sort(
    (a, b) =>
      (a.category || '').localeCompare(b.category || '') ||
      new Date(a.joining_date ?? a.author_id?.createdAt ?? 0) -
        new Date(b.joining_date ?? b.author_id?.createdAt ?? 0) ||
      new Date(a.createdAt) - new Date(b.createdAt),
  );

  return queries.map((q) => ({
    id: q._id,
    title: q.title,
    category: q.category || 'general',
    status: q.status,
    posted_at: q.createdAt,
    flagged_at: q.attention_flagged_at,
    // The queue lists askers by their email id; the question opens on click.
    email: q.contact_email || q.author_id?.email || null,
    joining_date: q.joining_date ?? null,
    flagged_by: q.attention_flagged_by ? { id: q.attention_flagged_by._id, name: q.attention_flagged_by.name } : null,
    author: q.author_id
      ? {
          id: q.author_id._id,
          name: q.author_id.name,
          email: q.author_id.email,
          joined_at: q.author_id.createdAt,
        }
      : null,
  }));
}

/** Clear the admin-attention flag on a question once it has been handled. */
export async function clearAttention(admin, id) {
  const query = await Query.findOne({ _id: id, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');
  query.needs_attention = false;
  query.attention_flagged_by = null;
  query.attention_flagged_at = null;
  await query.save();
  await AuditLog.create({
    action: 'query.attention_cleared',
    entity_type: 'query',
    entity_id: query._id,
    performed_by: admin._id,
    details: {},
  });
  return { ok: true };
}

/**
 * Recently soft-deleted questions and answers that are still within the rollback
 * window — what the admin "Rollback" view offers to restore.
 */
export async function listRecentDeletions() {
  const since = new Date(Date.now() - ROLLBACK_WINDOW_MINUTES * 60 * 1000);
  const [queries, answers] = await Promise.all([
    Query.find({ is_deleted: true, deleted_at: { $gte: since } })
      .populate('deleted_by', 'name')
      .sort({ deleted_at: -1 })
      .lean(),
    Answer.find({ is_deleted: true, deleted_at: { $gte: since } })
      .populate('deleted_by', 'name')
      .populate('query_id', 'title')
      .sort({ deleted_at: -1 })
      .lean(),
  ]);

  return {
    window_minutes: ROLLBACK_WINDOW_MINUTES,
    queries: queries.map((q) => ({
      id: q._id,
      title: q.title,
      deleted_at: q.deleted_at,
      deleted_by: q.deleted_by?.name ?? null,
    })),
    answers: answers.map((a) => ({
      id: a._id,
      query_id: a.query_id?._id ?? null,
      query_title: a.query_id?.title ?? null,
      excerpt: String(a.body ?? '').replace(/\s+/g, ' ').slice(0, 120),
      deleted_at: a.deleted_at,
      deleted_by: a.deleted_by?.name ?? null,
    })),
  };
}

/** Paginated audit log (most recent first). */
export async function listAudit(opts = {}) {
  const { limit, page, skip } = paginate(opts);
  const [items, total] = await Promise.all([
    AuditLog.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performed_by', 'name')
      .lean(),
    AuditLog.countDocuments({}),
  ]);
  return { items, total, page, limit };
}
