import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';

function initials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || '?'
  );
}

// Sticky top bar: global search, notifications, and the account avatar menu.
export default function Topbar({ onToggleNav }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the avatar menu on any outside click.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  const onSearch = (e) => {
    e.preventDefault();
    const q = term.trim();
    navigate(q ? `/queries?q=${encodeURIComponent(q)}` : '/queries');
  };

  const onLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onToggleNav} aria-label="Toggle navigation">
        <span className="material-symbols-outlined">menu</span>
      </button>

      <form className="topbar-search" onSubmit={onSearch}>
        <span className="material-symbols-outlined">search</span>
        <input
          placeholder="Search the knowledge base…"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          aria-label="Search"
        />
      </form>

      <div className="topbar-actions">
        {user ? (
          <>
            <NotificationBell />
            <div className="avatar-wrap" ref={menuRef}>
              <button
                className="avatar"
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                title={user.name}
              >
                {initials(user.name)}
              </button>
              {menuOpen && (
                <div className="avatar-menu">
                  <div className="who">
                    <strong>{user.name}</strong>
                    <span>{user.points ?? 0} pts</span>
                  </div>
                  <Link to={`/users/${user.id}`} onClick={() => setMenuOpen(false)}>
                    <span className="material-symbols-outlined">person</span> Profile
                  </Link>
                  <Link to="/saved" onClick={() => setMenuOpen(false)}>
                    <span className="material-symbols-outlined">bookmark</span> Saved
                  </Link>
                  <Link to="/settings" onClick={() => setMenuOpen(false)}>
                    <span className="material-symbols-outlined">settings</span> Settings
                  </Link>
                  <button onClick={onLogout}>
                    <span className="material-symbols-outlined">logout</span> Log out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="btn-ghost">
              Log in
            </Link>
            <Link to="/register" className="btn-primary">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
