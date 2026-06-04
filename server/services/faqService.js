import { FaqEntry } from '../models/FaqEntry.js';
import { Query } from '../models/Query.js';
import { Answer } from '../models/Answer.js';
import { ai } from '../config/ai.js';
import { ApiError } from '../utils/ApiError.js';
import { cosineSimilarity } from './vectorService.js';
import { FAQ_SOURCE, FAQ_DUPLICATE_THRESHOLD } from '../config/constants.js';

const round = (x) => Math.round(x * 1000) / 1000;

const faqText = (question, answer) => `${question}\n\n${answer}`.trim();
const strip = ({ embedding, __v, ...rest }) => ({ ...rest, id: rest._id }); // hide vector

/** All FAQ entries grouped by category, ordered for the accordion UI. */
export async function listFaqs({ category } = {}) {
  const filter = { is_deleted: false };
  if (category) filter.category = String(category); // coerce: avoid operator injection

  const entries = await FaqEntry.find(filter).sort({ category: 1, sort_order: 1, createdAt: 1 }).lean();

  const groups = new Map();
  for (const e of entries) {
    if (!groups.has(e.category)) groups.set(e.category, []);
    groups.get(e.category).push(strip(e));
  }
  // Number each entry 1..N within its section (in display order) so the UI and
  // the chatbot can cite a stable "Section, #N" reference.
  return [...groups.entries()].map(([cat, items]) => ({
    category: cat,
    items: items.map((it, i) => ({ ...it, number: i + 1 })),
  }));
}

/** Hybrid FAQ search: semantic (cosine over embeddings) + keyword boost. */
export async function searchFaqs(query) {
  const q = String(query ?? '').trim();
  if (!q) return [];

  const qEmbed = await ai.embed(q);
  const lc = q.toLowerCase();
  const entries = await FaqEntry.find({ is_deleted: false }).lean();

  return entries
    .map((e) => {
      const semantic = e.embedding ? cosineSimilarity(qEmbed, e.embedding) : 0;
      const keyword =
        e.question.toLowerCase().includes(lc) || e.answer.toLowerCase().includes(lc) ? 0.3 : 0;
      return { entry: strip(e), score: semantic + keyword };
    })
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((s) => ({ ...s.entry, score: Math.round(s.score * 1000) / 1000 }));
}

/** Create a FAQ entry (admin or promotion); embeds its text for search/RAG. */
export async function createFaq({ category, question, answer, sort_order = 0, source = FAQ_SOURCE.ADMIN, sourceQueryId = null, force = false }) {
  if (!category || !question || !answer) {
    throw ApiError.badRequest('category, question and answer are required');
  }
  const embedding = await ai.embed(faqText(question, answer));

  // Guard against adding a FAQ that already exists. Admin-authored entries are
  // checked for an exact question match or a near-identical embedding; pass
  // `force` to create anyway.
  if (source === FAQ_SOURCE.ADMIN && !force) {
    const lcQuestion = String(question).trim().toLowerCase();
    const existing = await FaqEntry.find({ is_deleted: false }).select('question embedding').lean();
    for (const e of existing) {
      const sim = e.embedding ? cosineSimilarity(embedding, e.embedding) : 0;
      if (e.question.trim().toLowerCase() === lcQuestion || sim >= FAQ_DUPLICATE_THRESHOLD) {
        throw ApiError.conflict('A similar FAQ already exists.', {
          duplicate: true,
          existing: { id: e._id, question: e.question, score: round(sim) },
        });
      }
    }
  }

  const entry = await FaqEntry.create({
    category: String(category).trim(),
    question: String(question).trim(),
    answer: String(answer).trim(),
    sort_order,
    source,
    source_query_id: sourceQueryId,
    embedding,
  });
  return strip(entry.toObject());
}

/** Admin: edit a FAQ entry; re-embeds when the question/answer text changes. */
export async function updateFaq(id, fields) {
  const entry = await FaqEntry.findOne({ _id: id, is_deleted: false });
  if (!entry) throw ApiError.notFound('FAQ entry not found');

  const question = fields.question !== undefined ? String(fields.question).trim() : entry.question;
  const answer = fields.answer !== undefined ? String(fields.answer).trim() : entry.answer;
  const textChanged = question !== entry.question || answer !== entry.answer;

  entry.question = question;
  entry.answer = answer;
  if (fields.category !== undefined) entry.category = String(fields.category).trim() || entry.category;
  if (fields.sort_order !== undefined) entry.sort_order = Number(fields.sort_order) || 0;
  if (fields.is_outdated !== undefined) entry.is_outdated = Boolean(fields.is_outdated);
  if (textChanged) entry.embedding = await ai.embed(faqText(question, answer));

  await entry.save();
  return strip(entry.toObject());
}

/** Admin: flag/unflag a FAQ entry as outdated. */
export async function setFaqOutdated(id, isOutdated) {
  const entry = await FaqEntry.findOneAndUpdate(
    { _id: id, is_deleted: false },
    { is_outdated: Boolean(isOutdated) },
    { new: true },
  ).lean();
  if (!entry) throw ApiError.notFound('FAQ entry not found');
  return strip(entry);
}

/** Admin: soft-delete a FAQ entry. */
export async function deleteFaq(id) {
  const entry = await FaqEntry.findOne({ _id: id, is_deleted: false });
  if (!entry) throw ApiError.notFound('FAQ entry not found');
  entry.is_deleted = true;
  entry.deleted_at = new Date();
  await entry.save();
  return { ok: true };
}

/**
 * Promote a resolved community Q&A into the FAQ (Milestone 5).
 * Uses the query title as the question and its accepted answer as the answer.
 */
export async function promoteQueryToFaq(queryId) {
  const query = await Query.findOne({ _id: queryId, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');
  if (!query.accepted_answer_id) {
    throw ApiError.badRequest('Only resolved questions with an accepted answer can be promoted');
  }

  const accepted = await Answer.findOne({ _id: query.accepted_answer_id, is_deleted: false });
  if (!accepted) throw ApiError.badRequest('The accepted answer is no longer available');

  const existing = await FaqEntry.findOne({ source_query_id: query._id, is_deleted: false });
  if (existing) throw ApiError.conflict('This question has already been promoted to the FAQ');

  return createFaq({
    category: query.category,
    question: query.title,
    answer: accepted.body,
    source: FAQ_SOURCE.QA,
    sourceQueryId: query._id,
  });
}
