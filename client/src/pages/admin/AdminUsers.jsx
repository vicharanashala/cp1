import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listUsers, setRole, banUser, unbanUser, setModerator } from '../../api/admin.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminUsers() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [] });
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (search) => {
    setData(await listUsers(search ? { q: search } : {}));
  }, []);

  // Live, debounced search: results update as you type - no need to click Search.
  useEffect(() => {
    const t = setTimeout(() => load(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q, load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load(q);
    } finally {
      setBusy(false);
    }
  };

  const onBan = (u) => {
    const hours = window.prompt('Ban for how many hours? (blank = permanent)', '24');
    if (hours === null) return;
    const reason = window.prompt('Reason?') ?? '';
    act(() => banUser(u.id, { hours: hours ? Number(hours) : 0, reason }));
  };

  return (
    <div>
      <form
        className="search-bar"
        onSubmit={(e) => {
          e.preventDefault();
          load(q);
        }}
      >
        <input placeholder="Search name or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn-primary">Search</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Moderator</th>
            <th>Points</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((u) => (
            <tr key={u.id}>
              <td>
                <Link to={`/users/${u.id}`}>{u.name}</Link>
              </td>
              <td className="small">{u.email}</td>
              <td>{u.role}</td>
              <td>
                {u.is_moderator ? (
                  <span className="badge">moderator</span>
                ) : u.moderator_requested ? (
                  <span className="badge flag">requested</span>
                ) : (
                  <span className="muted small">-</span>
                )}
              </td>
              <td>{u.points}</td>
              <td>{u.is_banned ? <span className="badge flag">banned</span> : 'active'}</td>
              <td>
                {String(u.id) === String(user?.id) ? (
                  <span className="muted small">You</span>
                ) : (
                  <div className="row">
                    <button
                      className="btn-link"
                      disabled={busy}
                      onClick={() => act(() => setRole(u.id, u.role === 'admin' ? 'user' : 'admin'))}
                    >
                      {u.role === 'admin' ? 'Make user' : 'Make admin'}
                    </button>
                    <button
                      className="btn-link"
                      disabled={busy}
                      onClick={() => act(() => setModerator(u.id, !u.is_moderator))}
                    >
                      {u.is_moderator ? 'Remove moderator' : 'Make moderator'}
                    </button>
                    {u.is_banned ? (
                      <button className="btn-link" disabled={busy} onClick={() => act(() => unbanUser(u.id))}>
                        Unban
                      </button>
                    ) : (
                      <button className="btn-link danger" disabled={busy} onClick={() => onBan(u)}>
                        Ban
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
