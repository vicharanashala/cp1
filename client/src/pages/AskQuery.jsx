import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createQuery, checkGrammar } from '../api/queries.js';
import { getTaxonomy } from '../api/taxonomy.js';

// The built-in tag a user may pick when no curated tag fits.
const OTHERS_TAG = { slug: 'others', name: 'Others (no relevant tag)' };

const EMPTY = {
  title: '',
  body: '',
  category: '',
  contact_email: '',
  joining_date: '',
};

export default function AskQuery() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [selectedTags, setSelectedTags] = useState([]); // tag slugs
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Quality-gate UX state.
  const [duplicates, setDuplicates] = useState(null); // [{ id, title, score }]
  const [grammar, setGrammar] = useState(null); // { corrected, changes }
  const [checking, setChecking] = useState(false);
  const [originalBody, setOriginalBody] = useState(null); // preserved if corrected

  // Load the admin-curated categories + tags the asker may choose from.
  useEffect(() => {
    (async () => {
      try {
        const tax = await getTaxonomy();
        setTaxonomy(tax);
        setForm((f) => ({ ...f, category: f.category || tax.categories[0]?.slug || '' }));
      } catch {
        setError('Could not load categories. Please refresh and try again.');
      }
    })();
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const toggleTag = (slug) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug],
    );
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
        tags: selectedTags.join(','),
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
      <h1>Raise a Query</h1>
      <p className="lead">
        Your query runs through quality gates (gibberish detection, an optional grammar check,
        and duplicate detection) so the knowledge base stays clean.
      </p>

      <form onSubmit={onSubmit} className="form">
        {error && <div className="alert">{error}</div>}

        <label>
          Title
          <input name="title" value={form.title} onChange={onChange} required minLength={8} />
        </label>

        <label>
          Details
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
            Contact email
            <input
              name="contact_email"
              type="email"
              value={form.contact_email}
              onChange={onChange}
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            Joining date
            <input
              name="joining_date"
              type="date"
              value={form.joining_date}
              onChange={onChange}
              required
            />
          </label>
        </div>

        <label>
          Category
          <select name="category" value={form.category} onChange={onChange} required>
            <option value="" disabled>
              Select a category…
            </option>
            {taxonomy.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="tag-picker">
          <legend>Tags</legend>
          <p className="hint">
            Pick from the available tags. If none fit, choose “Others”. Custom tags aren’t allowed.
          </p>
          <div className="tag-options">
            {[...taxonomy.tags, OTHERS_TAG].map((t) => (
              <label key={t.slug} className="checkbox tag-option">
                <input
                  type="checkbox"
                  checked={selectedTags.includes(t.slug)}
                  onChange={() => toggleTag(t.slug)}
                />
                {t.name}
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          Add a screenshot
          <span className="hint">
            Adding a screenshot gives your peers context and makes your query easier to solve (up
            to 4 images).
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(e.target.files)}
          />
        </label>

        <button className="btn-primary" disabled={busy}>
          {busy ? 'Submitting…' : 'Raise a Query'}
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
              <p>No changes suggested - your text looks good.</p>
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
