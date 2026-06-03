import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listModerators, setModerator } from '../../api/admin.js';

// The full moderation roster: every moderator plus admins (who moderate too).
export default function AdminModerators() {
  const [mods, setMods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listModerators()
      .then(setMods)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Revoke moderator rank directly from this roster (no trip to the Users tab).
  const removeModerator = async (m) => {
    if (!window.confirm(`Remove moderator rank from ${m.name}?`)) return;
    setBusy(true);
    try {
      await setModerator(m.id, false);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  return (
    <div className="admin-moderators">
      <header className="overview-head">
        <h2>Moderators</h2>
        <p className="muted">
          Everyone with moderation powers. You can revoke moderator rank right here.
        </p>
      </header>

      {mods.length === 0 ? (
        <p className="muted">No moderators yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Points</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {mods.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link to={`/users/${m.id}`}>{m.name}</Link>
                </td>
                <td className="small">{m.email}</td>
                <td>
                  {m.is_admin ? (
                    <span className="badge">admin</span>
                  ) : (
                    <span className="badge">moderator</span>
                  )}
                </td>
                <td>{m.points}</td>
                <td>
                  {m.is_admin ? (
                    <span className="muted small">-</span>
                  ) : (
                    <button
                      className="btn-link danger"
                      disabled={busy}
                      onClick={() => removeModerator(m)}
                    >
                      Remove moderator
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
