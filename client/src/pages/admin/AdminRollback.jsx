import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getRecentDeletions } from '../../api/admin.js';
import { restoreQuery } from '../../api/queries.js';
import { restoreAnswer } from '../../api/answers.js';
import { relativeTime } from '../../lib/time.js';

// Undo recent deletions. Admins/moderators get a short window to restore a
// question or answer they (or anyone) removed by mistake.
export default function AdminRollback() {
  const [data, setData] = useState({ queries: [], answers: [], window_minutes: 15 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await getRecentDeletions());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const undo = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not restore - the window may have passed.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p>Loading…</p>;

  const empty = data.queries.length === 0 && data.answers.length === 0;

  return (
    <div className="admin-rollback">
      <header className="overview-head">
        <h2>Rollback</h2>
        <p className="muted">
          Restore a question or answer deleted in the last {data.window_minutes} minutes. After the
          window passes, the deletion becomes permanent.
        </p>
      </header>

      {empty ? (
        <p className="muted">Nothing to restore right now.</p>
      ) : (
        <>
          {data.queries.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h3>Deleted questions</h3>
                <span className="chip">{data.queries.length}</span>
              </div>
              <ul className="taxonomy-list">
                {data.queries.map((q) => (
                  <li key={q.id}>
                    <span>
                      {q.title}
                      <span className="muted small">
                        {' '}· deleted {relativeTime(q.deleted_at)}
                        {q.deleted_by ? ` by ${q.deleted_by}` : ''}
                      </span>
                    </span>
                    <button className="btn-link" disabled={busy} onClick={() => undo(() => restoreQuery(q.id))}>
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.answers.length > 0 && (
            <section className="card">
              <div className="card-head">
                <h3>Deleted answers</h3>
                <span className="chip">{data.answers.length}</span>
              </div>
              <ul className="taxonomy-list">
                {data.answers.map((a) => (
                  <li key={a.id}>
                    <span>
                      {a.query_id ? (
                        <Link to={`/queries/${a.query_id}`}>{a.query_title ?? 'question'}</Link>
                      ) : (
                        a.query_title ?? 'question'
                      )}
                      : “{a.excerpt}”
                      <span className="muted small">
                        {' '}· deleted {relativeTime(a.deleted_at)}
                        {a.deleted_by ? ` by ${a.deleted_by}` : ''}
                      </span>
                    </span>
                    <button className="btn-link" disabled={busy} onClick={() => undo(() => restoreAnswer(a.id))}>
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
