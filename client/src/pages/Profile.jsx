import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getProfile,
  banUser,
  unbanUser,
  issueNegativeBadge,
  revokeNegativeBadge,
  awardCustomBadge,
  revokeCustomBadge,
} from '../api/users.js';
import { useAuth } from '../context/AuthContext.jsx';
import { POSITIVE_BADGES } from '../lib/reputation.js';

export default function Profile() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setProfile(await getProfile(id));
    } catch (err) {
      setError(err.response?.status === 404 ? 'User not found.' : 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <div className="container">Loading…</div>;
  if (error) return <div className="container"><p className="muted">{error}</p></div>;

  const isSelf = String(user?.id) === String(profile.id);
  const earnedKeys = new Set(profile.badges.map((b) => b.key));

  return (
    <div className="container">
      <div className="profile-head">
        <h1>{profile.name}</h1>
        <span className="points-pill">{profile.points} pts</span>
        {profile.standing && (
          <span className="chip">
            {profile.standing.tier.icon} {profile.standing.tier.label}
          </span>
        )}
      </div>
      {profile.standing && !profile.standing.is_max && (
        <p className="muted small">
          {profile.standing.pts_to_next} pts to {profile.standing.next.label}
        </p>
      )}

      {profile.is_banned && (
        <div className="alert">
          This account is currently banned
          {profile.ban_expires_at
            ? ` until ${new Date(profile.ban_expires_at).toLocaleString()}`
            : ' permanently'}
          .{profile.ban_reason ? ` ${profile.ban_reason}` : ''}
        </div>
      )}

      <div className="profile-stats">
        <div>
          <strong>{profile.query_count}</strong>
          <span>questions</span>
        </div>
        <div>
          <strong>{profile.answer_count}</strong>
          <span>answers</span>
        </div>
        <div>
          <strong>{new Date(profile.member_since).toLocaleDateString()}</strong>
          <span>member since</span>
        </div>
      </div>

      <section>
        <h2>Badges</h2>
        <p className="muted small">Reputation badges unlock automatically as points are earned.</p>
        <ul className="badge-catalog">
          {POSITIVE_BADGES.map((b) => {
            const earned = earnedKeys.has(b.key);
            return (
              <li
                key={b.key}
                className={earned ? 'earned' : 'locked'}
                title={earned ? `Earned · ${b.threshold}+ points` : `Unlocks at ${b.threshold} points`}
              >
                <span className="badge-icon">{b.icon}</span>
                <span className="badge-label">{b.label}</span>
                <span className="badge-req">{earned ? 'Earned' : `${b.threshold} pts`}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {(profile.custom_badges?.length > 0 || (isAdmin && !isSelf)) && (
        <section>
          <h2>Awarded badges</h2>
          {profile.custom_badges?.length ? (
            <ul className="badge-row">
              {profile.custom_badges.map((b) => (
                <li key={b.key} className="custom" title={b.reason ?? ''}>
                  <span className="badge-icon">{b.icon}</span> {b.label}
                  {isAdmin && !isSelf && (
                    <button
                      className="badge-del"
                      title="Revoke badge"
                      onClick={() => revokeCustomBadge(profile.id, b.key).then(load)}
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No awarded badges yet.</p>
          )}
        </section>
      )}

      {profile.negative_badges.length > 0 && (
        <section>
          <h2>Flags</h2>
          <ul className="badge-row">
            {profile.negative_badges.map((b, i) => (
              <li key={i} className="negative" title={b.reason ?? ''}>
                <span className="badge-icon">{b.icon}</span> {b.label}
                {isAdmin && !isSelf && (
                  <button
                    className="badge-del"
                    title="Remove flag"
                    onClick={() => revokeNegativeBadge(profile.id, b.key).then(load)}
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && !isSelf && <AdminControls profile={profile} onChange={load} />}
      {isAdmin && isSelf && (
        <p className="muted small">You can't apply moderation actions to your own account.</p>
      )}
    </div>
  );
}

function AdminControls({ profile, onChange }) {
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const ban = () => {
    const hours = window.prompt('Ban for how many hours? (blank = permanent)', '24');
    if (hours === null) return;
    const reason = window.prompt('Reason for the ban?') ?? '';
    run(() => banUser(profile.id, { hours: hours ? Number(hours) : 0, reason }));
  };

  const badge = (key) => {
    const reason = window.prompt(`Reason for the ${key} badge?`) ?? '';
    run(() => issueNegativeBadge(profile.id, key, reason));
  };

  const awardBadge = () => {
    const label = window.prompt('Badge name? (e.g. "Top Contributor")');
    if (!label || !label.trim()) return;
    const icon = window.prompt('Badge emoji/icon?', '🏅') ?? '🏅';
    const reason = window.prompt('Reason / note? (optional)') ?? '';
    run(() => awardCustomBadge(profile.id, { label: label.trim(), icon, reason }));
  };

  return (
    <section className="admin-controls">
      <h2>Moderation</h2>
      <div className="row">
        {profile.is_banned ? (
          <button className="btn-primary" disabled={busy} onClick={() => run(() => unbanUser(profile.id))}>
            Unban
          </button>
        ) : (
          <button className="btn-link danger" disabled={busy} onClick={ban}>
            Ban user
          </button>
        )}
        <button className="btn-link" disabled={busy} onClick={() => badge('warning')}>
          ⚠️ Warn
        </button>
        <button className="btn-link" disabled={busy} onClick={() => badge('restricted')}>
          🚫 Restrict
        </button>
        <button className="btn-link danger" disabled={busy} onClick={() => badge('suspended')}>
          ☠️ Suspend
        </button>
      </div>
      <h2>Badges</h2>
      <div className="row">
        <button className="btn-secondary" disabled={busy} onClick={awardBadge}>
          Award a custom badge
        </button>
      </div>
    </section>
  );
}
