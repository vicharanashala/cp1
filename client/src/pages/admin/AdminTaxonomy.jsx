import { useEffect, useState, useCallback } from 'react';
import { getTaxonomy, createTerm, deleteTerm } from '../../api/taxonomy.js';

// Admin-curated categories + tags. Users may only pick from these (plus the
// built-in "others" tag); they cannot invent their own.
export default function AdminTaxonomy() {
  const [taxonomy, setTaxonomy] = useState({ categories: [], tags: [] });
  const [newCategory, setNewCategory] = useState('');
  const [newTag, setNewTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setTaxonomy(await getTaxonomy());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (kind, name, reset) => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createTerm(kind, name.trim());
      reset('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error ?? `Could not add ${kind}.`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this term? Existing questions keep it, but it can no longer be chosen.'))
      return;
    await deleteTerm(id);
    await load();
  };

  const renderSection = (kind, items, value, setValue) => (
    <section className="card">
      <div className="card-head">
        <h3>{kind === 'category' ? 'Categories' : 'Tags'}</h3>
        <span className="chip">{items.length}</span>
      </div>
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          add(kind, value, setValue);
        }}
      >
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={kind === 'category' ? 'New category name' : 'New tag name'}
        />
        <button className="btn-primary" disabled={busy}>
          Add {kind}
        </button>
      </form>
      <ul className="taxonomy-list">
        {items.map((t) => (
          <li key={t.id}>
            <span>
              {t.name} <code className="muted">{t.slug}</code>
            </span>
            <button className="btn-link danger" onClick={() => remove(t.id)}>
              Remove
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="muted">None yet.</li>}
      </ul>
    </section>
  );

  return (
    <div className="admin-taxonomy">
      <header className="overview-head">
        <h2>Categories &amp; Tags</h2>
        <p className="muted">
          Curate the categories and tags users may pick when posting a question. Users cannot create
          their own - they can only choose from this list or the built-in “Others” tag.
        </p>
      </header>

      {error && <div className="alert">{error}</div>}

      {renderSection('category', taxonomy.categories, newCategory, setNewCategory)}
      {renderSection('tag', taxonomy.tags, newTag, setNewTag)}
    </div>
  );
}
