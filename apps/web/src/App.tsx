import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { AcademicYearProvider } from './contexts/AcademicYearContext';
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
import { Attendance } from './pages/Attendance';
import { ReportCard } from './pages/ReportCard';
import { Quiz } from './pages/Quiz';
import { NoticeBoard } from './pages/NoticeBoard';
import { AcademicYears } from './pages/AcademicYears';
import { ClassManagement } from './pages/ClassManagement';
import { SubjectMaster } from './pages/SubjectMaster';
import { TeacherAllocation } from './pages/TeacherAllocation';
import { Homework } from './pages/Homework';
import { AcademicProgress } from './pages/AcademicProgress';
import { Library } from './pages/Library';

export function App() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen grid place-items-center text-slate-400">Loading…</div>;
  if (!user) return <Login />;

  // Student and Parent get their own minimal portal
  if (user.role === 'STUDENT') {
    return (
      <AcademicYearProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<StudentPortal />} />
            <Route path="/content" element={<Content />} />
            <Route path="/quiz" element={<Quiz />} />
            <Route path="/homework" element={<Homework />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AcademicYearProvider>
    );
  }

  if (user.role === 'PARENT') {
    return (
      <AcademicYearProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<ParentPortal />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AcademicYearProvider>
    );
  }

  return (
    <AcademicYearProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/schools" element={<Schools />} />
          <Route path="/people" element={<People />} />
          <Route path="/students" element={<Navigate to="/people" replace />} />
          <Route path="/staff" element={<Navigate to="/people" replace />} />
          {user.role === 'ADMIN' && <Route path="/admin/users" element={<AdminUsers />} />}
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/report-card" element={<ReportCard />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/planner" element={<Planner />} />
          <Route path="/content" element={<Content />} />
          <Route path="/notices" element={<NoticeBoard />} />
          <Route path="/academic-years" element={<AcademicYears />} />
          <Route path="/classes" element={<ClassManagement />} />
          <Route path="/subjects" element={<SubjectMaster />} />
          <Route path="/teacher-allocation" element={<TeacherAllocation />} />
          <Route path="/homework" element={<Homework />} />
          <Route path="/academic-progress" element={<AcademicProgress />} />
          <Route path="/library" element={<Library />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </AcademicYearProvider>
  );
}
