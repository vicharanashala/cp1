import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getQuery, deleteQuery, voteQuery, saveQuery, flagAttention, retagQuery } from '../api/queries.js';
import { getTaxonomy } from '../api/taxonomy.js';
import {
  listAnswers,
  postAnswer,
  updateAnswer,
  deleteAnswer,
  markHelpful,
  verifyAnswer,
  reportQuery,
  reportAnswer,
  addComment,
  deleteComment,
} from '../api/answers.js';

// Authors may edit their own post for 15 minutes after creating it.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const withinEditWindow = (createdAt) =>
  createdAt && Date.now() - new Date(createdAt).getTime() <= EDIT_WINDOW_MS;
import { useAuth } from '../context/AuthContext.jsx';
import { promoteQuery } from '../api/faq.js';
import Markdown from '../components/Markdown.jsx';
import MarkdownEditor from '../components/MarkdownEditor.jsx';
import { relativeTime, initials } from '../lib/time.js';

export default function QueryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, canModerate } = useAuth();
  const [query, setQuery] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('top');
  const [retagOpen, setRetagOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null); // attachment src being viewed
  const [reportTarget, setReportTarget] = useState(null); // { type, id }

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

  const submitReport = async (reason) => {
    if (!reportTarget) return;
    if (reportTarget.type === 'query') await reportQuery(reportTarget.id, reason);
    else await reportAnswer(reportTarget.id, reason);
    setReportTarget(null);
    window.alert('Thanks - a moderator will review it.');
  };

  const onPromote = async () => {
    try {
      await promoteQuery(id);
      window.alert('Promoted to the FAQ.');
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not promote this question.');
    }
  };

  // The server toggles a repeat vote off, so just send the direction.
  const onVoteQuery = async (value) => {
    try {
      const res = await voteQuery(id, value);
      setQuery((q) => ({ ...q, vote_score: res.vote_score, my_vote: res.my_vote }));
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not record your vote.');
    }
  };

  const onToggleSave = async () => {
    const res = await saveQuery(id);
    setQuery((q) => ({ ...q, is_saved: res.saved }));
  };

  const onFlagAttention = async () => {
    try {
      await flagAttention(id);
      setQuery((q) => ({ ...q, needs_attention: true }));
      window.alert('Flagged for admin attention. Thanks!');
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not flag this question.');
    }
  };

  const resolved = query?.status === 'resolved';
  // Expert-badge holders, moderators, and admins may escalate to the admins.
  const canFlagAttention = Boolean(user?.badges?.includes('expert') || canModerate);

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
          {query.is_owner && withinEditWindow(query.createdAt) && (
            <Link to={`/queries/${id}/edit`} className="btn-link">
              Edit
            </Link>
          )}
          {(query.is_owner || canModerate) && (
            <button className="btn-link danger" onClick={onDeleteQuery}>
              Delete{!query.is_owner && canModerate ? ' (mod)' : ''}
            </button>
          )}
          {user && !query.is_owner && !canModerate && (
            <button className="btn-link" onClick={() => setReportTarget({ type: 'query', id })}>
              Report
            </button>
          )}
          {canFlagAttention && !query.needs_attention && (
            <button className="btn-link" onClick={onFlagAttention} title="Escalate to admins">
              <span className="material-symbols-outlined">priority_high</span> Needs admin attention
            </button>
          )}
          {canModerate && (
            <button className="btn-link" onClick={() => setRetagOpen((o) => !o)}>
              Re-tag{!query.is_owner ? ' (mod)' : ''}
            </button>
          )}
          {isAdmin && resolved && (
            <button className="btn-link" onClick={onPromote}>
              Promote to FAQ
            </button>
          )}
        </div>
      </div>

      {retagOpen && canModerate && (
        <RetagPanel
          query={query}
          onClose={() => setRetagOpen(false)}
          onSaved={(updated) => {
            setQuery((q) => ({ ...q, category: updated.category, tags: updated.tags }));
            setRetagOpen(false);
          }}
        />
      )}

      <div className="query-meta">
        <span className={`badge status-${query.status}`}>{query.status}</span>
        {query.needs_attention && <span className="badge flag">needs admin attention</span>}
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

      <div className="q-engage">
        {!query.is_owner && (
          <div className="vote-inline">
            <button
              className={`vote-btn ${query.my_vote === 1 ? 'on-up' : ''}`}
              disabled={!user}
              onClick={() => onVoteQuery(1)}
              title="Upvote"
            >
              <span className="material-symbols-outlined">thumb_up</span>
            </button>
            <span className="vote-score">{query.vote_score ?? 0}</span>
            <button
              className={`vote-btn ${query.my_vote === -1 ? 'on-down' : ''}`}
              disabled={!user}
              onClick={() => onVoteQuery(-1)}
              title="Downvote"
            >
              <span className="material-symbols-outlined">thumb_down</span>
            </button>
          </div>
        )}
        {user && (
          <button
            className={`btn-secondary ${query.is_saved ? 'is-saved' : ''}`}
            onClick={onToggleSave}
          >
            <span className="material-symbols-outlined">
              {query.is_saved ? 'bookmark' : 'bookmark_add'}
            </span>
            {query.is_saved ? 'Saved' : 'Save'}
          </button>
        )}
      </div>

      {query.is_flagged_duplicate && (
        <div className="alert info">
          Flagged as a possible duplicate
          {query.similarity_score ? ` (${Math.round(query.similarity_score * 100)}% match)` : ''}
          {query.duplicate_of && (
            <>
              {' - '}
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
        <div className="attachments">
          <span className="attachments-label">
            <span className="material-symbols-outlined">attachment</span>
            {query.screenshots.length} attachment{query.screenshots.length > 1 ? 's' : ''} added -
            click to view
          </span>
          <div className="attachment-thumbs">
            {query.screenshots.map((src) => (
              <button
                key={src}
                type="button"
                className="attachment-thumb"
                onClick={() => setLightbox(src)}
              >
                <img src={src} alt="attachment" />
              </button>
            ))}
          </div>
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
              Top
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
            isAdmin={isAdmin}
            canManage={query.is_owner || canModerate}
            canModerate={canModerate}
            canComment={query.is_owner || a.is_owner || canModerate}
            onReport={(answerId) => setReportTarget({ type: 'answer', id: answerId })}
            onChange={loadAll}
          />
        ))}
        {answers.length === 0 && <p className="muted">No answers yet.</p>}
      </div>

      {user && !resolved && !query.is_owner && <AnswerForm queryId={id} onPosted={loadAll} />}
      {user && !resolved && query.is_owner && (
        <p className="muted">This is your question - you can’t answer it yourself. Others will reply here.</p>
      )}
      {resolved && (
        <p className="muted">This question is closed - an answer was marked helpful, so it no longer accepts answers.</p>
      )}

      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
      {reportTarget && (
        <ReportModal
          target={reportTarget}
          onClose={() => setReportTarget(null)}
          onSubmit={submitReport}
        />
      )}
    </div>
  );
}

