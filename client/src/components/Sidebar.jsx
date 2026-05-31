import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

// Material Symbols icon.
function Icon({ name }) {
  return <span className="material-symbols-outlined">{name}</span>;
}

// Left app-shell navigation (Frozen Precision). `onNavigate` lets the mobile
// drawer close itself when a link is followed.
export default function Sidebar({ onNavigate }) {
  const { user, isAdmin } = useAuth();

  const items = [
    { to: '/', icon: 'home', label: 'Home', end: true },
    { to: '/faq', icon: 'help_center', label: 'FAQ' },
    { to: '/ask', icon: 'edit_square', label: 'Ask a Query' },
    { to: '/queries', icon: 'forum', label: 'Forum' },
    { to: '/leaderboard', icon: 'leaderboard', label: 'Leaderboard' },
    { to: user ? `/users/${user.id}` : '/login', icon: 'person', label: 'Profile' },
  ];
  if (isAdmin) items.push({ to: '/admin', icon: 'shield', label: 'Admin' });

  return (
    <aside className="sidebar">
      <Link to="/" className="brand" onClick={onNavigate}>
        <span className="brand-name">Knowledge Hub</span>
        <span className="brand-sub">Internal Repository</span>
      </Link>

      <Link to="/ask" className="btn-primary sidebar-new" onClick={onNavigate}>
        + New Entry
      </Link>

      <nav className="sidebar-nav">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onNavigate}
          >
            <Icon name={it.icon} />
            {it.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-foot">
        <NavLink
          to="/settings"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <Icon name="settings" />
          Settings
        </NavLink>
        <NavLink
          to="/support"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          onClick={onNavigate}
        >
          <Icon name="contact_support" />
          Support
        </NavLink>
      </div>
    </aside>
  );
}
