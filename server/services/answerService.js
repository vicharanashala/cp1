import { Answer } from '../models/Answer.js';
import { Query } from '../models/Query.js';
import { Like } from '../models/Like.js';
import { Comment } from '../models/Comment.js';
import { User } from '../models/User.js';
import { ModerationQueue } from '../models/ModerationQueue.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from './notificationService.js';
import { awardPoints, topBadge } from './badgeService.js';
import {
  POINTS,
  QUERY_STATUS,
  NOTIFICATION_TYPE,
  MODERATION_TYPE,
  ROLES,
  VERIFIED_ANSWER_BADGE,
} from '../config/constants.js';

function serializeAnswer(obj, viewerId) {
  const plain = typeof obj.toObject === 'function' ? obj.toObject() : obj;
  const authorRef = plain.author_id;
  const authorId = authorRef?._id ?? authorRef;
  const isOwner = Boolean(viewerId && authorId && String(authorId) === String(viewerId));
  // eslint-disable-next-line no-unused-vars
  const { author_id, __v, ...rest } = plain;
  return {
    ...rest,
    id: plain._id,
    author: {
      id: authorId ?? null,
      name: authorRef?.name ?? null,
      points: authorRef?.points ?? null,
      badge: topBadge(authorRef?.badges),
    },
    is_owner: isOwner,
  };
}

function serializeComment(c, viewerId) {
  const authorId = c.author_id?._id ?? c.author_id;
  return {
    id: c._id,
    body: c.body,
    author: { id: authorId ?? null, name: c.author_id?.name ?? null },
    createdAt: c.createdAt,
    is_owner: Boolean(viewerId && authorId && String(authorId) === String(viewerId)),
  };
}

