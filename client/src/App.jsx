import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import BanBanner from './components/BanBanner.jsx';
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

export default function App() {
  return (
    <>
      <Navbar />
      <BanBanner />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/queries" element={<QueryList />} />
          <Route path="/queries/:id" element={<QueryDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
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
                <div className="container">
                  <h1>Admin</h1>
                  <p>Admin dashboard arrives in Milestone 6.</p>
                </div>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
