import crypto from 'node:crypto';
import { ChatbotSession } from '../models/ChatbotSession.js';
import { FaqEntry } from '../models/FaqEntry.js';
import { Query } from '../models/Query.js';
import { Answer } from '../models/Answer.js';
import { ai } from '../config/ai.js';
import { ApiError } from '../utils/ApiError.js';
import { cosineSimilarity } from './vectorService.js';
import { CHATBOT_MATCH_THRESHOLD } from '../config/constants.js';

const FALLBACK =
  "I couldn't find a confident match in the FAQ or the community Q&A. Try rephrasing your question, browse the FAQ, or ask the community directly.";

// Best-scoring document by cosine similarity to the question embedding.
function bestMatch(qEmbed, docs) {
  let best = null;
  for (const doc of docs) {
    if (!doc.embedding) continue;
    const score = cosineSimilarity(qEmbed, doc.embedding);
    if (!best || score > best.score) best = { doc, score };
  }
  return best;
}

function buildPrompt(question, contextLabel, contextText) {
  return [
    'You are the FAQ Platform assistant. Answer the user using ONLY the context below.',
    'Be concise and accurate. If the context does not fully answer, say what is missing.',
    '',
    `Context (${contextLabel}):`,
    contextText,
    '',
    `User question: ${question}`,
  ].join('\n');
}

// Compose with the live model; degrade gracefully (429 / errors) to the grounded
// text so the chatbot always returns something useful. Mock mode returns `grounded`.
async function compose(prompt, grounded) {
  try {
    const text = await ai.chat(prompt, grounded);
    return text || grounded || FALLBACK;
  } catch {
    return grounded || FALLBACK;
  }
}

async function getOrCreateSession(token, userId) {
  if (token) {
    const existing = await ChatbotSession.findOne({ session_token: token });
    if (existing) {
      const owner = existing.user_id ? String(existing.user_id) : null;
      // Reuse only an anonymous session or one owned by this same user —
      // never let a caller append to another user's session by replaying
      // their token. A logged-in user may claim an anonymous session.
      if (!owner) {
        if (userId) {
          existing.user_id = userId;
          await existing.save();
        }
        return existing;
      }
      if (userId && owner === String(userId)) return existing;
      // Token belongs to a different user → ignore it and start fresh.
    }
  }
  // Always mint a fresh, unguessable token server-side (prevents session
  // fixation via a client-chosen token).
  return ChatbotSession.create({
    session_token: crypto.randomUUID(),
    user_id: userId ?? null,
  });
}

/**
 * Two-tier RAG (PLANNING §9): embed → Tier 1 FAQ → Tier 2 community Q&A →
 * compose with citations, else graceful fallback. Persists the exchange.
 */
export async function ask({ sessionToken, userId, message }) {
  const text = String(message ?? '').trim();
  if (!text) throw ApiError.badRequest('Message is required');

  const session = await getOrCreateSession(sessionToken, userId);
  const qEmbed = await ai.embed(text);

  let reply;

  // Tier 1 — curated FAQ.
  const faqs = await FaqEntry.find({ is_deleted: false }).select('question answer embedding').lean();
  const faqHit = bestMatch(qEmbed, faqs);

  if (faqHit && faqHit.score >= CHATBOT_MATCH_THRESHOLD) {
    const f = faqHit.doc;
    const content = await compose(
      buildPrompt(text, 'FAQ entry', `Q: ${f.question}\nA: ${f.answer}`),
      f.answer,
    );
    reply = {
      content,
      source_tier: 'faq',
      citations: [{ kind: 'faq', ref_id: f._id, title: f.question }],
    };
  } else {
    // Tier 2 — resolved community Q&A.
    const queries = await Query.find({
      is_deleted: false,
      accepted_answer_id: { $ne: null },
      embedding: { $exists: true, $ne: null },
    })
      .select('title embedding accepted_answer_id')
      .lean();
    const qHit = bestMatch(qEmbed, queries);

    if (qHit && qHit.score >= CHATBOT_MATCH_THRESHOLD) {
      const q = qHit.doc;
      const accepted = await Answer.findById(q.accepted_answer_id).lean();
      const body = accepted?.body ?? '';
      const content = await compose(
        buildPrompt(text, 'community answer', `Q: ${q.title}\nA: ${body}`),
        body,
      );
      reply = {
        content,
        source_tier: 'community',
        citations: [{ kind: 'query', ref_id: q._id, title: q.title }],
      };
    } else {
      reply = { content: FALLBACK, source_tier: 'fallback', citations: [] };
    }
  }

  session.messages.push({ role: 'user', content: text });
  session.messages.push({
    role: 'assistant',
    content: reply.content,
    source_tier: reply.source_tier,
    citations: reply.citations,
  });
  await session.save();

  return { session_token: session.session_token, ...reply };
}

/** Load a chat session's history (empty shell if the token is unknown). */
export async function getSession(token, viewerId) {
  const session = await ChatbotSession.findOne({ session_token: token }).lean();
  if (!session) return { session_token: token, messages: [] };
  // A user-owned session may only be read by its owner; anonymous sessions
  // remain readable by anyone holding the (unguessable) token.
  if (session.user_id && String(session.user_id) !== String(viewerId ?? '')) {
    throw ApiError.forbidden('This chat session belongs to another user');
  }
  return { session_token: session.session_token, messages: session.messages };
}
