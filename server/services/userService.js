import { User } from '../models/User.js';
import { Query } from '../models/Query.js';
import { Answer } from '../models/Answer.js';
import { Bookmark } from '../models/Bookmark.js';
import { AuditLog } from '../models/AuditLog.js';
import { ApiError } from '../utils/ApiError.js';
import { notify } from './notificationService.js';
import { standing } from './badgeService.js';
import { POSITIVE_BADGES, NEGATIVE_BADGES, NOTIFICATION_TYPE } from '../config/constants.js';

/** Public profile: reputation, badges, governance status, and activity counts. */
export async function getProfile(userId) {
  const user = await User.findOne({ _id: userId, is_deleted: false })
    .select('name points badges negative_badges is_banned ban_expires_at ban_reason requires_approval createdAt')
    .lean();
  if (!user) throw ApiError.notFound('User not found');

  const [queryCount, answerCount] = await Promise.all([
    Query.countDocuments({ author_id: userId, is_deleted: false }),
    Answer.countDocuments({ author_id: userId, is_deleted: false }),
  ]);

  // Expand stored badge keys to full definitions for the UI.
  const badges = (user.badges ?? [])
    .map((k) => POSITIVE_BADGES.find((b) => b.key === k))
    .filter(Boolean);

  return {
    id: user._id,
    name: user.name,
    points: user.points,
    badges,
    standing: standing(user.points),
    negative_badges: user.negative_badges ?? [],
    is_banned: user.is_banned,
    ban_expires_at: user.ban_expires_at,
    ban_reason: user.ban_reason,
    requires_approval: user.requires_approval,
    query_count: queryCount,
    answer_count: answerCount,
    member_since: user.createdAt,
  };
}

/** Update the current user's own profile (name) + notification preferences. */
export async function updateMe(user, payload = {}) {
  const updates = {};
  if (typeof payload.name === 'string' && payload.name.trim()) {
    updates.name = payload.name.trim().slice(0, 80);
  }
  if (payload.notification_prefs && typeof payload.notification_prefs === 'object') {
    const p = payload.notification_prefs;
    updates.notification_prefs = {
      answers: Boolean(p.answers),
      mentions: Boolean(p.mentions),
      system: Boolean(p.system),
    };
  }
  if (Object.keys(updates).length === 0) throw ApiError.badRequest('Nothing to update');
  const updated = await User.findByIdAndUpdate(user._id, updates, { new: true });
  return updated.toJSON();
}

/** A unified recent-activity feed for the current user (asked / answered / saved). */
export async function getActivity(user, limit = 10) {
  const n = Math.min(Number(limit) || 10, 30);
  const [queries, answers, bookmarks] = await Promise.all([
    Query.find({ author_id: user._id, is_deleted: false }).sort({ createdAt: -1 }).limit(n).select('title createdAt').lean(),
    Answer.find({ author_id: user._id, is_deleted: false }).sort({ createdAt: -1 }).limit(n).populate('query_id', 'title').lean(),
    Bookmark.find({ user_id: user._id }).sort({ createdAt: -1 }).limit(n).populate('query_id', 'title').lean(),
  ]);

  const items = [
    ...queries.map((q) => ({ type: 'question', label: 'Asked', title: q.title, link: `/queries/${q._id}`, at: q.createdAt })),
    ...answers
      .filter((a) => a.query_id)
      .map((a) => ({ type: 'answer', label: 'Answered', title: a.query_id.title, link: `/queries/${a.query_id._id}`, at: a.createdAt })),
    ...bookmarks
      .filter((b) => b.query_id)
      .map((b) => ({ type: 'saved', label: 'Saved', title: b.query_id.title, link: `/queries/${b.query_id._id}`, at: b.createdAt })),
  ];
  items.sort((x, y) => new Date(y.at) - new Date(x.at));
  return { items: items.slice(0, n) };
}

/** Admin: ban a user, optionally for a fixed number of hours (else permanent). */
export async function banUser(admin, userId, { hours, reason } = {}) {
  if (String(admin._id) === String(userId)) throw ApiError.badRequest('You cannot ban yourself');

  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  const h = Number(hours);
  user.is_banned = true;
  user.ban_expires_at = h > 0 ? new Date(Date.now() + h * 60 * 60 * 1000) : null;
  user.ban_reason = reason || 'Banned by an administrator';
  await user.save();

  await AuditLog.create({
    action: 'user.ban',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: { hours: h > 0 ? h : null, reason: user.ban_reason },
  });
  await notify({
    recipientId: user._id,
    type: NOTIFICATION_TYPE.BAN,
    title: 'Your account has been banned',
    message: user.ban_reason,
    link: `/users/${user._id}`,
  });

  return { ok: true, is_banned: true, ban_expires_at: user.ban_expires_at };
}

/** Admin: lift a ban and clear restriction. */
export async function unbanUser(admin, userId) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  user.is_banned = false;
  user.ban_expires_at = null;
  user.ban_reason = null;
  user.requires_approval = false;
  await user.save();

  await AuditLog.create({
    action: 'user.unban',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: {},
  });
  await notify({
    recipientId: user._id,
    type: NOTIFICATION_TYPE.SYSTEM,
    title: 'Your account has been reinstated',
    link: `/users/${user._id}`,
  });

  return { ok: true };
}

/**
 * Admin: issue a negative badge. Restricted → requires approval to post;
 * Suspended → permanent ban. Warning is informational.
 */
export async function issueNegativeBadge(admin, userId, key, reason) {
  const def = Object.values(NEGATIVE_BADGES).find((b) => b.key === key);
  if (!def) throw ApiError.badRequest('Invalid negative badge');

  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  if (!user.negative_badges.some((b) => b.key === def.key)) {
    user.negative_badges.push({
      key: def.key,
      label: def.label,
      icon: def.icon,
      reason,
      issued_by: admin._id,
    });
  }
  if (key === NEGATIVE_BADGES.RESTRICTED.key) user.requires_approval = true;
  if (key === NEGATIVE_BADGES.SUSPENDED.key) {
    user.is_banned = true;
    user.ban_expires_at = null;
    user.ban_reason = reason || 'Suspended by an administrator';
  }
  await user.save();

  await AuditLog.create({
    action: 'user.negative_badge',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: { key, reason },
  });
  await notify({
    recipientId: user._id,
    type: NOTIFICATION_TYPE.BADGE,
    title: `You received a ${def.icon} ${def.label} badge`,
    message: reason || '',
    link: `/users/${user._id}`,
  });

  return { ok: true };
}
