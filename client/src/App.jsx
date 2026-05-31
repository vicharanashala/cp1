import { Routes, Route } from 'react-router-dom';
import AppShell from './components/AppShell.jsx';
import Chatbot from './components/Chatbot.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';
import QueryList from './pages/QueryList.jsx';
import QueryDetail from './pages/QueryDetail.jsx';
import AskQuery from './pages/AskQuery.jsx';
import EditQuery from './pages/EditQuery.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Profile from './pages/Profile.jsx';
import Faq from './pages/Faq.jsx';
import Settings from './pages/Settings.jsx';
import Support from './pages/Support.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminOverview from './pages/admin/AdminOverview.jsx';
import AdminModeration from './pages/admin/AdminModeration.jsx';
import AdminFaqManager from './pages/admin/AdminFaqManager.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminMaintenance from './pages/admin/AdminMaintenance.jsx';

export default function App() {
  return (
    <>
      <AppShell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/queries" element={<QueryList />} />
          <Route path="/queries/:id" element={<QueryDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/faq" element={<Faq />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
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
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="faq" element={<AdminFaqManager />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="maintenance" element={<AdminMaintenance />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppShell>
      <Chatbot />
    </>
  );
}
