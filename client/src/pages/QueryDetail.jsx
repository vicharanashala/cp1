import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuery, deleteQuery } from '../api/queries.js';
import {
  listAnswers,
  postAnswer,
  likeAnswer,
  deleteAnswer,
  markSolution,
  reportQuery,
  reportAnswer,
} from '../api/answers.js';
import { useAuth } from '../context/AuthContext.jsx';
import { promoteQuery } from '../api/faq.js';
import Markdown from '../components/Markdown.jsx';
import MarkdownEditor from '../components/MarkdownEditor.jsx';
import { relativeTime, initials } from '../lib/time.js';

export default function QueryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const [query, setQuery] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('top');

  const loadAll = useCallback(async () => {
    const [q, a] = await Promise.all([getQuery(id), listAnswers(id)]);
    setQuery(q);
    setAnswers(a);
  }, [id]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await loadAll();
      } catch (err) {
        if (active) setError(err.response?.status === 404 ? 'Question not found.' : 'Failed to load.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [loadAll]);

  // "Top" keeps the server order (accepted first, then most-liked); "Newest"
  // re-sorts client-side by creation time.
  const displayed = useMemo(() => {
    if (sort === 'new') {
      return [...answers].sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
    }
    return answers;
  }, [answers, sort]);

  const onDeleteQuery = async () => {
    if (!window.confirm('Delete this question?')) return;
    await deleteQuery(id);
    navigate('/queries');
  };

  const onReportQuery = async () => {
    const reason = window.prompt('Why are you reporting this question?');
    if (reason === null) return;
    await reportQuery(id, reason);
    window.alert('Thanks — a moderator will review it.');
  };

  const onPromote = async () => {
    try {
      await promoteQuery(id);
      window.alert('Promoted to the FAQ.');
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not promote this question.');
    }
  };

  const resolved = query?.status === 'resolved';

  if (loading) return <div className="container">Loading…</div>;
  if (error) return <div className="container"><p className="muted">{error}</p></div>;

  return (
    <div className="container">
      <Link to="/queries" className="back-link">
        <span className="material-symbols-outlined">arrow_back</span> All questions
      </Link>

      <div className="detail-head">
        <h1>{query.title}</h1>
        <div className="row">
          {query.is_owner && (
            <>
              <Link to={`/queries/${id}/edit`} className="btn-link">
                Edit
              </Link>
              <button className="btn-link danger" onClick={onDeleteQuery}>
                Delete
              </button>
            </>
          )}
          {user && !query.is_owner && (
            <button className="btn-link" onClick={onReportQuery}>
              Report
            </button>
          )}
          {isAdmin && resolved && (
            <button className="btn-link" onClick={onPromote}>
              Promote to FAQ
            </button>
          )}
        </div>
      </div>

      <div className="query-meta">
        <span className={`badge status-${query.status}`}>{query.status}</span>
        <span className="cat">{query.category}</span>
        {query.tags?.map((t) => (
          <span key={t} className="chip">
            {t}
          </span>
        ))}
        <span className="by">
          <Author author={query.author} /> · {relativeTime(query.createdAt)}
        </span>
      </div>

      {query.is_flagged_duplicate && (
        <div className="alert info">
          Flagged as a possible duplicate
          {query.similarity_score ? ` (${Math.round(query.similarity_score * 100)}% match)` : ''}
          {query.duplicate_of && (
            <>
              {' — '}
              <Link to={`/queries/${query.duplicate_of}`}>view the similar question</Link>
            </>
          )}
          . A moderator will review it.
        </div>
      )}

      <article className="query-body">
        <Markdown>{query.body}</Markdown>
      </article>

      {query.was_auto_corrected && (
        <p className="hint">This text was grammar-corrected by the author before posting.</p>
      )}

      {query.screenshots?.length > 0 && (
        <div className="screenshots">
          {query.screenshots.map((src) => (
            <a key={src} href={src} target="_blank" rel="noreferrer">
              <img src={src} alt="screenshot" />
            </a>
          ))}
        </div>
      )}

      <hr />

      <div className="answers-head">
        <h2>
          {answers.length} {answers.length === 1 ? 'Answer' : 'Answers'}
        </h2>
        {answers.length > 1 && (
          <div className="sort-toggle">
            <button className={sort === 'top' ? 'on' : ''} onClick={() => setSort('top')}>
              Highest voted
            </button>
            <button className={sort === 'new' ? 'on' : ''} onClick={() => setSort('new')}>
              Newest
            </button>
          </div>
        )}
      </div>

      <div className="answer-list">
        {displayed.map((a) => (
          <AnswerCard
            key={a.id}
            answer={a}
            canAccept={query.is_owner && !resolved}
            canLike={Boolean(user) && !a.is_owner}
            onChange={loadAll}
            queryId={id}
          />
        ))}
        {answers.length === 0 && <p className="muted">No answers yet.</p>}
      </div>

      {user && !resolved && <AnswerForm queryId={id} onPosted={loadAll} />}
      {resolved && <p className="muted">This question is resolved and no longer accepts answers.</p>}
    </div>
  );
}

function AnswerCard({ answer, canAccept, canLike, onChange, queryId }) {
  const [busy, setBusy] = useState(false);

  const onLike = async () => {
    setBusy(true);
    try {
      await likeAnswer(answer.id);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const onAccept = async () => {
    setBusy(true);
    try {
      await markSolution(queryId, answer.id);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const onReport = async () => {
    const reason = window.prompt('Why are you reporting this answer?');
    if (reason === null) return;
    await reportAnswer(answer.id, reason);
    window.alert('Thanks — a moderator will review it.');
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this answer?')) return;
    await deleteAnswer(answer.id);
    await onChange();
  };

  return (
    <article className={`answer-card ${answer.is_accepted ? 'accepted' : ''}`}>
      <div className="answer-rail">
        <button
          className={`like-btn ${answer.liked_by_me ? 'on' : ''}`}
          onClick={onLike}
          disabled={!canLike || busy}
          title={canLike ? 'Like this answer' : 'You cannot like this answer'}
        >
          <span className="material-symbols-outlined">thumb_up</span>
          {answer.like_count}
        </button>
        {answer.is_accepted && (
          <span className="accepted-mark material-symbols-outlined" title="Accepted answer">
            check_circle
          </span>
        )}
      </div>
      <div className="answer-main">
        {answer.is_accepted && <span className="badge accepted-badge">✓ Solution</span>}
        <div className="answer-body">
          <Markdown>{answer.body}</Markdown>
        </div>
        <div className="answer-meta">
          <span className="by">
            <Author author={answer.author} /> · {relativeTime(answer.createdAt)}
          </span>
          {canAccept && !answer.is_accepted && (
            <button className="btn-link" onClick={onAccept} disabled={busy}>
              Mark as solution
            </button>
          )}
          {answer.is_owner && (
            <button className="btn-link danger" onClick={onDelete}>
              Delete
            </button>
          )}
          {!answer.is_owner && (
            <button className="btn-link" onClick={onReport}>
              Report
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function Author({ author }) {
  if (!author) return <span className="author-inline">Unknown</span>;
  const name = author.name ?? 'Unknown';
  return (
    <span className="author-inline">
      <span className="avatar-sm">{initials(name)}</span>
      {author.anonymous || !author.id ? name : <Link to={`/users/${author.id}`}>{name}</Link>}
    </span>
  );
}

function AnswerForm({ queryId, onPosted }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await postAnswer(queryId, body);
      setBody('');
      await onPosted();
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not post your answer.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="form answer-form" onSubmit={onSubmit}>
      <h3>Your Answer</h3>
      {error && <div className="alert">{error}</div>}
      <MarkdownEditor
        value={body}
        onChange={setBody}
        rows={6}
        placeholder="Share what you know… Markdown is supported."
        required
      />
      <button className="btn-primary" disabled={busy || !body.trim()}>
        {busy ? 'Posting…' : 'Post Answer'}
      </button>
    </form>
  );
}
