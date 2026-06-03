import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getAttentionQueue, clearAttention } from '../../api/admin.js';
import { relativeTime } from '../../lib/time.js';

// Questions Experts have escalated, grouped by category and (within a category)
// ordered by posting date then the author's joining date - server-sorted.
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
          Questions escalated by Expert members, grouped by category. The queue lists each asker by
          their email id - click an email to open the question.
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
            <ul className="email-queue">
              {g.rows.map((r) => (
                <li key={r.id}>
                  <Link to={`/queries/${r.id}`} className="email-link">
                    {r.email ?? 'unknown@-'}
                  </Link>
                  <span className="small muted">{relativeTime(r.posted_at)}</span>
                  <button className="btn-link" disabled={busy} onClick={() => resolve(r.id)}>
                    Mark handled
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