// Full-screen attachment viewer with click-to-zoom.
function Lightbox({ src, onClose }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <img
        src={src}
        alt="attachment"
        className={`lightbox-img ${zoomed ? 'zoomed' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          setZoomed((z) => !z);
        }}
      />
    </div>
  );
}

// Collects a reason before filing a report (replaces a bare prompt()).
function ReportModal({ target, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Report this {target.type}</h2>
        <p className="muted">Tell a moderator what’s wrong. Be specific.</p>
        <form className="form" onSubmit={submit}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Reason for reporting…"
            required
            autoFocus
          />
          <div className="row">
            <button className="btn-primary" disabled={busy || !reason.trim()}>
              Submit report
            </button>
            <button type="button" className="btn-link" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AnswerCard({ answer, isAdmin, canManage, canModerate, canComment, onReport, onChange }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(answer.body);
  const canDelete = answer.is_owner || canModerate;
  const canEdit = answer.is_owner && withinEditWindow(answer.createdAt);

  const onSaveEdit = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await updateAnswer(answer.id, draft.trim());
      setEditing(false);
      await onChange();
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not save your edit.');
    } finally {
      setBusy(false);
    }
  };

  const onToggleHelpful = async () => {
    setBusy(true);
    try {
      await markHelpful(answer.id);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const onToggleVerify = async () => {
    setBusy(true);
    try {
      await verifyAnswer(answer.id, !answer.is_verified);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm('Delete this answer?')) return;
    await deleteAnswer(answer.id);
    await onChange();
  };

  return (
    <article className={`answer-card ${answer.is_verified ? 'verified' : ''} ${answer.is_helpful || answer.is_accepted ? 'accepted' : ''}`}>
      <div className="answer-main">
        <div className="answer-badges">
          {answer.is_verified && <span className="badge verified-badge">✅ Admin Verified</span>}
          {answer.is_helpful ? (
            <span className="badge helpful-badge">User found helpful</span>
          ) : (
            answer.is_accepted && <span className="badge accepted-badge">✓ Solution</span>
          )}
        </div>
        {editing ? (
          <div className="answer-edit">
            <MarkdownEditor value={draft} onChange={setDraft} rows={6} />
            <div className="row">
              <button className="btn-primary" onClick={onSaveEdit} disabled={busy || !draft.trim()}>
                Save
              </button>
              <button
                className="btn-link"
                onClick={() => {
                  setEditing(false);
                  setDraft(answer.body);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="answer-body">
            <Markdown>{answer.body}</Markdown>
          </div>
        )}
        <div className="answer-meta">
          <span className="by">
            <Author author={answer.author} /> · {relativeTime(answer.createdAt)}
          </span>
          {canEdit && !editing && (
            <button className="btn-link" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {canManage && (
            <button className="btn-link" onClick={onToggleHelpful} disabled={busy}>
              {answer.is_helpful ? 'Reopen (remove helpful)' : 'Mark as helpful & close'}
            </button>
          )}
          {isAdmin && (
            <button className="btn-link" onClick={onToggleVerify} disabled={busy}>
              {answer.is_verified ? 'Remove verification' : 'Mark admin verified'}
            </button>
          )}
          {canDelete && (
            <button className="btn-link danger" onClick={onDelete}>
              Delete{!answer.is_owner && canModerate ? ' (mod)' : ''}
            </button>
          )}
          {!answer.is_owner && !canModerate && (
            <button className="btn-link" onClick={() => onReport(answer.id)}>
              Report
            </button>
          )}
        </div>
        <AnswerComments answer={answer} canComment={canComment} onChange={onChange} />
      </div>
    </article>
  );
}

function AnswerComments({ answer, canComment, onChange }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const comments = answer.comments ?? [];

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await addComment(answer.id, text.trim());
    setText('');
    setOpen(false);
    await onChange();
  };

  const remove = async (id) => {
    await deleteComment(id);
    await onChange();
  };

  return (
    <div className="comments">
      {comments.map((c) => (
        <div key={c.id} className="comment">
          <span className="comment-body">{c.body}</span>
          <span className="comment-meta">
            - {c.author?.name ?? 'Unknown'}
            {c.is_owner && (
              <button className="comment-del" onClick={() => remove(c.id)} title="Delete comment">
                ×
              </button>
            )}
          </span>
        </div>
      ))}
      {canComment &&
        (open ? (
          <form className="comment-form" onSubmit={submit}>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={1000}
              autoFocus
            />
            <button className="btn-ghost" disabled={!text.trim()}>
              Comment
            </button>
          </form>
        ) : (
          <button className="btn-ghost add-comment" onClick={() => setOpen(true)}>
            + Add a comment
          </button>
        ))}
    </div>
  );
}

const OTHERS_TAG = { slug: 'others', name: 'Others' };

// Inline category/tag editor for moderators & admins, right in the thread.
function RetagPanel({ query, onClose, onSaved }) {
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });
  const [category, setCategory] = useState(query.category ?? '');
  const [tags, setTags] = useState(query.tags ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTaxonomy()
      .then(setTaxonomy)
      .catch(() => {});
  }, []);

  const toggleTag = (slug) =>
    setTags((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));

  const save = async () => {
    setBusy(true);
    try {
      const updated = await retagQuery(query.id, { category, tags: tags.join(',') });
      onSaved(updated);
    } catch (err) {
      window.alert(err.response?.data?.error ?? 'Could not update the category/tags.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card retag-panel">
      <strong>Change category &amp; tags</strong>
      <label>
        Category
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {taxonomy.categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="tag-options">
        {[...taxonomy.tags, OTHERS_TAG].map((t) => (
          <label key={t.slug} className="checkbox tag-option">
            <input type="checkbox" checked={tags.includes(t.slug)} onChange={() => toggleTag(t.slug)} />
            {t.name}
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn-primary" onClick={save} disabled={busy}>
          Save
        </button>
        <button className="btn-link" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Author({ author }) {
  if (!author) return <span className="author-inline">Unknown</span>;
  const name = author.name ?? 'Unknown';
  return (
    <span className="author-inline">
      <span className="avatar-sm">{initials(name)}</span>
      <span className="author-id">
        <span className="author-name-row">
          {author.anonymous || !author.id ? name : <Link to={`/users/${author.id}`}>{name}</Link>}
          {author.points != null && <span className="rep-mini" title="reputation">{author.points}</span>}
        </span>
        {author.badge && (
          <span className="author-badge" title={author.badge.label}>
            {author.badge.icon} {author.badge.label}
          </span>
        )}
      </span>
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
        placeholder="Share what you know…"
        required
      />
      <button className="btn-primary" disabled={busy || !body.trim()}>
        {busy ? 'Posting…' : 'Post Answer'}
      </button>
    </form>
  );
}
