// Client-side reputation tiers — mirrors the server's POSITIVE_BADGES
// thresholds (server/config/constants.js). Used to render the reputation ring
// and "points to next tier" on the dashboard. Milestone 14 will formalize this
// in the profile API; until then it's derived from points client-side.
export const POSITIVE_BADGES = [
  { key: 'helper', label: 'Helper', icon: '🥉', threshold: 50 },
  { key: 'contributor', label: 'Contributor', icon: '🥈', threshold: 150 },
  { key: 'expert', label: 'Expert', icon: '🥇', threshold: 500 },
  { key: 'legend', label: 'Legend', icon: '🏆', threshold: 1000 },
];

// Ordered tier ladder, including the entry tier below the first badge.
const TIERS = [
  { label: 'Newcomer', icon: '✨', threshold: 0 },
  ...POSITIVE_BADGES,
];

/**
 * Resolve a user's standing from a points total.
 * @returns {{ tier, next, ptsToNext, progressPct, isMax }}
 */
export function reputationStanding(points = 0) {
  const p = Math.max(0, Number(points) || 0);
  let idx = 0;
  for (let i = 0; i < TIERS.length; i++) {
    if (p >= TIERS[i].threshold) idx = i;
  }
  const tier = TIERS[idx];
  const next = TIERS[idx + 1] ?? null;
  if (!next) {
    return { tier, next: null, ptsToNext: 0, progressPct: 100, isMax: true };
  }
  const span = next.threshold - tier.threshold;
  const into = p - tier.threshold;
  const progressPct = Math.min(100, Math.round((into / span) * 100));
  return { tier, next, ptsToNext: next.threshold - p, progressPct, isMax: false };
}

/** Map stored badge keys to their full definitions (for the badges strip). */
export function badgeDefs(keys = []) {
  return keys.map((k) => POSITIVE_BADGES.find((b) => b.key === k)).filter(Boolean);
}
