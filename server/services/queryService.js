import crypto from 'node:crypto';
import { Query } from '../models/Query.js';
import { Answer } from '../models/Answer.js';
import { Vote } from '../models/Vote.js';
import { Bookmark } from '../models/Bookmark.js';
import { ModerationQueue } from '../models/ModerationQueue.js';
import { ai } from '../config/ai.js';
import { ApiError } from '../utils/ApiError.js';
import { detectGibberish } from './gibberishService.js';
import { detectIncomplete } from './incompleteService.js';
import { recordSpamStrike } from './spamService.js';
import { findSimilarQueries, cosineSimilarity } from './vectorService.js';
import * as taxonomyService from './taxonomyService.js';
import { topBadge } from './badgeService.js';
import {
  DUPLICATE_SIMILARITY_THRESHOLD,
  MODERATION_TYPE,
  QUERY_STATUS,
  ROLES,
  ATTENTION_FLAG_BADGE_KEY,
  EDIT_WINDOW_MINUTES,
  ROLLBACK_WINDOW_MINUTES,
} from '../config/constants.js';

const withinMinutes = (date, minutes) =>
  date != null && Date.now() - new Date(date).getTime() <= minutes * 60 * 1000;

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

// Parse a self-reported joining date; returns null for empty/invalid input.
function parseJoiningDate(value) {
  if (value == null || value === '') return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Constrain a query's category + tags to the admin-curated taxonomy. Users may
 * only pick from admin-defined terms (plus the built-in "others" tag) — anything
 * else is rejected here, so a hand-crafted request can't smuggle in its own
 * category/tag the way the old free-text inputs allowed.
 */
async function resolveTaxonomy(rawCategory, rawTags) {
  const [allowedCats, allowedTags] = await Promise.all([
    taxonomyService.allowedCategories(),
    taxonomyService.allowedTags(),
  ]);

  const category = String(rawCategory ?? '').trim().toLowerCase() || 'general';
  if (!allowedCats.includes(category)) {
    throw ApiError.badRequest(
      `"${category}" is not a selectable category. Choose one of the provided categories.`,
    );
  }

  const tags = normalizeTags(rawTags);
  const invalid = tags.filter((t) => !allowedTags.includes(t));
  if (invalid.length) {
    throw ApiError.badRequest(
      `These tags aren't selectable: ${invalid.join(', ')}. Pick a provided tag or use "others".`,
    );
  }

  return { category, tags };
}

// Hide the author when a query is anonymous; expose ownership so the author's
// own UI can still offer edit/delete on their anonymous post.
function serialize(obj, viewerId) {
  const plain = typeof obj.toObject === 'function' ? obj.toObject() : obj;
  const authorRef = plain.author_id;
  const authorId = authorRef?._id ?? authorRef;
  const isOwner = Boolean(viewerId && authorId && String(authorId) === String(viewerId));

  // Admins don't carry reputation: hide their points/badge wherever authors show.
  const isAdminAuthor = authorRef?.role === ROLES.ADMIN;
  const author = plain.is_anonymous
    ? { name: 'Anonymous', anonymous: true }
    : {
        id: authorId ?? null,
        name: authorRef?.name ?? null,
        points: isAdminAuthor ? null : (authorRef?.points ?? null),
        badge: isAdminAuthor ? null : topBadge(authorRef?.badges),
      };

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
 * gibberish gate → unfinished-question gate → embed → duplicate gate →
 * persist (+ moderation flag).
 * Throws ApiError(422) on gibberish or an unfinished question, ApiError(409)
 * on an un-acknowledged duplicate.
 */
export async function createQuery(user, payload, screenshots = []) {
  const title = String(payload.title ?? '').trim();
  const body = String(payload.body ?? '').trim();
  if (!title || !body) throw ApiError.badRequest('Title and body are required');

  // Gate 1 — gibberish (runs first so spam protection isn't bypassed). A blocked
  // attempt earns a spam strike AND is flagged to the moderation queue so admins
  // can see who is repeatedly tripping the filter.
  const gib = await detectGibberish(`${title} ${body}`);
  if (gib.is_gibberish) {
    const strike = await recordSpamStrike(user, 'Gibberish submission blocked');
    await ModerationQueue.create({
      type: MODERATION_TYPE.GIBBERISH,
      raised_by: user._id,
      reason: `Gibberish submission blocked: "${title}". ${(gib.reasons ?? []).join('; ')}`.slice(0, 500),
    });
    throw ApiError.unprocessable('This submission looks like gibberish and was blocked.', {
      gibberish: true,
      reasons: gib.reasons,
      ...strike,
    });
  }

  // Gate 2 — unfinished/incomplete question. Unlike gibberish this is an honest
  // mistake (a half-typed or cut-off post), so we block it WITHOUT a spam strike
  // and tell the asker what to finish.
  const incomplete = await detectIncomplete(title, body);
  if (incomplete.is_incomplete) {
    throw ApiError.unprocessable(
      'This question looks unfinished. Add a bit more detail and a clear ask before posting.',
      { incomplete: true, reasons: incomplete.reasons },
    );
  }

  // A joining date is mandatory — no posting without it.
  const joiningDate = parseJoiningDate(payload.joining_date);
  if (!joiningDate) throw ApiError.badRequest('Your joining date is required.');

  // Constrain category + tags to the admin-curated taxonomy (fail fast before
  // we spend an embedding call on a request with a disallowed category/tag).
  const { category, tags } = await resolveTaxonomy(payload.category, payload.tags);

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
    // Anonymous posting is disabled — every question is attributable to its author.
    is_anonymous: false,
    category,
    tags,
    contact_email: String(payload.contact_email ?? '').trim() || null,
    joining_date: joiningDate,
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

  await doc.populate('author_id', 'name points badges role');
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

  // "My" forum filter: questions the viewer asked, or ones they've answered.
  const mine = str(opts.mine);
  if (viewerId && mine === 'asked') {
    filter.author_id = viewerId;
  } else if (viewerId && mine === 'answered') {
    const answeredQueryIds = await Answer.find({ author_id: viewerId, is_deleted: false }).distinct(
      'query_id',
    );
    filter._id = { $in: answeredQueryIds };
  }

  const limit = Math.min(Number(opts.limit) || 20, 50);
  const page = Math.max(Number(opts.page) || 1, 1);

  // Forum ordering: resolved questions sink to the bottom (they no longer need
  // help), open/answered ones float up; within each band, newest first.
  const pipeline = [
    { $match: filter },
    { $addFields: { _resolved_rank: { $cond: [{ $eq: ['$status', QUERY_STATUS.RESOLVED] }, 1, 0] } } },
    { $sort: { _resolved_rank: 1, createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ];

  const [rawItems, total] = await Promise.all([
    Query.aggregate(pipeline),
    Query.countDocuments(filter),
  ]);
  const items = await Query.populate(rawItems, { path: 'author_id', select: 'name points badges role' });

  const enriched = await withEngagement(items, viewerId);
  return { items: enriched, total, page, limit };
}

// Attach answer counts (aggregated) and the viewer's vote/bookmark state to a
// page of queries — the data the forum cards + thread rails need.
async function withEngagement(items, viewerId) {
  if (items.length === 0) return [];
  const ids = items.map((it) => it._id);

  const counts = await Answer.aggregate([
    { $match: { query_id: { $in: ids }, is_deleted: false } },
    { $group: { _id: '$query_id', n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));

  let voteMap = new Map();
  let savedSet = new Set();
  if (viewerId) {
    const [votes, saves] = await Promise.all([
      Vote.find({ user_id: viewerId, query_id: { $in: ids } }).lean(),
      Bookmark.find({ user_id: viewerId, query_id: { $in: ids } }).lean(),
    ]);
    voteMap = new Map(votes.map((v) => [String(v.query_id), v.value]));
    savedSet = new Set(saves.map((s) => String(s.query_id)));
  }

  return items.map((it) => ({
    ...serialize(it, viewerId),
    answer_count: countMap.get(String(it._id)) ?? 0,
    my_vote: voteMap.get(String(it._id)) ?? 0,
    is_saved: savedSet.has(String(it._id)),
  }));
}

/**
 * Search forum questions (hybrid semantic + keyword), so community questions
 * surface in the knowledge-base search alongside FAQ entries.
 */
export async function searchQueries(qText, viewerId) {
  const q = String(qText ?? '').trim();
  if (!q) return [];

  const qEmbed = await ai.embed(q);
  const lc = q.toLowerCase();
  const docs = await Query.find({ is_deleted: false, is_archived: false })
    .populate('author_id', 'name points badges role')
    .lean();

  return docs
    .map((d) => {
      const semantic = d.embedding ? cosineSimilarity(qEmbed, d.embedding) : 0;
      const keyword =
        d.title?.toLowerCase().includes(lc) || d.body?.toLowerCase().includes(lc) ? 0.3 : 0;
      return { d, score: semantic + keyword };
    })
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((s) => ({ ...serialize(s.d, viewerId), score: round(s.score) }));
}

/** Distinct categories in use across active queries (for filter dropdowns). */
export async function listCategories() {
  const cats = await Query.distinct('category', { is_deleted: false, is_archived: false });
  return cats.filter(Boolean).sort((a, b) => a.localeCompare(b));
}

/** Fetch one query and record an LRU access touch. */
export async function getQuery(id, viewerId) {
  const doc = await Query.findOneAndUpdate(
    { _id: id, is_deleted: false },
    { $inc: { access_count: 1 }, $set: { last_accessed_at: new Date() } },
    { new: true },
  )
    .populate('author_id', 'name points badges role')
    .lean();
  if (!doc) throw ApiError.notFound('Query not found');

  // Auto-unarchive an LRU-evicted query when it's accessed again (but leave
  // merged queries archived — they live under their canonical thread now).
  if (doc.is_archived && doc.merge_status !== 'merged') {
    await Query.updateOne({ _id: doc._id }, { is_archived: false });
    doc.is_archived = false;
  }

  const base = serialize(doc, viewerId);
  const [answerCount, myVote, saved] = await Promise.all([
    Answer.countDocuments({ query_id: doc._id, is_deleted: false }),
    viewerId ? Vote.findOne({ query_id: doc._id, user_id: viewerId }).lean() : null,
    viewerId ? Bookmark.exists({ query_id: doc._id, user_id: viewerId }) : null,
  ]);
  return { ...base, answer_count: answerCount, my_vote: myVote?.value ?? 0, is_saved: Boolean(saved) };
}

/**
 * Up/down vote a query. `value` is 1, -1, or 0 (clear); re-voting the same way
 * toggles it off. Returns the new score and the viewer's vote. No reputation
 * effect (only answer upvotes award points).
 */
export async function voteQuery(user, id, value) {
  const v = Number(value);
  const desired = v === 1 || v === -1 ? v : 0;

  const query = await Query.findOne({ _id: id, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');
  if (String(query.author_id) === String(user._id)) {
    throw ApiError.badRequest('You cannot vote on your own question');
  }

  const existing = await Vote.findOne({ query_id: query._id, user_id: user._id });
  const old = existing?.value ?? 0;
  const next = desired === old ? 0 : desired; // re-voting the same way clears it

  if (next === 0) {
    if (existing) await existing.deleteOne();
  } else if (existing) {
    existing.value = next;
    await existing.save();
  } else {
    await Vote.create({ query_id: query._id, user_id: user._id, value: next });
  }

  const delta = next - old;
  query.vote_score = (query.vote_score ?? 0) + delta;
  await query.save();

  return { vote_score: query.vote_score, my_vote: next };
}

/** Toggle a bookmark on a query for the current user. */
export async function toggleBookmark(user, id) {
  const query = await Query.findOne({ _id: id, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');

  const existing = await Bookmark.findOne({ query_id: query._id, user_id: user._id });
  if (existing) {
    await existing.deleteOne();
    return { saved: false };
  }
  await Bookmark.create({ query_id: query._id, user_id: user._id });
  return { saved: true };
}

/** List the queries a user has bookmarked (most recent first). */
export async function listBookmarks(user) {
  const marks = await Bookmark.find({ user_id: user._id }).sort({ createdAt: -1 }).lean();
  if (marks.length === 0) return { items: [] };
  const ids = marks.map((m) => m.query_id);
  const items = await Query.find({ _id: { $in: ids }, is_deleted: false })
    .populate('author_id', 'name points badges role')
    .lean();
  // Preserve bookmark order (most-recently saved first).
  const order = new Map(ids.map((id2, i) => [String(id2), i]));
  items.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)));
  return { items: await withEngagement(items, String(user._id)) };
}

/** Edit a query (author only). Re-embeds when the text actually changes. */
export async function updateQuery(user, id, payload) {
  const doc = await Query.findById(id);
  if (!doc || doc.is_deleted) throw ApiError.notFound('Query not found');
  if (String(doc.author_id) !== String(user._id)) {
    throw ApiError.forbidden('You can only edit your own query');
  }
  // Authors may only edit within a short window after posting.
  if (!withinMinutes(doc.createdAt, EDIT_WINDOW_MINUTES)) {
    throw ApiError.forbidden(
      `The ${EDIT_WINDOW_MINUTES}-minute edit window for this question has passed.`,
    );
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
    const incomplete = await detectIncomplete(title, body);
    if (incomplete.is_incomplete) {
      throw ApiError.unprocessable(
        'This edit leaves the question unfinished. Add a bit more detail and a clear ask.',
        { incomplete: true, reasons: incomplete.reasons },
      );
    }
  }

  doc.title = title;
  doc.body = body;
  if (payload.category !== undefined || payload.tags !== undefined) {
    const { category, tags } = await resolveTaxonomy(
      payload.category !== undefined ? payload.category : doc.category,
      payload.tags !== undefined ? payload.tags : doc.tags,
    );
    doc.category = category;
    doc.tags = tags;
  }
  if (payload.contact_email !== undefined) {
    doc.contact_email = String(payload.contact_email).trim() || null;
  }
  if (payload.joining_date !== undefined) {
    doc.joining_date = parseJoiningDate(payload.joining_date);
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
  await doc.populate('author_id', 'name points badges role');
  return serialize(doc, user._id);
}

/**
 * Flag a question for admin attention. Restricted to members who hold the
 * Expert badge (and admins). Records who flagged it and when, so the admin
 * attention queue can surface and sort it.
 */
export async function flagForAttention(user, id) {
  const isExpert = (user.badges ?? []).includes(ATTENTION_FLAG_BADGE_KEY);
  if (!isExpert && user.role !== ROLES.ADMIN && !user.is_moderator) {
    throw ApiError.forbidden(
      'Only Expert-level members or moderators can flag a question for admin attention',
    );
  }

  const query = await Query.findOne({ _id: id, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');

  if (!query.needs_attention) {
    query.needs_attention = true;
    query.attention_flagged_by = user._id;
    query.attention_flagged_at = new Date();
    await query.save();
  }
  return { ok: true, needs_attention: true };
}

/**
 * Re-categorise / re-tag a question. Admins and moderators only — the asker
 * uses the normal edit flow. Validated against the admin taxonomy like any
 * other category/tag change.
 */
export async function moderateTaxonomy(user, id, { category, tags }) {
  const canModerate = user.role === ROLES.ADMIN || user.is_moderator;
  if (!canModerate) {
    throw ApiError.forbidden('Only moderators or admins can change a question’s category or tags');
  }
  const doc = await Query.findById(id);
  if (!doc || doc.is_deleted) throw ApiError.notFound('Query not found');

  const resolved = await resolveTaxonomy(
    category !== undefined ? category : doc.category,
    tags !== undefined ? tags : doc.tags,
  );
  doc.category = resolved.category;
  doc.tags = resolved.tags;
  await doc.save();
  await doc.populate('author_id', 'name points badges role');
  return serialize(doc, user._id);
}

/** Soft-delete a query (author or admin). */
export async function deleteQuery(user, id) {
  const doc = await Query.findById(id);
  if (!doc || doc.is_deleted) throw ApiError.notFound('Query not found');

  const isOwner = String(doc.author_id) === String(user._id);
  const canModerate = user.role === ROLES.ADMIN || user.is_moderator;
  if (!isOwner && !canModerate) {
    throw ApiError.forbidden('You can only delete your own query');
  }

  doc.is_deleted = true;
  doc.deleted_at = new Date();
  doc.deleted_by = user._id;
  await doc.save();
  return { ok: true };
}

/**
 * Restore a soft-deleted question. Admins/moderators only, and only within the
 * rollback window — the safety net for a mistaken deletion.
 */
export async function restoreQuery(user, id) {
  const canModerate = user.role === ROLES.ADMIN || user.is_moderator;
  if (!canModerate) throw ApiError.forbidden('Only moderators or admins can restore a question');

  const doc = await Query.findById(id);
  if (!doc || !doc.is_deleted) throw ApiError.notFound('No deleted question to restore');
  if (!withinMinutes(doc.deleted_at, ROLLBACK_WINDOW_MINUTES)) {
    throw ApiError.badRequest(`The ${ROLLBACK_WINDOW_MINUTES}-minute rollback window has passed.`);
  }

  doc.is_deleted = false;
  doc.deleted_at = null;
  doc.deleted_by = null;
  await doc.save();
  return { ok: true };
}

// Deterministic offline tidy — used as the mock-mode result so the
// "Refine with AI" feature still does something useful with no AI key.
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

function refinePrompt(text) {
  return [
    'Refine the text below for grammar, spelling and clarity WITHOUT changing its meaning.',
    'Respond ONLY as JSON: {"corrected": string, "changes": [{"type": string, "note": string}]}.',
    '',
    `Text:\n"""${text.slice(0, 4000)}"""`,
  ].join('\n');
}

/** Opt-in "Refine with AI" pass. Returns the refined text + a change list. */
export async function refineText(text) {
  const input = String(text ?? '').trim();
  if (!input) throw ApiError.badRequest('Text is required');

  const result = await ai.cheapJson(refinePrompt(input), offlineAutocorrect(input));
  const corrected = typeof result.corrected === 'string' ? result.corrected : input;
  const changes = Array.isArray(result.changes) ? result.changes : [];
  return { original: input, corrected, changes, has_changes: corrected.trim() !== input };
}
