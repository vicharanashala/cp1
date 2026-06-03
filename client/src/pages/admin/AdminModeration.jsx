import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  listModeration,
  resolveModeration,
  dismissModeration,
  mergeQueries,
  getClusters,
} from '../../api/admin.js';

const TYPES = ['', 'duplicate', 'report', 'spam', 'outdated', 'gibberish'];

export default function AdminModeration() {
  const [items, setItems] = useState([]);
  const [type, setType] = useState('');
  const [clusters, setClusters] = useState([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [mod, cl] = await Promise.all([
      listModeration({ status: 'pending', type: type || undefined }),
      getClusters(),
    ]);
    setItems(mod.items);
    setClusters(cl);
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="row">
        <label className="inline-filter">
          Type:
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t || 'all'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {items.length === 0 ? (
        <p className="muted">No pending moderation items.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Item</th>
              <th>Reason</th>
              <th>Raised by</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <tr key={m._id}>
                <td>
                  <span className={`badge type-${m.type}`}>{m.type}</span>
                </td>
                <td>
                  {m.query_id ? (
                    <Link to={`/queries/${m.query_id._id}`}>{m.query_id.title}</Link>
                  ) : (
                    '-'
                  )}
                  {m.type === 'duplicate' && m.duplicate_of_query_id && (
                    <div className="muted small">
                      ↳ similar to{' '}
                      <Link to={`/queries/${m.duplicate_of_query_id._id}`}>
                        {m.duplicate_of_query_id.title}
                      </Link>
                      {m.similarity_score ? ` (${Math.round(m.similarity_score * 100)}%)` : ''}
                    </div>
                  )}
                </td>
                <td className="small">{m.reason ?? '-'}</td>
                <td className="small">{m.raised_by?.name ?? 'system'}</td>
                <td>
                  <div className="row">
                    {m.type === 'duplicate' && m.duplicate_of_query_id && m.query_id && (
                      <button
                        className="btn-link"
                        disabled={busy}
                        onClick={() =>
                          act(() =>
                            mergeQueries({
                              canonicalId: m.duplicate_of_query_id._id,
                              duplicateId: m.query_id._id,
                              moderationId: m._id,
                            }),
                          )
                        }
                      >
                        Merge
                      </button>
                    )}
                    <button className="btn-link" disabled={busy} onClick={() => act(() => resolveModeration(m._id))}>
                      Resolve
                    </button>
                    <button
                      className="btn-link danger"
                      disabled={busy}
                      onClick={() => act(() => dismissModeration(m._id))}
                    >
                      Dismiss
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Amalgamation suggestions</h2>
      {clusters.length === 0 ? (
        <p className="muted">No clusters of similar questions found.</p>
      ) : (
        clusters.map((group, i) => (
          <div className="cluster" key={i}>
            <ul>
              {group.map((q, idx) => (
                <li key={q.id}>
                  <Link to={`/queries/${q.id}`}>{q.title}</Link>
                  {idx === 0 ? <span className="badge">canonical</span> : q.score && <span className="muted small"> {Math.round(q.score * 100)}%</span>}
                </li>
              ))}
            </ul>
            <button
              className="btn-link"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  for (let k = 1; k < group.length; k++) {
                    // eslint-disable-next-line no-await-in-loop
                    await mergeQueries({ canonicalId: group[0].id, duplicateId: group[k].id });
                  }
                })
              }
            >
              Merge all into canonical
            </button>
          </div>
        ))
      )}
    </div>
  );
}
