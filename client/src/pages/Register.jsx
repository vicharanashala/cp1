import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container narrow">
      <h1>Create your account</h1>
      <form onSubmit={onSubmit} className="form">
        {error && <div className="alert">{error}</div>}
        <label>
          Name
          <input name="name" value={form.name} onChange={onChange} required />
        </label>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={onChange} required />
        </label>
        <label>
          Password
          <span className="pw-field">
            <input
              name="password"
              type={showPw ? 'text' : 'password'}
              value={form.password}
              onChange={onChange}
              minLength={8}
              required
            />
            <button
              type="button"
              className="pw-toggle"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              title={showPw ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined">{showPw ? 'visibility_off' : 'visibility'}</span>
            </button>
          </span>
        </label>
        <button className="btn-primary btn-lg" disabled={busy}>
          {busy ? 'Creating…' : 'Sign up'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
