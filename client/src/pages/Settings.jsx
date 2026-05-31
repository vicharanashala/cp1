import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { updateMe } from '../api/users.js';

const DEFAULT_PREFS = { answers: true, mentions: true, system: true };

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...(user?.notification_prefs ?? {}) });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  if (!user) {
    return (
      <div className="container">
        <h1>Settings</h1>
        <p className="muted">
          Please <Link to="/login">log in</Link> to manage your settings.
        </p>
      </div>
    );
  }

  const toggle = (key) => setPrefs((p) => ({ ...p, [key]: !p[key] }));

  const onSave = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const updated = await updateMe({ name: name.trim(), notification_prefs: prefs });
      updateUser({ name: updated.name, notification_prefs: updated.notification_prefs });
      setStatus({ ok: true, msg: 'Settings saved.' });
    } catch (err) {
      setStatus({ ok: false, msg: err.response?.data?.error ?? 'Could not save settings.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h1>Settings</h1>
      <p className="lead">Manage your account and notification preferences.</p>

      <form className="form" style={{ maxWidth: 520 }} onSubmit={onSave}>
        {status && <div className={status.ok ? 'alert info' : 'alert'}>{status.msg}</div>}

        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </label>

        <h2 style={{ margin: '0.5rem 0 0' }}>Notifications</h2>
        <label className="checkbox">
          <input type="checkbox" checked={!!prefs.answers} onChange={() => toggle('answers')} />
          Answers to my questions
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={!!prefs.mentions} onChange={() => toggle('mentions')} />
          Mentions &amp; replies
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={!!prefs.system} onChange={() => toggle('system')} />
          System &amp; moderation notices
        </label>

        <button className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
