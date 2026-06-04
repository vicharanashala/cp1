import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { NOTIFICATION_TYPE, ROLES } from '../config/constants.js';

// Routine engagement pings admins don't need — they moderate, they don't farm
// reputation — so we don't notify an admin recipient about these.
const QUIET_FOR_ADMINS = new Set([
  NOTIFICATION_TYPE.ANSWER,
  NOTIFICATION_TYPE.LIKE,
  NOTIFICATION_TYPE.COMMENT,
]);

// Admins moderate, they don't farm reputation — skip routine engagement pings.
async function isQuietForAdmin(type, recipientId) {
  if (!QUIET_FOR_ADMINS.has(type)) return false;
  const recipient = await User.findById(recipientId).select('role').lean();
  return recipient?.role === ROLES.ADMIN;
}

/**
 * Create a notification. No-op (returns null) when there's no recipient — keeps
 * call sites simple (e.g. anonymous authors, self-actions filtered upstream).
 */
export async function notify({
  recipientId,
  type,
  title,
  message = '',
  link = null,
  queryId = null,
  answerId = null,
}) {
  if (!recipientId) return null;
  if (await isQuietForAdmin(type, recipientId)) return null;

  return Notification.create({
    recipient_id: recipientId,
    type,
    title,
    message,
    link,
    related_query_id: queryId,
    related_answer_id: answerId,
    last_event_at: new Date(),
  });
}

/**
 * Like {@link notify}, but COLLAPSES repeat events for the same question into a
 * single notification instead of one-per-event. If the recipient already has an
 * UNREAD notification of this type for this question, its count is bumped, its
 * title is rebuilt via `makeTitle(count, actorName)`, and it moves back to the
 * top — so "n comments on a question" shows as one "N comments…" entry.
 */
export async function notifyGrouped({
  recipientId,
  type,
  makeTitle,
  actorName = 'Someone',
  message = '',
  link = null,
  queryId = null,
  answerId = null,
}) {
  if (!recipientId) return null;
  if (await isQuietForAdmin(type, recipientId)) return null;

  const existing = await Notification.findOne({
    recipient_id: recipientId,
    type,
    related_query_id: queryId,
    is_read: false,
  });

  if (existing) {
    existing.group_count = (existing.group_count || 1) + 1;
    existing.title = makeTitle(existing.group_count, actorName);
    existing.message = message;
    existing.link = link;
    existing.related_answer_id = answerId;
    existing.last_event_at = new Date();
    await existing.save();
    return existing;
  }

  return Notification.create({
    recipient_id: recipientId,
    type,
    title: makeTitle(1, actorName),
    message,
    link,
    related_query_id: queryId,
    related_answer_id: answerId,
    group_count: 1,
    last_event_at: new Date(),
  });
}

export async function listNotifications(userId, { unreadOnly = false } = {}) {
  const filter = { recipient_id: userId };
  if (unreadOnly) filter.is_read = false;
  // Order by most-recent activity so grouped notifications resurface on each new
  // event (last_event_at == createdAt for ungrouped/legacy items).
  return Notification.find(filter).sort({ last_event_at: -1, createdAt: -1 }).limit(50).lean();
}

export async function unreadCount(userId) {
  return Notification.countDocuments({ recipient_id: userId, is_read: false });
}

export async function markRead(userId, id) {
  await Notification.updateOne({ _id: id, recipient_id: userId }, { is_read: true });
  return { ok: true };
}

export async function markAllRead(userId) {
  await Notification.updateMany({ recipient_id: userId, is_read: false }, { is_read: true });
  return { ok: true };
}
