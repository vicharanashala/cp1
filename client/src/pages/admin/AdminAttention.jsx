import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAttentionQueue, clearAttention } from '../../api/admin.js';
import { relativeTime } from '../../lib/time.js';

// Questions Experts have escalated, grouped by category and (within a category)
// ordered by posting date then the author's joining date — server-sorted.
function groupByCategory(items) {
  const groups = new Map();
  for (const it of items) {
    if (!groups.has(it.category)) groups.set(it.category, []);
    groups.get(it.category).push(it);
  }
  return [...groups.entries()].map(([category, rows]) => ({ category, rows }));
}

export default function AdminAttention() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(await getAttentionQueue());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id) => {
    setBusy(true);
    try {
      await clearAttention(id);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  const groups = groupByCategory(items);

  return (
    <div className="admin-attention">
      <header className="overview-head">
        <h2>Needs Admin Attention</h2>
        <p className="muted">
          Questions escalated by Expert members, grouped by category and ordered by posting date
          then the asker&apos;s joining date.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="muted">Nothing flagged for attention right now.</p>
      ) : (
        groups.map((g) => (
          <section key={g.category} className="card">
            <div className="card-head">
              <h3>{g.category}</h3>
              <span className="chip">{g.rows.length}</span>
            </div>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Asked by</th>
                  <th>Joined</th>
                  <th>Posted</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/queries/${r.id}`}>{r.title}</Link>
                    </td>
                    <td>
                      {r.author?.id ? (
                        <Link to={`/users/${r.author.id}`}>{r.author.name}</Link>
                      ) : (
                        r.author?.name ?? 'Unknown'
                      )}
                    </td>
                    <td className="small">
                      {r.author?.joined_at ? new Date(r.author.joined_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="small">{relativeTime(r.posted_at)}</td>
                    <td>
                      <span className={`badge status-${r.status}`}>{r.status}</span>
                    </td>
                    <td className="nowrap">
                      <button className="btn-link" disabled={busy} onClick={() => resolve(r.id)}>
                        Mark handled
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))
      )}
    </div>
  );
}
