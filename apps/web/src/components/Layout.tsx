import { useState } from 'react';
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

interface NavItem { to: string; label: string; icon: string }
interface NavGroup { heading: string; items: NavItem[] }

// Grouped nav for admin-style roles. Groups keep the list short and let it
// scale vertically as more features are added.
const ADMIN_GROUPS: NavGroup[] = [
  { heading: 'Overview', items: [
    { to: '/',          label: 'Dashboard', icon: 'fas fa-chart-bar' },
    { to: '/analytics', label: 'Analytics', icon: 'fas fa-chart-line' },
  ]},
  { heading: 'Institutions', items: [
    { to: '/schools', label: 'Schools', icon: 'fas fa-school' },
    { to: '/people',  label: 'People',  icon: 'fas fa-users' },
  ]},
  { heading: 'Academics', items: [
    { to: '/academic-years', label: 'Academic Years', icon: 'fas fa-calendar-alt' },
    { to: '/classes',        label: 'Classes',        icon: 'fas fa-chalkboard-teacher' },
    { to: '/subjects',       label: 'Subjects',       icon: 'fas fa-book-open' },
  ]},
  { heading: 'Engagement', items: [
    { to: '/notices', label: 'Notice Board', icon: 'fas fa-bullhorn' },
    { to: '/planner', label: 'Planner',      icon: 'fas fa-calendar-check' },
    { to: '/quiz',    label: 'Quiz',         icon: 'fas fa-question-circle' },
    { to: '/content', label: 'Content',      icon: 'fas fa-play-circle' },
  ]},
];

const STUDENT_GROUPS: NavGroup[] = [
  { heading: 'Menu', items: [
    { to: '/',        label: 'My Portal', icon: 'fas fa-id-card' },
    { to: '/quiz',    label: 'Quiz',      icon: 'fas fa-question-circle' },
    { to: '/content', label: 'Content',   icon: 'fas fa-play-circle' },
  ]},
];

const PARENT_GROUPS: NavGroup[] = [
  { heading: 'Menu', items: [
    { to: '/', label: 'My Children', icon: 'fas fa-users' },
  ]},
];

function navGroupsFor(role: string | undefined): NavGroup[] {
  if (role === 'STUDENT') return STUDENT_GROUPS;
  if (role === 'PARENT') return PARENT_GROUPS;
  const groups = ADMIN_GROUPS.map((g) => ({ ...g, items: [...g.items] }));
  if (role === 'ADMIN') {
    groups.push({ heading: 'System', items: [
      { to: '/admin/users', label: 'Users', icon: 'fas fa-users-cog' },
    ]});
  }
  return groups;
}

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
    isActive
      ? 'bg-sky-300/20 text-sky-300 border-l-[3px] border-sky-300 pl-[9px]'
      : 'text-white/70 hover:text-white hover:bg-white/10 border-l-[3px] border-transparent pl-[9px]'
  }`;

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = navGroupsFor(user?.role);
  const state = user ? stateFor(user) : null;
  const closeMobile = () => setMobileOpen(false);

  const sidebar = (
    <>
      {/* Logo / wordmark */}
      <NavLink to="/" onClick={closeMobile} className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/10">
        <div className="bg-white rounded-lg p-1.5 shadow-sm shrink-0">
          <img src="/vepl-logo.png" alt="Edubeam" className="h-7 w-auto" />
        </div>
        <div className="leading-tight">
          <div className="font-heading font-bold text-white text-base leading-none">Edubeam LMS</div>
          <div className="text-[9px] text-sky-300 uppercase tracking-widest font-medium mt-0.5">by Valuable Group</div>
        </div>
      </NavLink>

      {/* Scrollable grouped nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {groups.map((group) => (
          <div key={group.heading}>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sky-200/50">
              {group.heading}
            </div>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={closeMobile} className={itemClass}>
                  <i className={`${icon} text-sm w-4 text-center shrink-0`} />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User + sign out (pinned bottom) */}
      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-sky-300 text-navy-800 flex items-center justify-center font-bold text-sm shrink-0">
            {(user?.name ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-white text-sm font-semibold leading-tight truncate">{user?.name}</div>
            <div className="text-sky-300 text-xs truncate">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
          </div>
          <button
            onClick={() => { logout(); navigate('/'); }}
            title="Sign out"
            className="text-white/50 hover:text-red-400 transition-colors p-1.5 shrink-0"
          >
            <i className="fas fa-sign-out-alt" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* ── Desktop sidebar (fixed) ─────────────────────────── */}
      <aside className="no-print hidden lg:flex w-60 shrink-0 bg-navy-800 flex-col h-screen sticky top-0">
        {sidebar}
      </aside>

      {/* ── Mobile drawer + backdrop ────────────────────────── */}
      {mobileOpen && (
        <div className="no-print fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={closeMobile} />
      )}
      <aside
        className="no-print fixed z-50 top-0 left-0 h-screen w-64 bg-navy-800 flex flex-col lg:hidden transition-transform duration-200"
        style={{ transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        {sidebar}
      </aside>

      {/* ── Content column ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Slim top bar — branding + state logo (and mobile hamburger) */}
        <div className="no-print bg-navy-800 border-b border-navy-700 h-10 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-white/80 hover:text-white text-lg"
              aria-label="Open menu"
            >
              <i className="fas fa-bars" />
            </button>
            <img src="/valuable-group-logo.png" alt="Valuable Group" className="h-5 w-auto opacity-90 hidden sm:block" />
            <span className="text-navy-200 text-xs hidden sm:inline">|</span>
            <span className="text-navy-300 text-xs tracking-wide hidden sm:inline">Valuable Group — EdTech Infrastructure</span>
          </div>
          {state ? (
            <div className="flex items-center gap-2">
              <span className="text-navy-300 text-xs hidden sm:inline">{state.govLabel}</span>
              <img src={state.logo} alt={state.name} className="h-6 w-auto" />
            </div>
          ) : (
            <span className="text-navy-300 text-xs">All States — Platform Admin</span>
          )}
        </div>

        {/* Page content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>

        {/* Footer */}
        <footer className="no-print mt-12 border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between flex-wrap gap-2">
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
    </div>
  );
}
