import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Placeholder Settings page. Notification preferences + profile editing are
// wired to a real `PATCH /api/users/me` endpoint in Milestone 14.
export default function Settings() {
  const { user } = useAuth();

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

  const prefs = user.notification_prefs ?? { answers: true, mentions: true, system: true };

  return (
    <div className="container">
      <h1>Settings</h1>
      <p className="lead">Manage your account and notification preferences.</p>

      <section className="form" style={{ maxWidth: 520 }}>
        <h2 style={{ margin: 0 }}>Notifications</h2>
        <p className="hint">
          Editing these will be enabled in a later milestone. Current preferences:
        </p>
        <label className="checkbox">
          <input type="checkbox" checked={!!prefs.answers} disabled readOnly /> Answers to my
          questions
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={!!prefs.mentions} disabled readOnly /> Mentions &amp;
          replies
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={!!prefs.system} disabled readOnly /> System &amp;
          moderation notices
        </label>
      </section>
    </div>
  );
}
