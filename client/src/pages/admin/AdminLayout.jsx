import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/attention', label: 'Attention' },
  { to: '/admin/moderation', label: 'Moderation' },
  { to: '/admin/faq', label: 'FAQ' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/audit', label: 'Audit log' },
  { to: '/admin/maintenance', label: 'Maintenance' },
];

export default function AdminLayout() {
  return (
    <div className="container">
      <h1>Admin</h1>
      <nav className="admin-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
