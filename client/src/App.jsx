import { Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Chatbot from './components/Chatbot.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';
import QueryList from './pages/QueryList.jsx';
import QueryDetail from './pages/QueryDetail.jsx';
import AskQuery from './pages/AskQuery.jsx';
import EditQuery from './pages/EditQuery.jsx';
import Profile from './pages/Profile.jsx';
import Faq from './pages/Faq.jsx';
import Settings from './pages/Settings.jsx';
import Support from './pages/Support.jsx';
import Saved from './pages/Saved.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminAttention from './pages/admin/AdminAttention.jsx';
import AdminModeration from './pages/admin/AdminModeration.jsx';
import AdminFaqManager from './pages/admin/AdminFaqManager.jsx';
import AdminTaxonomy from './pages/admin/AdminTaxonomy.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminModerators from './pages/admin/AdminModerators.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminRollback from './pages/admin/AdminRollback.jsx';
import AdminMaintenance from './pages/admin/AdminMaintenance.jsx';

export default function App() {
  const { user, loading } = useAuth();

  // Authentication gate: until a user is logged in, expose nothing but the
  // auth screens - no app shell, dashboards, or sections. Everything else
  // redirects to /login; logging in lands on the main app.
  if (loading) {
    return <div className="auth-gate">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="auth-screen">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/" element={<Home />} />
          <Route path="/queries" element={<QueryList />} />
          <Route path="/queries/:id" element={<QueryDetail />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="/users/:id" element={<Profile />} />
          <Route
            path="/ask"
            element={
              <ProtectedRoute>
                <AskQuery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/queries/:id/edit"
            element={
              <ProtectedRoute>
                <EditQuery />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminOverview />} />
            <Route path="attention" element={<AdminAttention />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="faq" element={<AdminFaqManager />} />
            <Route path="taxonomy" element={<AdminTaxonomy />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="moderators" element={<AdminModerators />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="rollback" element={<AdminRollback />} />
            <Route path="maintenance" element={<AdminMaintenance />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
      <Chatbot />
    </>
  );
}
