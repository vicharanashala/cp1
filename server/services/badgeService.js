import { User } from '../models/User.js';
import { notify } from './notificationService.js';
import { POSITIVE_BADGES, NOTIFICATION_TYPE } from '../config/constants.js';

/** Positive badge keys earned at a given points total. */
export function earnedBadgeKeys(points) {
  return POSITIVE_BADGES.filter((b) => points >= b.threshold).map((b) => b.key);
}

// Tier ladder = the entry tier + the four positive badge tiers.
const TIERS = [{ key: 'newcomer', label: 'Newcomer', icon: '✨', threshold: 0 }, ...POSITIVE_BADGES];

/** Reputation standing for a points total: current tier, next tier, progress. */
export function standing(points = 0) {
  const p = Math.max(0, Number(points) || 0);
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) if (p >= TIERS[i].threshold) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  if (!next) return { tier, next: null, pts_to_next: 0, progress_pct: 100, is_max: true };
  const span = next.threshold - tier.threshold;
  return {
    tier,
    next,
    pts_to_next: next.threshold - p,
    progress_pct: Math.min(100, Math.round(((p - tier.threshold) / span) * 100)),
    is_max: false,
  };
}

/**
 * Sync a user's positive badges to their current points. Mutates `user.badges`
 * but does NOT save. Returns the badge definitions newly earned (for notifying).
 */
export function applyBadges(user) {
  const earned = earnedBadgeKeys(user.points ?? 0);
  const before = new Set(user.badges ?? []);
  const newly = earned.filter((k) => !before.has(k));
  user.badges = earned;
  return newly.map((k) => POSITIVE_BADGES.find((b) => b.key === k));
}

/**
 * Adjust a user's reputation, resync their badges, and notify on new ones.
 * The single entry point for every points change so badges stay consistent.
 * @returns {Promise<import('mongoose').Document|null>} the updated user
 */
export async function awardPoints(userId, delta) {
  if (!userId || !delta) return null;
  const user = await User.findById(userId);
  if (!user) return null;

  user.points = Math.max(0, (user.points ?? 0) + delta);
  const newly = applyBadges(user);
  await user.save();

  for (const badge of newly) {
    await notify({
      recipientId: user._id,
      type: NOTIFICATION_TYPE.BADGE,
      title: `New badge unlocked: ${badge.icon} ${badge.label}`,
      message: `You reached ${badge.threshold} reputation points.`,
      link: `/users/${user._id}`,
    });
  }
  return user;
}

/** Resync positive badges for every user (used by the M7 daily recalc job). */
export async function recalcAllBadges() {
  const users = await User.find({ is_deleted: false }).select('points badges');
  let updated = 0;
  for (const user of users) {
    const before = JSON.stringify(user.badges ?? []);
    applyBadges(user);
    if (JSON.stringify(user.badges) !== before) {
      await user.save();
      updated += 1;
    }
  }
  return { updated };
}
