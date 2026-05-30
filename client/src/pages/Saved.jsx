import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBookmarks } from '../api/queries.js';
import { useAuth } from '../context/AuthContext.jsx';
import { relativeTime, initials } from '../lib/time.js';

export default function Saved() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user) return;
    getBookmarks()
      .then(setItems)
      .catch(() => setItems([]));
  }, [user]);

  if (!user) {
    return (
      <div className="container">
        <h1>Saved</h1>
        <p className="muted">
          Please <Link to="/login">log in</Link> to see your saved questions.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>Saved questions</h1>
      <p className="lead">Questions you've bookmarked for later.</p>

      {items === null ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">
          Nothing saved yet. Open a question and hit <strong>Save</strong> to bookmark it.
        </p>
      ) : (
        <ul className="q-cards">
          {items.map((item) => (
            <li key={item.id} className="q-card">
              <Link to={`/queries/${item.id}`} className="q-card-title">
                {item.title}
              </Link>
              <div className="q-card-foot">
                <span className="q-stat" title="votes">
                  <span className="material-symbols-outlined">expand_less</span>
                  {item.vote_score ?? 0}
                </span>
                <span className="q-stat" title="answers">
                  <span className="material-symbols-outlined">forum</span>
                  {item.answer_count ?? 0}
                </span>
                <span className={`badge status-${item.status}`}>{item.status}</span>
                <span className="cat">{item.category}</span>
                <span className="foot-spacer" />
                <span className="q-author">
                  <span className="avatar-sm">{initials(item.author?.name ?? '?')}</span>
                  {item.author?.name ?? 'Unknown'}
                  <span className="dot">·</span>
                  {relativeTime(item.createdAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
