import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import BanBanner from './BanBanner.jsx';

// The Frozen Precision app shell: fixed left sidebar + sticky top bar wrapping
// the routed page content. On mobile the sidebar collapses into a drawer.
export default function AppShell({ children }) {
  const [navOpen, setNavOpen] = useState(false);
  const closeNav = () => setNavOpen(false);

  return (
    <div className={`app-shell ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar onNavigate={closeNav} />
      <button
        className="sidebar-backdrop"
        onClick={closeNav}
        aria-label="Close navigation"
        tabIndex={-1}
      />
      <div className="app-main">
        <Topbar onToggleNav={() => setNavOpen((o) => !o)} />
        <BanBanner />
        <main>{children}</main>
      </div>
    </div>
  );
}
