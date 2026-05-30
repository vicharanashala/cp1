import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getProfile, banUser, unbanUser, issueNegativeBadge } from '../api/users.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
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
        {profile.badges.length === 0 ? (
          <p className="muted">No badges earned yet.</p>
        ) : (
          <ul className="badge-row">
            {profile.badges.map((b) => (
              <li key={b.key} title={`${b.threshold}+ points`}>
                <span className="badge-icon">{b.icon}</span> {b.label}
              </li>
            ))}
          </ul>
        )}
      </section>

      {profile.negative_badges.length > 0 && (
        <section>
          <h2>Flags</h2>
          <ul className="badge-row">
            {profile.negative_badges.map((b, i) => (
              <li key={i} className="negative" title={b.reason ?? ''}>
                <span className="badge-icon">{b.icon}</span> {b.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isAdmin && <AdminControls profile={profile} onChange={load} />}
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
    </section>
  );
}
