import { useEffect, useState, useCallback } from 'react';
import { listFaqs } from '../../api/faq.js';
import { createFaq, updateFaq, setFaqOutdated, deleteFaq } from '../../api/admin.js';

const EMPTY = { category: '', question: '', answer: '', sort_order: 0 };

export default function AdminFaqManager() {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setGroups(await listFaqs());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await updateFaq(editing, form);
      } else {
        try {
          await createFaq(form);
        } catch (err) {
          // The server flags a near-duplicate FAQ - let the admin confirm.
          const dup = err.response?.status === 409 && err.response?.data?.details?.duplicate;
          if (dup) {
            const existing = err.response.data.details.existing;
            const ok = window.confirm(
              `A similar FAQ already exists:\n\n“${existing.question}”\n\nCreate this one anyway?`,
            );
            if (!ok) return;
            await createFaq({ ...form, force: true });
          } else {
            throw err;
          }
        }
      }
      setForm(EMPTY);
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (item) => {
    setEditing(item.id);
    setForm({
      category: item.category,
      question: item.question,
      answer: item.answer,
      sort_order: item.sort_order ?? 0,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this FAQ entry?')) return;
    await deleteFaq(id);
    await load();
  };

  const toggleOutdated = async (item) => {
    await setFaqOutdated(item.id, !item.is_outdated);
    await load();
  };

  return (
    <div>
      <form className="form card faq-editor" onSubmit={submit}>
        <h2>
          <span className="material-symbols-outlined">{editing ? 'edit' : 'add_circle'}</span>
          {editing ? ' Edit FAQ entry' : ' Create a new FAQ'}
        </h2>
        <div className="grid-2">
          <label>
            Category
            <input name="category" value={form.category} onChange={onChange} required />
          </label>
          <label>
            Sort order
            <input name="sort_order" type="number" value={form.sort_order} onChange={onChange} />
          </label>
        </div>
        <label>
          Question
          <input name="question" value={form.question} onChange={onChange} required />
        </label>
        <label>
          Answer
          <textarea name="answer" value={form.answer} onChange={onChange} rows={4} required />
        </label>
        <div className="row">
          <button className="btn-primary" disabled={busy}>
            {editing ? 'Save changes' : '+ Create FAQ'}
          </button>
          {editing && (
            <button
              type="button"
              className="btn-link"
              onClick={() => {
                setEditing(null);
                setForm(EMPTY);
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      {groups.map((g) => (
        <section key={g.category}>
          <h2>{g.category}</h2>
          <table className="admin-table">
            <tbody>
              {g.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    {item.question}
                    {item.is_outdated && <span className="badge flag">outdated</span>}
                    {item.source === 'qa' && <span className="badge">from Q&amp;A</span>}
                  </td>
                  <td className="nowrap">
                    <div className="row">
                      <button className="btn-link" onClick={() => startEdit(item)}>
                        Edit
                      </button>
                      <button className="btn-link" onClick={() => toggleOutdated(item)}>
                        {item.is_outdated ? 'Mark current' : 'Mark outdated'}
                      </button>
                      <button className="btn-link danger" onClick={() => onDelete(item.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
