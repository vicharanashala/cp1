import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listQueries, listCategories } from '../api/queries.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime, initials } from '../lib/time.js';

const STATUS_LABELS = {
  open: 'Open',
  answered: 'Answered',
  resolved: 'Resolved',
  archived: 'Archived',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'open', label: 'Open' },
  { value: 'answered', label: 'Answered' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'archived', label: 'Archived' },
];

function excerpt(text = '', n = 180) {
  const t = String(text).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

export default function QueryList() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  // Load the category list once for the filter dropdown.
  useEffect(() => {
    let active = true;
    listCategories()
      .then((cats) => active && setCategories(cats))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const q = params.get('q') ?? '';
  const category = params.get('category') ?? '';
  const tag = params.get('tag') ?? '';
  const status = params.get('status') ?? '';
  const page = Number(params.get('page')) || 1;

  // Local form state, synced from the URL (the URL is the source of truth).
  const [form, setForm] = useState({ q, category, tag, status });
  useEffect(() => setForm({ q, category, tag, status }), [q, category, tag, status]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const opts = {};
    if (q) opts.q = q;
    if (category) opts.category = category;
    if (tag) opts.tag = tag;
    if (status) opts.status = status;
    if (page > 1) opts.page = page;
    listQueries(opts)
      .then((d) => active && setData(d))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [q, category, tag, status, page]);

  // Write filter changes to the URL (resetting to page 1 unless paging).
  const commit = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!('page' in changes)) next.delete('page');
    setParams(next);
  };

  // Dynamic search: debounce free-text typing (q + tag) into the URL so results
  // update live as you type - no need to press a button.
  useEffect(() => {
    if (form.q === q && form.tag === tag) return undefined;
    const t = setTimeout(() => commit({ q: form.q, tag: form.tag }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.q, form.tag]);

  const onApply = (e) => {
    e.preventDefault();
    commit({ q: form.q, category: form.category, tag: form.tag, status: form.status });
  };

  const onClear = () => setParams(new URLSearchParams());

  const totalPages = Math.max(1, Math.ceil(data.total / (data.limit || 20)));
  const hasFilters = q || category || tag || status;

  return (
    <div className="container">
      <div className="list-head">
        <div>
          <h1>Community Discussions</h1>
          <p className="lead">
            Explore technical queries, share solutions, and contribute to the collective knowledge.
          </p>
        </div>
        {user && (
          <Link to="/ask" className="btn-primary">
            <span className="material-symbols-outlined">edit_square</span> Raise a Query
          </Link>
        )}
      </div>

      <form className="filter-bar" onSubmit={onApply}>
        <div className="search-bar" style={{ margin: 0, flex: 1 }}>
          <span className="material-symbols-outlined">search</span>
          <input
            placeholder="Search discussions…"
            value={form.q}
            onChange={(e) => setForm((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <select
          className="filter-select"
          value={form.category}
          onChange={(e) => commit({ category: e.target.value })}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          className="filter-input"
          placeholder="Tag"
          value={form.tag}
          onChange={(e) => setForm((f) => ({ ...f, tag: e.target.value }))}
        />
        <select
          className="filter-select"
          value={form.status}
          onChange={(e) => commit({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button type="button" className="btn-ghost" onClick={onClear}>
            Clear
          </button>
        )}
        <span className="sort-label">
          <span className="material-symbols-outlined">sort</span> Newest first
        </span>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : data.items.length === 0 ? (
        <p className="muted">No questions match. Try clearing filters or be the first to ask.</p>
      ) : (
        <>
          <ul className="q-cards">
            {data.items.map((item) => (
              <li key={item.id} className="q-card">
                <Link to={`/queries/${item.id}`} className="q-card-title">
                  {item.title}
                </Link>
                <p className="q-excerpt">{excerpt(item.body)}</p>
                <div className="q-card-foot">
                  <span className="q-stat" title="votes">
                    <span className="material-symbols-outlined">expand_less</span>
                    {item.vote_score ?? 0}
                  </span>
                  <span className="q-stat" title="answers">
                    <span className="material-symbols-outlined">forum</span>
                    {item.answer_count ?? 0}
                  </span>
                  <span className={`badge status-${item.status}`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  <span className="cat">{item.category}</span>
                  {item.tags?.slice(0, 3).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                  {item.is_flagged_duplicate && <span className="badge flag">possible duplicate</span>}
                  <span className="foot-spacer" />
                  <span className="q-author">
                    <span className="avatar-sm">{initials(item.author?.name ?? '?')}</span>
                    <span className="author-id">
                      <span className="author-name-row">
                        {item.author?.id ? (
                          <Link to={`/users/${item.author.id}`}>{item.author.name}</Link>
                        ) : (
                          item.author?.name ?? 'Unknown'
                        )}
                        <span className="dot">·</span>
                        {relativeTime(item.createdAt)}
                      </span>
                      {item.author?.badge && (
                        <span className="author-badge" title={item.author.badge.label}>
                          {item.author.badge.icon} {item.author.badge.label}
                        </span>
                      )}
                    </span>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav className="pagination">
              <button
                className="btn-secondary"
                disabled={page <= 1}
                onClick={() => commit({ page: String(page - 1) })}
              >
                ‹ Prev
              </button>
              <span className="page-status">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn-secondary"
                disabled={page >= totalPages}
                onClick={() => commit({ page: String(page + 1) })}
              >
                Next ›
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
