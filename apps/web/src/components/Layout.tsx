import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { stateFor } from '../config/states';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  STATE_OFFICIAL: 'State Official',
  DISTRICT_OFFICIAL: 'District Official',
  BLOCK_OFFICIAL: 'Block Official',
  PRINCIPAL: 'Principal',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const ADMIN_NAV = [
  { to: '/',             label: 'Dashboard',  icon: 'fas fa-chart-bar' },
  { to: '/analytics',    label: 'Analytics',  icon: 'fas fa-chart-line' },
  { to: '/schools',      label: 'Schools',    icon: 'fas fa-school' },
  { to: '/people',       label: 'People',     icon: 'fas fa-users' },
  { to: '/quiz',         label: 'Quiz',       icon: 'fas fa-question-circle' },
  { to: '/content',      label: 'Content',    icon: 'fas fa-play-circle' },
  { to: '/planner',      label: 'Planner',    icon: 'fas fa-calendar-alt' },
];

const STUDENT_NAV = [
  { to: '/',        label: 'My Portal', icon: 'fas fa-id-card' },
  { to: '/quiz',    label: 'Quiz',      icon: 'fas fa-question-circle' },
  { to: '/content', label: 'Content',   icon: 'fas fa-play-circle' },
];

const PARENT_NAV = [
  { to: '/', label: 'My Children', icon: 'fas fa-users' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = user?.role === 'STUDENT' ? STUDENT_NAV : user?.role === 'PARENT' ? PARENT_NAV : ADMIN_NAV;
  const state = user ? stateFor(user) : null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Top header bar (branding + state logo) ───────────── */}
      <div className="bg-navy-800 border-b border-navy-700 no-print">
        <div className="max-w-7xl mx-auto px-4 h-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/valuable-group-logo.png" alt="Valuable Group" className="h-5 w-auto opacity-90" />
            <span className="text-navy-200 text-xs">|</span>
            <span className="text-navy-300 text-xs tracking-wide">Valuable Group — EdTech Infrastructure</span>
          </div>
          {state ? (
            <div className="flex items-center gap-2">
              <span className="text-navy-300 text-xs">{state.govLabel}</span>
              <img src={state.logo} alt={state.name} className="h-6 w-auto" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-navy-300 text-xs">All States — Platform Admin</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main navigation header ────────────────────────────── */}
      <header className="app-header no-print">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center h-16 gap-6">
            {/* Logo + wordmark */}
            <NavLink to="/" className="flex items-center gap-3 shrink-0">
              <div className="bg-white rounded-lg p-1.5 shadow-sm">
                <img src="/vepl-logo.png" alt="Edubeam" className="h-8 w-auto" />
              </div>
              <div className="leading-tight">
                <div className="font-heading font-bold text-white text-lg leading-none">Edubeam LMS</div>
                <div className="text-[10px] text-sky-300 uppercase tracking-widest font-medium">
                  by Valuable Group
                </div>
              </div>
            </NavLink>

            {/* Nav links */}
            <nav className="flex items-center gap-1 ml-4">
              {navItems.map(({ to, label, icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-sky-300/20 text-sky-300 shadow-inner'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <i className={`${icon} text-xs`} />
                  {label}
                </NavLink>
              ))}
              {user?.role === 'ADMIN' && (
                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-sky-300/20 text-sky-300 shadow-inner'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`
                  }
                >
                  <i className="fas fa-users-cog text-xs" />
                  Users
                </NavLink>
              )}
            </nav>

            {/* Right — user info + sign out */}
            <div className="ml-auto flex items-center gap-4">
              <div className="text-right">
                <div className="text-white text-sm font-semibold leading-tight">{user?.name}</div>
                <div className="text-sky-300 text-xs">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="flex items-center gap-1.5 text-white/60 hover:text-red-400 text-xs font-medium transition-colors duration-200"
              >
                <i className="fas fa-sign-out-alt" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="no-print mt-12 border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/vepl-logo.png" alt="Edubeam" className="h-6 w-auto opacity-60" />
            <span className="text-xs text-slate-400">
              © {new Date().getFullYear()} Valuable Edutainment Pvt. Ltd. All rights reserved.
            </span>
          </div>
          {state ? (
            <div className="flex items-center gap-2">
              <img src={state.logo} alt={state.name} className="h-6 w-auto opacity-50" />
              <span className="text-xs text-slate-400">{state.govLabel} · 2025–26</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Edubeam LMS · All States · 2025–26</span>
          )}
        </div>
      </footer>
    </div>
  );
}
