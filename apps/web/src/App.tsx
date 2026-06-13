import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Analytics } from './pages/Analytics';
import { Schools } from './pages/Schools';
import { Students } from './pages/Students';
import { Staff } from './pages/Staff';
import { AdminUsers } from './pages/AdminUsers';
import { Planner } from './pages/Planner';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/schools" element={<Schools />} />
        <Route path="/students" element={<Students />} />
        <Route path="/staff" element={<Staff />} />
        {user.role === 'ADMIN' && <Route path="/admin/users" element={<AdminUsers />} />}
        <Route path="/planner" element={<Planner />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
