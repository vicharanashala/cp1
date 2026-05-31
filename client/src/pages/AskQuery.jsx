import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createQuery, checkGrammar } from '../api/queries.js';

const EMPTY = {
  title: '',
  body: '',
  category: 'general',
  tags: '',
  contact_email: '',
  is_anonymous: false,
};

export default function AskQuery() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Quality-gate UX state.
  const [duplicates, setDuplicates] = useState(null); // [{ id, title, score }]
  const [grammar, setGrammar] = useState(null); // { corrected, changes }
  const [checking, setChecking] = useState(false);
  const [originalBody, setOriginalBody] = useState(null); // preserved if corrected

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const runGrammarCheck = async () => {
    if (!form.body.trim()) return;
    setChecking(true);
    setError(null);
    try {
      const res = await checkGrammar(form.body);
      setGrammar(res.has_changes ? res : { ...res, has_changes: false });
    } catch {
      setError('Grammar check is unavailable right now.');
    } finally {
      setChecking(false);
    }
  };

  const acceptCorrection = () => {
    setOriginalBody(form.body);
    setForm((f) => ({ ...f, body: grammar.corrected }));
    setGrammar(null);
  };

  const submit = async (postAnyway = false) => {
    setBusy(true);
    setError(null);
    setDuplicates(null);
    try {
      const fields = {
        ...form,
        is_anonymous: form.is_anonymous ? 'true' : 'false',
        post_anyway: postAnyway ? 'true' : 'false',
      };
      if (originalBody && originalBody !== form.body) fields.original_body = originalBody;

      const query = await createQuery(fields, files);
      navigate(`/queries/${query.id}`);
    } catch (err) {
      const data = err.response?.data;
      if (err.response?.status === 409 && data?.details?.duplicate) {
        setDuplicates(data.details.matches);
      } else if (err.response?.status === 422 && data?.details?.gibberish) {
        const penalty = data.details.penalty;
        const note =
          penalty === 'banned_24h'
            ? ' Your account has been temporarily banned for repeated spam.'
            : penalty === 'restricted'
              ? ' Your account now requires approval before posting.'
              : penalty === 'suspended'
                ? ' Your account has been suspended.'
                : '';
        setError(`${data.error}${note} (strike ${data.details.spam_flag_count})`);
      } else {
        setError(data?.error ?? 'Could not submit your question.');
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    submit(false);
  };

  return (
    <div className="container narrow-wide">
      <h1>Ask a question</h1>
      <p className="lead">
        Your question runs through quality gates — gibberish detection, an optional grammar check,
        and duplicate detection — so the knowledge base stays clean.
      </p>

      <form onSubmit={onSubmit} className="form">
        {error && <div className="alert">{error}</div>}

        <label>
          Title
          <input name="title" value={form.title} onChange={onChange} required minLength={8} />
        </label>

        <label>
          Details (Markdown supported)
          <textarea name="body" value={form.body} onChange={onChange} rows={8} required />
        </label>

        <div className="row">
          <button type="button" className="btn-link" onClick={runGrammarCheck} disabled={checking}>
            {checking ? 'Checking…' : 'Check grammar'}
          </button>
          {originalBody && <span className="hint">Original text preserved.</span>}
        </div>

        <div className="grid-2">
          <label>
            Category
            <input name="category" value={form.category} onChange={onChange} />
          </label>
          <label>
            Tags (comma-separated)
            <input name="tags" value={form.tags} onChange={onChange} placeholder="mongodb, auth" />
          </label>
        </div>

        <label>
          Contact email (optional — extra context for moderators)
          <input name="contact_email" type="email" value={form.contact_email} onChange={onChange} />
        </label>

        <label>
          Screenshots (optional, up to 4 images)
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
          />
        </label>

        <label className="checkbox">
          <input
            type="checkbox"
            name="is_anonymous"
            checked={form.is_anonymous}
            onChange={onChange}
          />
          Post anonymously
        </label>

        <button className="btn-primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit question'}
        </button>
      </form>

      {grammar && (
        <Modal onClose={() => setGrammar(null)} title="Grammar suggestions">
          {grammar.has_changes ? (
            <>
              <p className="muted">Suggested revision:</p>
              <pre className="diff">{grammar.corrected}</pre>
              {grammar.changes?.length > 0 && (
                <ul className="changes">
                  {grammar.changes.map((c, i) => (
                    <li key={i}>{c.note ?? c.type}</li>
                  ))}
                </ul>
              )}
              <div className="row">
                <button className="btn-primary" onClick={acceptCorrection}>
                  Accept all
                </button>
                <button className="btn-link" onClick={() => setGrammar(null)}>
                  Keep original
                </button>
              </div>
            </>
          ) : (
            <>
              <p>No changes suggested — your text looks good.</p>
              <button className="btn-link" onClick={() => setGrammar(null)}>
                Close
              </button>
            </>
          )}
        </Modal>
      )}

      {duplicates && (
        <Modal onClose={() => setDuplicates(null)} title="Similar questions found">
          <p>We found existing questions that look similar:</p>
          <ul className="dup-list">
            {duplicates.map((m) => (
              <li key={m.id}>
                <Link to={`/queries/${m.id}`}>{m.title}</Link>
                <span className="score">{Math.round(m.score * 100)}% match</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <Link className="btn-primary" to={`/queries/${duplicates[0].id}`}>
              View existing
            </Link>
            <button className="btn-link" onClick={() => submit(true)} disabled={busy}>
              Post anyway
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}
