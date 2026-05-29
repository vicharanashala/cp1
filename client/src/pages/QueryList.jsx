import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { listQueries } from '../api/queries.js';
import { useAuth } from '../context/AuthContext.jsx';

const STATUS_LABELS = {
  open: 'Open',
  answered: 'Answered',
  resolved: 'Resolved',
  archived: 'Archived',
};

export default function QueryList() {
  const { user } = useAuth();
  const [data, setData] = useState({ items: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('');

  const load = useCallback(async (params) => {
    setLoading(true);
    try {
      setData(await listQueries(params));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({});
  }, [load]);

  const onSearch = (e) => {
    e.preventDefault();
    setActive(search);
    load(search ? { q: search } : {});
  };

  return (
    <div className="container">
      <div className="list-head">
        <h1>Questions</h1>
        {user && (
          <Link to="/ask" className="btn-primary">
            Ask a question
          </Link>
        )}
      </div>

      <form className="search-bar" onSubmit={onSearch}>
        <input
          placeholder="Search questions…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn-primary">Search</button>
        {active && (
          <button
            type="button"
            className="btn-link"
            onClick={() => {
              setSearch('');
              setActive('');
              load({});
            }}
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="muted">No questions yet. Be the first to ask one.</p>
      ) : (
        <ul className="query-list">
          {data.items.map((q) => (
            <li key={q.id}>
              <Link to={`/queries/${q.id}`} className="query-title">
                {q.title}
              </Link>
              <div className="query-meta">
                <span className={`badge status-${q.status}`}>{STATUS_LABELS[q.status] ?? q.status}</span>
                <span className="cat">{q.category}</span>
                {q.tags?.map((t) => (
                  <span key={t} className="tag">
                    #{t}
                  </span>
                ))}
                {q.is_flagged_duplicate && <span className="badge flag">possible duplicate</span>}
                <span className="by">
                  by{' '}
                  {q.author?.id ? (
                    <Link to={`/users/${q.author.id}`}>{q.author.name}</Link>
                  ) : (
                    (q.author?.name ?? 'Unknown')
                  )}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