/** Post an answer; flips an open query to "answered" and starts the Path B clock. */
export async function postAnswer(user, queryId, body) {
  const text = String(body ?? '').trim();
  if (!text) throw ApiError.badRequest('Answer body is required');

  const query = await Query.findOne({ _id: queryId, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');
  if (query.status === QUERY_STATUS.RESOLVED) {
    throw ApiError.badRequest('This question is already resolved');
  }
  // A user cannot answer their own question.
  if (String(query.author_id) === String(user._id)) {
    throw ApiError.badRequest('You cannot answer your own question');
  }

  const answer = await Answer.create({ query_id: query._id, author_id: user._id, body: text });

  if (!query.first_answered_at) {
    query.first_answered_at = new Date();
    if (query.status === QUERY_STATUS.OPEN) query.status = QUERY_STATUS.ANSWERED;
    await query.save();
  }

  if (String(query.author_id) !== String(user._id)) {
    await notify({
      recipientId: query.author_id,
      type: NOTIFICATION_TYPE.ANSWER,
      title: 'New answer to your question',
      message: query.title,
      link: `/queries/${query._id}`,
      queryId: query._id,
      answerId: answer._id,
    });
  }

  await answer.populate('author_id', 'name points badges');
  return serializeAnswer(answer, user._id);
}

/** List a query's answers (accepted first, then by likes), with the viewer's like state. */
export async function listAnswers(queryId, viewerId) {
  const answers = await Answer.find({ query_id: queryId, is_deleted: false })
    .sort({ is_verified: -1, is_helpful: -1, is_accepted: -1, like_count: -1, createdAt: 1 })
    .populate('author_id', 'name points badges')
    .lean();

  if (answers.length === 0) return [];
  const ids = answers.map((a) => a._id);

  // Downvote tallies (like_count tracks upvotes only) and the viewer's own vote.
  const downs = await Like.aggregate([
    { $match: { answer_id: { $in: ids }, value: -1 } },
    { $group: { _id: '$answer_id', n: { $sum: 1 } } },
  ]);
  const downMap = new Map(downs.map((d) => [String(d._id), d.n]));

  let myVotes = new Map();
  if (viewerId) {
    const mine = await Like.find({ user_id: viewerId, answer_id: { $in: ids } }).lean();
    myVotes = new Map(mine.map((l) => [String(l.answer_id), l.value]));
  }

  // Threaded comments, grouped per answer (oldest first).
  const comments = await Comment.find({ answer_id: { $in: ids }, is_deleted: false })
    .sort({ createdAt: 1 })
    .populate('author_id', 'name')
    .lean();
  const commentMap = new Map();
  for (const c of comments) {
    const key = String(c.answer_id);
    if (!commentMap.has(key)) commentMap.set(key, []);
    commentMap.get(key).push(serializeComment(c, viewerId));
  }

  return answers.map((a) => {
    const myVote = myVotes.get(String(a._id)) ?? 0;
    return {
      ...serializeAnswer(a, viewerId),
      my_vote: myVote,
      liked_by_me: myVote === 1,
      score: (a.like_count ?? 0) - (downMap.get(String(a._id)) ?? 0),
      comments: commentMap.get(String(a._id)) ?? [],
    };
  });
}

/** Add a comment under an answer. */
export async function addComment(user, answerId, body) {
  const text = String(body ?? '').trim();
  if (!text) throw ApiError.badRequest('Comment cannot be empty');

  const answer = await Answer.findOne({ _id: answerId, is_deleted: false });
  if (!answer) throw ApiError.notFound('Answer not found');

  // The discussion under an answer is between the question poster and the answer
  // author only — no third-party (user↔user) chatter.
  const parent = await Query.findOne({ _id: answer.query_id, is_deleted: false });
  const isPoster = parent && String(parent.author_id) === String(user._id);
  const isAnswerAuthor = String(answer.author_id) === String(user._id);
  if (!isPoster && !isAnswerAuthor && user.role !== ROLES.ADMIN) {
    throw ApiError.forbidden('Only the question author and the answer author can comment here');
  }

  const comment = await Comment.create({
    answer_id: answer._id,
    author_id: user._id,
    body: text.slice(0, 1000),
  });

  if (String(answer.author_id) !== String(user._id)) {
    await notify({
      recipientId: answer.author_id,
      type: NOTIFICATION_TYPE.COMMENT,
      title: 'New comment on your answer',
      link: `/queries/${answer.query_id}`,
      queryId: answer.query_id,
      answerId: answer._id,
    });
  }

  await comment.populate('author_id', 'name');
  return serializeComment(comment, String(user._id));
}

/** Soft-delete a comment (author or admin). */
export async function deleteComment(user, commentId) {
  const comment = await Comment.findOne({ _id: commentId, is_deleted: false });
  if (!comment) throw ApiError.notFound('Comment not found');
  const canModerate = user.role === ROLES.ADMIN || user.is_moderator;
  if (String(comment.author_id) !== String(user._id) && !canModerate) {
    throw ApiError.forbidden('You can only delete your own comment');
  }
  comment.is_deleted = true;
  comment.deleted_at = new Date();
  await comment.save();
  return { ok: true };
}

/**
 * Set the current user's vote on an answer. `desired` is 1 (up), -1 (down), or
 * 0 (clear); re-voting the same way toggles it off. `like_count` tracks upvotes
 * only (so finalization ranking is unchanged), and ONLY upvotes move reputation
 * — downvotes never deduct the author's points (avoids griefing).
 * @returns {{ value, like_count, score, liked }}
 */
export async function setAnswerVote(user, answerId, desired) {
  const want = desired === 1 || desired === -1 ? desired : 0;

  const answer = await Answer.findOne({ _id: answerId, is_deleted: false });
  if (!answer) throw ApiError.notFound('Answer not found');
  if (String(answer.author_id) === String(user._id)) {
    throw ApiError.badRequest('You cannot vote on your own answer');
  }
  // Forum interaction is between a user and the question poster only — no peer
  // voting. Only the question's author (or an admin/moderator) may rate answers.
  const parent = await Query.findOne({ _id: answer.query_id, is_deleted: false });
  const canRate =
    parent &&
    (String(parent.author_id) === String(user._id) ||
      user.role === ROLES.ADMIN ||
      user.is_moderator);
  if (!canRate) {
    throw ApiError.forbidden('Only the question author can rate answers');
  }

  const existing = await Like.findOne({ answer_id: answer._id, user_id: user._id });
  const old = existing?.value ?? 0;
  const next = want === old ? 0 : want; // re-voting the same way clears it

  if (next === 0) {
    if (existing) await existing.deleteOne();
  } else if (existing) {
    existing.value = next;
    await existing.save();
  } else {
    await Like.create({ answer_id: answer._id, user_id: user._id, value: next });
  }

  // Upvote count drives like_count + reputation; downvotes affect neither.
  const upDelta = (next === 1 ? 1 : 0) - (old === 1 ? 1 : 0);
  if (upDelta !== 0) {
    answer.like_count = Math.max(0, answer.like_count + upDelta);
    await answer.save();
    await awardPoints(answer.author_id, POINTS.ANSWER_LIKED * upDelta);
  }

  // Notify the author only on a brand-new upvote.
  if (next === 1 && old !== 1) {
    await notify({
      recipientId: answer.author_id,
      type: NOTIFICATION_TYPE.LIKE,
      title: 'Someone liked your answer',
      link: `/queries/${answer.query_id}`,
      queryId: answer.query_id,
      answerId: answer._id,
    });
  }

  const downCount = await Like.countDocuments({ answer_id: answer._id, value: -1 });
  return {
    value: next,
    like_count: answer.like_count,
    score: answer.like_count - downCount,
    liked: next === 1,
  };
}

/**
 * Legacy upvote toggle, preserved for the `/answers/:id/like` endpoint. Returns
 * the exact `{ liked, like_count }` shape callers/tests depend on.
 */
export async function toggleLike(user, answerId) {
  const res = await setAnswerVote(user, answerId, 1);
  return { liked: res.liked, like_count: res.like_count };
}

/**
 * Re-derive a query's status from its surviving answers. Called after an answer
 * is removed so a thread never shows "resolved/answered" with no replies left,
 * and a deleted accepted answer no longer marks the thread as solved.
 */
async function reconcileQueryStatus(queryId) {
  const query = await Query.findOne({ _id: queryId, is_deleted: false });
  if (!query) return;

  const remaining = await Answer.countDocuments({ query_id: queryId, is_deleted: false });

  // The accepted answer is gone if it was the one deleted.
  if (query.accepted_answer_id) {
    const acceptedAlive = await Answer.exists({
      _id: query.accepted_answer_id,
      is_deleted: false,
    });
    if (!acceptedAlive) {
      query.accepted_answer_id = null;
      query.grace_period_deadline = null;
    }
  }

  if (remaining === 0) {
    // No replies left → back to an open question.
    query.status = QUERY_STATUS.OPEN;
    query.first_answered_at = null;
  } else if (
    (query.status === QUERY_STATUS.RESOLVED || query.status === QUERY_STATUS.ANSWERED) &&
    !query.accepted_answer_id
  ) {
    // Still has replies but no accepted solution → answered, not resolved.
    query.status = QUERY_STATUS.ANSWERED;
  }

  await query.save();
}

/**
 * Mark (or unmark) an answer as the "user found helpful" solution. Only the
 * question author (or an admin) can do it. Marking it **closes the question for
 * answers** (resolved), records it as the accepted solution, and rewards the
 * answerer; un-marking reopens the thread and reverses the reward.
 */
export async function toggleHelpful(user, answerId) {
  const answer = await Answer.findOne({ _id: answerId, is_deleted: false });
  if (!answer) throw ApiError.notFound('Answer not found');

  const query = await Query.findOne({ _id: answer.query_id, is_deleted: false });
  if (!query) throw ApiError.notFound('Query not found');

  const isAuthor = String(query.author_id) === String(user._id);
  if (!isAuthor && user.role !== ROLES.ADMIN && !user.is_moderator) {
    throw ApiError.forbidden('Only the question author or a moderator can mark an answer as helpful');
  }

  const nowHelpful = !answer.is_helpful;
  answer.is_helpful = nowHelpful;
  answer.helpful_at = nowHelpful ? new Date() : null;
  await answer.save();

  if (nowHelpful) {
    // Endorsing an answer closes the question and records the solution.
    query.accepted_answer_id = answer._id;
    query.status = QUERY_STATUS.RESOLVED;
    if (!query.first_answered_at) query.first_answered_at = new Date();
    await query.save();
    await awardPoints(answer.author_id, POINTS.ANSWER_ACCEPTED);
    if (String(answer.author_id) !== String(user._id)) {
      await notify({
        recipientId: answer.author_id,
        type: NOTIFICATION_TYPE.ACCEPT,
        title: 'Your answer was marked helpful and closed the question',
        message: query.title,
        link: `/queries/${answer.query_id}`,
        queryId: answer.query_id,
        answerId: answer._id,
      });
    }
  } else if (String(query.accepted_answer_id) === String(answer._id)) {
    // Un-marking the solution reopens the thread for answers.
    query.accepted_answer_id = null;
    query.grace_period_deadline = null;
    query.status = QUERY_STATUS.ANSWERED;
    await query.save();
    await awardPoints(answer.author_id, -POINTS.ANSWER_ACCEPTED);
  }

  return { ok: true, is_helpful: nowHelpful, status: query.status };
}

/**
 * Admin: mark (or unmark) an answer as "Admin Verified". Verifying records the
 * verifier, notifies the answerer, and grants them the persistent Admin Verified
 * badge (kept even if the answer is later unverified).
 */
export async function setVerified(admin, answerId, value) {
  if (admin.role !== ROLES.ADMIN) throw ApiError.forbidden('Only an admin can verify answers');
  const answer = await Answer.findOne({ _id: answerId, is_deleted: false });
  if (!answer) throw ApiError.notFound('Answer not found');

  const verified = Boolean(value);
  answer.is_verified = verified;
  answer.verified_by = verified ? admin._id : null;
  await answer.save();

  await AuditLog.create({
    action: verified ? 'answer.verify' : 'answer.unverify',
    entity_type: 'answer',
    entity_id: answer._id,
    performed_by: admin._id,
    details: {},
  });

  if (verified) {
    // Grant the answerer the persistent Admin Verified badge (idempotent).
    const author = await User.findById(answer.author_id);
    if (author && !author.is_deleted && !author.custom_badges.some((b) => b.key === VERIFIED_ANSWER_BADGE.key)) {
      author.custom_badges.push({
        key: VERIFIED_ANSWER_BADGE.key,
        label: VERIFIED_ANSWER_BADGE.label,
        icon: VERIFIED_ANSWER_BADGE.icon,
        reason: 'An admin verified one of your answers',
        issued_by: admin._id,
      });
      await author.save();
    }
    await notify({
      recipientId: answer.author_id,
      type: NOTIFICATION_TYPE.BADGE,
      title: 'Your answer was verified by an admin',
      message: `${VERIFIED_ANSWER_BADGE.icon} Admin Verified`,
      link: `/queries/${answer.query_id}`,
      queryId: answer.query_id,
      answerId: answer._id,
    });
  }

  return { ok: true, is_verified: verified };
}

/** Soft-delete an answer (author or admin), then reconcile the query's status. */
export async function deleteAnswer(user, answerId) {
  const answer = await Answer.findOne({ _id: answerId, is_deleted: false });
  if (!answer) throw ApiError.notFound('Answer not found');
  const isOwner = String(answer.author_id) === String(user._id);
  const canModerate = user.role === ROLES.ADMIN || user.is_moderator;
  if (!isOwner && !canModerate) {
    throw ApiError.forbidden('You can only delete your own answer');
  }
  answer.is_deleted = true;
  answer.deleted_at = new Date();
  await answer.save();

  await reconcileQueryStatus(answer.query_id);
  return { ok: true };
}

/** Report a query or answer as faulty; records it on the doc and in the moderation queue. */
export async function reportContent(user, { targetType, targetId, reason }) {
  const Model = targetType === 'answer' ? Answer : targetType === 'query' ? Query : null;
  if (!Model) throw ApiError.badRequest('Report target must be "query" or "answer"');

  const doc = await Model.findOne({ _id: targetId, is_deleted: false });
  if (!doc) throw ApiError.notFound(`${targetType} not found`);

  const cleanReason = String(reason ?? '').slice(0, 500);
  doc.reports.push({ reporter_id: user._id, reason: cleanReason });
  await doc.save();

  await ModerationQueue.create({
    type: MODERATION_TYPE.REPORT,
    query_id: targetType === 'query' ? doc._id : doc.query_id ?? null,
    answer_id: targetType === 'answer' ? doc._id : null,
    reason: cleanReason,
    raised_by: user._id,
  });
  return { ok: true };
}
