import crypto from 'node:crypto';
import { Query } from '../models/Query.js';
import { ModerationQueue } from '../models/ModerationQueue.js';
import { ai } from '../config/ai.js';
import { ApiError } from '../utils/ApiError.js';
import { detectGibberish } from './gibberishService.js';
import { recordSpamStrike } from './spamService.js';
import { findSimilarQueries } from './vectorService.js';
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  MODERATION_TYPE,
  QUERY_STATUS,
  ROLES,
} from '../config/constants.js';

const round = (x) => Math.round(x * 1000) / 1000;
const asBool = (v) => v === true || v === 'true' || v === '1';

function normalizeTags(tags) {
  const arr = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(',')
      : [];
  return [...new Set(arr.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 10);
}

const embeddingText = (title, body) => `${title}\n\n${body}`.trim();
const hashText = (text) => crypto.createHash('sha256').update(text).digest('hex');

// Hide the author when a query is anonymous; expose ownership so the author's
// own UI can still offer edit/delete on their anonymous post.
function serialize(obj, viewerId) {
  const plain = typeof obj.toObject === 'function' ? obj.toObject() : obj;
  const authorRef = plain.author_id;
  const authorId = authorRef?._id ?? authorRef;
  const isOwner = Boolean(viewerId && authorId && String(authorId) === String(viewerId));

  const author = plain.is_anonymous
    ? { name: 'Anonymous', anonymous: true }
    : { id: authorId ?? null, name: authorRef?.name ?? null };

  // eslint-disable-next-line no-unused-vars
  const { embedding, embedding_hash, author_id, __v, ...rest } = plain;
  return { ...rest, id: plain._id, author, is_owner: isOwner };
}

// Compute (or reuse) an embedding for the given title/body.
async function embedFor(title, body) {
  const text = embeddingText(title, body);
  return { embedding: await ai.embed(text), embedding_hash: hashText(text) };
}

/**
 * Create a query through the full quality-gated intake flow:
 * gibberish gate → embed → duplicate gate → persist (+ moderation flag).
 * Throws ApiError(422) on gibberish, ApiError(409) on an un-acknowledged duplicate.
 */
export async function createQuery(user, payload, screenshots = []) {
  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  if (!title || !body) throw ApiError.badRequest('Title and body are required');

  // Gate 1 — gibberish.
  const gib = await detectGibberish(`${title} ${body}`);
  if (gib.is_gibberish) {
    const strike = await recordSpamStrike(user, 'Gibberish submission blocked');
    throw ApiError.unprocessable('This submission looks like gibberish and was blocked.', {
      gibberish: true,
      reasons: gib.reasons,
      ...strike,
    });
  }

  // Gate 2 — duplicate detection (never auto-reject; warn, then flag on override).
  const { embedding, embedding_hash } = await embedFor(title, body);
  const matches = await findSimilarQueries(embedding, {
    limit: 5,
    threshold: DUPLICATE_SIMILARITY_THRESHOLD,
  });

  if (matches.length && !asBool(payload.post_anyway)) {
    throw ApiError.conflict('A similar question already exists.', {
      duplicate: true,
      matches: matches.map((m) => ({
        id: m.query._id,
        title: m.query.title,
        score: round(m.score),
      })),
    });
  }

  const best = matches[0] ?? null;
  const wasCorrected = Boolean(payload.original_body && payload.original_body.trim() !== body);

  const doc = await Query.create({
    title,
    body,
    author_id: user._id,
    is_anonymous: asBool(payload.is_anonymous),
    category: String(payload.category ?? '').trim() || 'general',
    tags: normalizeTags(payload.tags),
    contact_email: String(payload.contact_email ?? '').trim() || null,
    screenshots,
    original_body: wasCorrected ? payload.original_body : null,
    was_auto_corrected: wasCorrected,
    embedding,
    embedding_hash,
    is_flagged_duplicate: Boolean(best),
    duplicate_of: best?.query._id ?? null,
    similarity_score: best ? round(best.score) : null,
    merge_status: best ? 'pending' : 'none',
  });

  if (best) {
    await ModerationQueue.create({
      type: MODERATION_TYPE.DUPLICATE,
      query_id: doc._id,
      duplicate_of_query_id: best.query._id,
      similarity_score: round(best.score),
      raised_by: user._id,
      reason: 'Posted despite a duplicate warning',
    });
  }

  await doc.populate('author_id', 'name');
  return serialize(doc, user._id);
}

/** List non-deleted queries with optional filters + pagination. */
export async function listQueries(opts = {}, viewerId) {
  // Coerce all user-supplied filters to primitive strings. Express' query
  // parser turns `?category[$ne]=x` into an object, which would otherwise be
  // injected as a Mongo operator (NoSQL injection) into the find filter.
  const str = (v) => (v == null ? undefined : String(v));
  const category = str(opts.category);
  const tag = str(opts.tag);
  const status = str(opts.status);
  const q = str(opts.q);

  const filter = { is_deleted: false };
  // Hide archived queries (LRU-evicted or merged) from the active list, unless
  // archived ones are explicitly requested.
  filter.is_archived = status === QUERY_STATUS.ARCHIVED;
  if (category) filter.category = category;
  if (tag) filter.tags = tag;
  if (status) filter.status = status;
  if (q) filter.$text = { $search: q };

  const limit = Math.min(Number(opts.limit) || 20, 50);
  const page = Math.max(Number(opts.page) || 1, 1);

  const [items, total] = await Promise.all([
    Query.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('author_id', 'name')
      .lean(),
    Query.countDocuments(filter),
  ]);

  return { items: items.map((it) => serialize(it, viewerId)), total, page, limit };
}

/** Fetch one query and record an LRU access touch. */
export async function getQuery(id, viewerId) {
  const doc = await Query.findOneAndUpdate(
    { _id: id, is_deleted: false },
    { $inc: { access_count: 1 }, $set: { last_accessed_at: new Date() } },
    { new: true },
  )
    .populate('author_id', 'name')
    .lean();
  if (!doc) throw ApiError.notFound('Query not found');

  // Auto-unarchive an LRU-evicted query when it's accessed again (but leave
  // merged queries archived — they live under their canonical thread now).
  if (doc.is_archived && doc.merge_status !== 'merged') {
    await Query.updateOne({ _id: doc._id }, { is_archived: false });
    doc.is_archived = false;
  }

  return serialize(doc, viewerId);
}

/** Edit a query (author only). Re-embeds when the text actually changes. */
export async function updateQuery(user, id, payload) {
  const doc = await Query.findById(id);
  if (!doc || doc.is_deleted) throw ApiError.notFound('Query not found');
  if (String(doc.author_id) !== String(user._id)) {
    throw ApiError.forbidden('You can only edit your own query');
  }

  const title = payload.title !== undefined ? String(payload.title).trim() : doc.title;
  const body = payload.body !== undefined ? String(payload.body).trim() : doc.body;
  if (!title || !body) throw ApiError.badRequest('Title and body cannot be empty');

  const textChanged = title !== doc.title || body !== doc.body;
  if (textChanged) {
    const gib = await detectGibberish(`${title} ${body}`);
    if (gib.is_gibberish) {
      const strike = await recordSpamStrike(user, 'Gibberish edit blocked');
      throw ApiError.unprocessable('This edit looks like gibberish and was blocked.', {
        gibberish: true,
        reasons: gib.reasons,
        ...strike,
      });
    }
  }

  doc.title = title;
  doc.body = body;
  if (payload.category !== undefined) doc.category = String(payload.category).trim() || 'general';
  if (payload.tags !== undefined) doc.tags = normalizeTags(payload.tags);
  if (payload.contact_email !== undefined) {
    doc.contact_email = String(payload.contact_email).trim() || null;
  }

  if (textChanged) {
    const text = embeddingText(title, body);
    const hash = hashText(text);
    if (hash !== doc.embedding_hash) {
      doc.embedding = await ai.embed(text);
      doc.embedding_hash = hash;
    }
  }

  await doc.save();
  await doc.populate('author_id', 'name');
  return serialize(doc, user._id);
}

/** Soft-delete a query (author or admin). */
export async function deleteQuery(user, id) {
  const doc = await Query.findById(id);
  if (!doc || doc.is_deleted) throw ApiError.notFound('Query not found');

  const isOwner = String(doc.author_id) === String(user._id);
  if (!isOwner && user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('You can only delete your own query');
  }

  doc.is_deleted = true;
  doc.deleted_at = new Date();
  await doc.save();
  return { ok: true };
}

// Deterministic offline grammar tidy — used as the mock-mode result so the
// "Check grammar" feature still does something useful with no AI key.
function offlineAutocorrect(text) {
  let corrected = text.replace(/\s+/g, ' ').trim();
  corrected = corrected.replace(/\bi\b/g, 'I');
  if (corrected) corrected = corrected[0].toUpperCase() + corrected.slice(1);
  if (corrected && !/[.!?]$/.test(corrected)) corrected += '.';
  const changes =
    corrected !== text
      ? [{ type: 'style', note: 'Tidied spacing, capitalization and punctuation.' }]
      : [];
  return { corrected, changes };
}

function grammarPrompt(text) {
  return [
    'Fix grammar, spelling and clarity of the text below WITHOUT changing its meaning.',
    'Respond ONLY as JSON: {"corrected": string, "changes": [{"type": string, "note": string}]}.',
    '',
    `Text:\n"""${text.slice(0, 4000)}"""`,
  ].join('\n');
}

/** Opt-in grammar/clarity check. Returns the corrected text + a change list. */
export async function checkGrammar(text) {
  const input = String(text ?? '').trim();
  if (!input) throw ApiError.badRequest('Text is required');

  const result = await ai.cheapJson(grammarPrompt(input), offlineAutocorrect(input));
  const corrected = typeof result.corrected === 'string' ? result.corrected : input;
  const changes = Array.isArray(result.changes) ? result.changes : [];
  return { original: input, corrected, changes, has_changes: corrected.trim() !== input };
}
