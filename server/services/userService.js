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
    .select('name role is_moderator points badges negative_badges custom_badges is_banned ban_expires_at ban_reason requires_approval createdAt')
    .lean();
  if (!user) throw ApiError.notFound('User not found');

  const [queryCount, answerCount] = await Promise.all([
    Query.countDocuments({ author_id: userId, is_deleted: false }),
    Answer.countDocuments({ author_id: userId, is_deleted: false }),
  ]);

  const isAdmin = user.role === 'admin';

  // Expand stored badge keys to full definitions for the UI.
  // Admins don't carry reputation, so they have no points/badges/standing.
  const badges = isAdmin
    ? []
    : (user.badges ?? []).map((k) => POSITIVE_BADGES.find((b) => b.key === k)).filter(Boolean);

  return {
    id: user._id,
    name: user.name,
    points: isAdmin ? null : user.points,
    badges,
    standing: isAdmin ? null : standing(user.points),
    negative_badges: user.negative_badges ?? [],
    custom_badges: isAdmin ? [] : (user.custom_badges ?? []),
    is_moderator: Boolean(user.is_moderator),
    is_admin: isAdmin,
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
  if (String(admin._id) === String(userId)) {
    throw ApiError.badRequest('You cannot issue a moderation badge to yourself');
  }
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

/** A member (Expert tier) asks to become a moderator; an admin reviews it. */
export async function requestModerator(user) {
  const fresh = await User.findById(user._id);
  if (!fresh || fresh.is_deleted) throw ApiError.notFound('User not found');
  if (fresh.is_moderator) throw ApiError.badRequest('You are already a moderator');
  if (!(fresh.badges ?? []).includes('expert')) {
    throw ApiError.forbidden('Only Expert-level members can request to be a moderator');
  }
  fresh.moderator_requested = true;
  await fresh.save();
  return { ok: true, moderator_requested: true };
}

/**
 * Admin: grant or revoke moderator access for a user — independent of their
 * badge tier. Granting clears any pending request.
 */
export async function setModerator(admin, userId, value) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  user.is_moderator = Boolean(value);
  if (user.is_moderator) user.moderator_requested = false;
  await user.save();

  await AuditLog.create({
    action: user.is_moderator ? 'user.grant_moderator' : 'user.revoke_moderator',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: {},
  });
  await notify({
    recipientId: user._id,
    type: NOTIFICATION_TYPE.SYSTEM,
    title: user.is_moderator ? 'You are now a moderator' : 'Your moderator access was removed',
    link: `/users/${user._id}`,
  });
  return { ok: true, is_moderator: user.is_moderator };
}

/** Admin: remove an admin-issued negative badge from a user. */
export async function revokeNegativeBadge(admin, userId, key) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  const before = user.negative_badges.length;
  user.negative_badges = user.negative_badges.filter((b) => b.key !== key);
  if (user.negative_badges.length === before) throw ApiError.notFound('Badge not found on this user');

  // Lifting "restricted" clears the approval gate it imposed.
  if (key === NEGATIVE_BADGES.RESTRICTED.key) user.requires_approval = false;
  await user.save();

  await AuditLog.create({
    action: 'user.revoke_negative_badge',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: { key },
  });
  return { ok: true };
}

/** Admin: create + assign a custom badge (free-form label/icon) to a user. */
export async function awardCustomBadge(admin, userId, { label, icon, reason } = {}) {
  const cleanLabel = String(label ?? '').trim().slice(0, 40);
  if (!cleanLabel) throw ApiError.badRequest('A badge label is required');
  const key = cleanLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!key) throw ApiError.badRequest('A badge label is required');

  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');
  if (user.custom_badges.some((b) => b.key === key)) {
    throw ApiError.conflict('This user already has that badge');
  }

  const badge = {
    key,
    label: cleanLabel,
    icon: String(icon ?? '').trim().slice(0, 8) || '🏅',
    reason: String(reason ?? '').slice(0, 200),
    issued_by: admin._id,
  };
  user.custom_badges.push(badge);
  await user.save();

  await AuditLog.create({
    action: 'user.award_custom_badge',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: { key, label: cleanLabel },
  });
  await notify({
    recipientId: user._id,
    type: NOTIFICATION_TYPE.BADGE,
    title: `You earned the ${badge.icon} ${badge.label} badge`,
    message: badge.reason,
    link: `/users/${user._id}`,
  });
  return { ok: true, badge };
}

/** Admin: remove a custom badge from a user. */
export async function revokeCustomBadge(admin, userId, key) {
  const user = await User.findById(userId);
  if (!user || user.is_deleted) throw ApiError.notFound('User not found');

  const before = user.custom_badges.length;
  user.custom_badges = user.custom_badges.filter((b) => b.key !== key);
  if (user.custom_badges.length === before) throw ApiError.notFound('Badge not found on this user');
  await user.save();

  await AuditLog.create({
    action: 'user.revoke_custom_badge',
    entity_type: 'user',
    entity_id: user._id,
    performed_by: admin._id,
    details: { key },
  });
  return { ok: true };
}
