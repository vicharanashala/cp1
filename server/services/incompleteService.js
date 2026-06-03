// Unfinished / incomplete-question detection (PLANNING §9).
// A submission can clear the gibberish gate (it's made of real words) yet still
// be a half-typed, abandoned question — too short to act on, or visibly cut off
// mid-sentence. This gate catches those so they never reach the community.
//
//   Layer 1 — cheap local heuristics (length, dangling words, placeholders).
//   Layer 2 — borderline cases escalate to a cheap AI completeness check.
// In mock mode the AI layer returns a permissive default, so offline/CI runs
// rely on Layer 1 alone.
import { ai } from '../config/ai.js';
import { INCOMPLETE_MIN_BODY_WORDS, INCOMPLETE_MIN_TITLE_WORDS } from '../config/constants.js';

// Words a finished sentence rarely ends on — a trailing one of these strongly
// suggests the writer was cut off ("how do I reset my", "the error is because").
const DANGLING_TAIL = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'to', 'of', 'for',
  'with', 'in', 'on', 'at', 'by', 'from', 'my', 'i', 'is', 'are', 'was', 'were',
  'how', 'what', 'when', 'why', 'where', 'which', 'that', 'this', 'then', 'if',
]);

// Bodies that are obviously placeholder / non-content.
const PLACEHOLDERS = new Set(['test', 'testing', 'todo', 'tbd', 'na', 'idk', 'help', '...']);

const words = (text) => String(text ?? '').trim().split(/\s+/).filter(Boolean);

// Layer 1: returns whether the submission looks unfinished + the reasons why.
export function heuristicIncomplete(title, body) {
  const reasons = [];
  const titleWords = words(title);
  const bodyWords = words(body);
  const bodyText = String(body ?? '').trim();

  if (bodyWords.length < INCOMPLETE_MIN_BODY_WORDS) {
    reasons.push('the details are too short to describe a complete question');
  }
  if (titleWords.length < INCOMPLETE_MIN_TITLE_WORDS) {
    reasons.push('the title is too short to summarise a question');
  }

  const normalizedBody = bodyText.toLowerCase().replace(/[^a-z0-9.]/g, '');
  if (PLACEHOLDERS.has(normalizedBody)) {
    reasons.push('the details look like placeholder text, not a real question');
  }

  // Trailing-off: ends on a dangling connector with no terminal punctuation.
  const lastWord = bodyWords[bodyWords.length - 1]?.toLowerCase().replace(/[^a-z']/g, '');
  const endsCleanly = /[.!?]["')\]]?$/.test(bodyText);
  if (!endsCleanly && lastWord && DANGLING_TAIL.has(lastWord)) {
    reasons.push('the question appears to trail off mid-sentence');
  }

  return { is_incomplete: reasons.length > 0, reasons };
}

function buildPrompt(title, body) {
  return [
    'You are a content quality filter for a Q&A platform.',
    'Decide whether the following submission is a COMPLETE question (it can be',
    'understood and answered as-is) or an UNFINISHED/incomplete one (cut off,',
    'missing the actual ask, or too vague to answer).',
    'Respond ONLY as JSON: {"is_complete": boolean, "confidence": number, "reason": string}.',
    '',
    `Title: """${String(title ?? '').slice(0, 300)}"""`,
    `Details: """${String(body ?? '').slice(0, 2000)}"""`,
  ].join('\n');
}

/**
 * Detect an unfinished/incomplete question.
 * Returns { is_incomplete, layer, reasons }.
 *
 * Clear local signals (too short, placeholder) decide on their own. A lone
 * "trails off" signal is borderline, so it escalates to the AI layer (which is
 * permissive in mock mode) to avoid false-positives on terse-but-valid posts.
 */
export async function detectIncomplete(title, body) {
  const { is_incomplete, reasons } = heuristicIncomplete(title, body);
  if (!is_incomplete) return { is_incomplete: false, layer: 1, reasons: [] };

  // Strong local signals are conclusive on their own.
  const hasStrongSignal = reasons.some((r) => !r.includes('trail off'));
  if (hasStrongSignal) return { is_incomplete: true, layer: 1, reasons };

  // Borderline (only a "trails off" hint) → Layer 2 AI confirmation.
  const result = await ai.cheapJson(buildPrompt(title, body), {
    is_complete: true,
    confidence: 0.5,
    reason: 'offline mode: assumed complete',
  });
  const incomplete = result.is_complete === false;
  return {
    is_incomplete: incomplete,
    layer: 2,
    reasons: incomplete ? [...reasons, result.reason].filter(Boolean) : [],
  };
}

export default { detectIncomplete, heuristicIncomplete };
