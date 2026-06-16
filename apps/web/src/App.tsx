import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Schools } from './pages/Schools';
import { People } from './pages/People';
import { AdminUsers } from './pages/AdminUsers';
import { Planner } from './pages/Planner';
import { StudentPortal } from './pages/StudentPortal';
import { ParentPortal } from './pages/ParentPortal';
import { Content } from './pages/Content';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>;
  if (!user) return <Login />;

  // Student and Parent get their own minimal portal
  if (user.role === 'STUDENT') {
    return (
      <Layout>
        <Routes>
          <Route path="/" element={<StudentPortal />} />
          <Route path="/content" element={<Content />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    );
  }

  if (user.role === 'PARENT') {
    return (
      <Layout>
        <Routes>
          <Route path="/" element={<ParentPortal />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/schools" element={<Schools />} />
        <Route path="/people" element={<People />} />
        <Route path="/students" element={<Navigate to="/people" replace />} />
        <Route path="/staff" element={<Navigate to="/people" replace />} />
        {user.role === 'ADMIN' && <Route path="/admin/users" element={<AdminUsers />} />}
        <Route path="/planner" element={<Planner />} />
        <Route path="/content" element={<Content />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
