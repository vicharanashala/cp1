import { Answer } from '../models/Answer.js';
import { Query } from '../models/Query.js';
import { AuditLog } from '../models/AuditLog.js';
import { notify } from '../services/notificationService.js';
import { awardPoints } from '../services/badgeService.js';
import {
  QUERY_STATUS,
  NOTIFICATION_TYPE,
  POINTS,
  GRACE_PERIOD_HOURS,
  MAX_ANSWERS_KEPT_ON_RESOLVE,
} from '../config/constants.js';

const graceMs = GRACE_PERIOD_HOURS * 60 * 60 * 1000;

// Is this answered-but-unresolved query due for finalization?
//   Path A — author marked a solution → grace_period_deadline elapsed.
//   Path B — no selection → 48h after the first answer.
function isDue(query, now) {
  if (query.accepted_answer_id) {
    return Boolean(query.grace_period_deadline && query.grace_period_deadline <= now);
  }
  return Boolean(
    query.first_answered_at && new Date(query.first_answered_at.getTime() + graceMs) <= now,
  );
}

/**
 * Solution finalization job (PLANNING §9 Solution Marking Engine).
 * Resolves due queries: keeps the accepted answer + most-liked (up to the cap),
 * prunes the rest, awards points only when the author actively marked (Path A).
 * @param {{ force?: boolean }} [opts] force ignores the grace timers (manual trigger / demo).
 * @returns {Promise<{ resolved: number, pruned: number }>}
 */
export async function finalizeSolutions({ force = false } = {}) {
  const now = new Date();
  const candidates = await Query.find({
    is_deleted: false,
    status: { $ne: QUERY_STATUS.RESOLVED },
  });

  let resolved = 0;
  let pruned = 0;

  for (const query of candidates) {
    const answers = await Answer.find({ query_id: query._id, is_deleted: false }).sort({
      like_count: -1,
      createdAt: 1,
    });
    if (answers.length === 0) continue;
    if (!force && !isDue(query, now)) continue;

    const pathA = Boolean(query.accepted_answer_id);
    let accepted = pathA
      ? answers.find((a) => String(a._id) === String(query.accepted_answer_id))
      : null;
    if (!accepted) accepted = answers[0]; // Path B (or accepted was deleted): most liked.

    // Keep the accepted answer + the most-liked answers, up to the cap.
    const keep = new Set([String(accepted._id)]);
    for (const a of answers) {
      if (keep.size >= MAX_ANSWERS_KEPT_ON_RESOLVE) break;
      keep.add(String(a._id));
    }
    for (const a of answers) {
      if (keep.has(String(a._id))) continue;
      a.is_deleted = true;
      a.deleted_at = now;
      await a.save();
      pruned += 1;
    }

    if (!accepted.is_accepted) {
      accepted.is_accepted = true;
      await accepted.save();
    }
    query.accepted_answer_id = accepted._id;
    query.status = QUERY_STATUS.RESOLVED;
    await query.save();

    // Points only on Path A — Path B is an automatic keep, no reward. Only the
    // answerer is rewarded; asking a question never earns points.
    if (pathA) {
      await awardPoints(accepted.author_id, POINTS.ANSWER_ACCEPTED);
    }

    await notify({
      recipientId: query.author_id,
      type: NOTIFICATION_TYPE.RESOLUTION,
      title: 'Your question was resolved',
      message: query.title,
      link: `/queries/${query._id}`,
      queryId: query._id,
    });

    await AuditLog.create({
      action: 'query.finalize_solution',
      entity_type: 'query',
      entity_id: query._id,
      details: { path: pathA ? 'A' : 'B', accepted_answer_id: String(accepted._id), pruned },
    });

    resolved += 1;
  }

  return { resolved, pruned };
}

export default finalizeSolutions;
