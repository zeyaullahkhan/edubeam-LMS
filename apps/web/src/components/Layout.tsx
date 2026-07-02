import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth';
import { stateFor } from '../config/states';
import { api } from '../api';
import { ConfirmDialog } from './ConfirmDialog';
import { useAcademicYear, YEAR_OPTIONS } from '../contexts/AcademicYearContext';

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
    { to: '/academic-years',     label: 'Academic Years',    icon: 'fas fa-calendar-alt' },
    { to: '/classes',            label: 'Classes',           icon: 'fas fa-chalkboard-teacher' },
    { to: '/subjects',           label: 'Subjects',          icon: 'fas fa-book-open' },
    { to: '/teacher-allocation', label: 'Teacher Allocation',icon: 'fas fa-user-tie' },
    { to: '/homework',           label: 'Homework',          icon: 'fas fa-pen-to-square' },
    { to: '/academic-progress',  label: 'Academic Progress', icon: 'fas fa-tasks' },
  ]},
  { heading: 'Library', items: [
    { to: '/library', label: 'Library', icon: 'fas fa-book' },
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
    { to: '/',         label: 'My Portal', icon: 'fas fa-id-card' },
    { to: '/homework', label: 'Homework',  icon: 'fas fa-pen-to-square' },
    { to: '/quiz',     label: 'Quiz',      icon: 'fas fa-question-circle' },
    { to: '/content',  label: 'Content',   icon: 'fas fa-play-circle' },
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

// ── Profile + change-password modal (all roles) ──────────────────────────────
function ProfileModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setMsg(null);
    if (!form.current || !form.next) { setMsg({ ok: false, text: 'Enter your current and new password.' }); return; }
    if (form.next.length < 6) { setMsg({ ok: false, text: 'New password must be at least 6 characters.' }); return; }
    if (form.next !== form.confirm) { setMsg({ ok: false, text: 'New password and confirmation do not match.' }); return; }
    setSaving(true);
    try {
      await api.changePassword(form.current, form.next);
      setMsg({ ok: true, text: 'Password changed successfully.' });
      setForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      setMsg({ ok: false, text: e.message ?? 'Could not change password.' });
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100';
  const rows: [string, string | null | undefined][] = [
    ['Email', user?.email],
    ['Role', ROLE_LABELS[user?.role ?? ''] ?? user?.role],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full my-8 overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-navy-700 to-sky-700 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-sky-300 text-navy-800 flex items-center justify-center font-bold shrink-0">
            {(user?.name ?? '?').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-heading font-bold text-lg leading-tight truncate">{user?.name}</h2>
            <p className="text-sky-200 text-xs truncate">{user?.email}</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white shrink-0"><i className="fas fa-times text-lg" /></button>
        </div>

        {/* Profile details */}
        <div className="px-6 py-4 border-b border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Profile</p>
          <div className="space-y-1.5">
            {rows.map(([label, val]) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-slate-400">{label}</span>
                <span className="text-slate-700 font-medium truncate max-w-[220px]">{val ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Change password */}
        <div className="px-6 py-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <i className="fas fa-key text-slate-300" />Change Password
          </p>
          <input type="password" value={form.current} onChange={e => set('current', e.target.value)} placeholder="Current password" className={inp} autoComplete="current-password" />
          <input type="password" value={form.next} onChange={e => set('next', e.target.value)} placeholder="New password (min 6 chars)" className={inp} autoComplete="new-password" />
          <input type="password" value={form.confirm} onChange={e => set('confirm', e.target.value)} placeholder="Confirm new password" className={inp} autoComplete="new-password" />

          {msg && (
            <div className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2 ${msg.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              <i className={`fas ${msg.ok ? 'fa-circle-check' : 'fa-circle-exclamation'} shrink-0`} />{msg.text}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Close</button>
            <button onClick={submit} disabled={saving}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm font-semibold hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 transition-all">
              {saving ? <><i className="fas fa-circle-notch fa-spin mr-1.5" />Saving…</> : 'Update Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { academicYear, setAcademicYear } = useAcademicYear();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [allNotices, setAllNotices] = useState<any[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [showNoticePopup, setShowNoticePopup] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const groups = navGroupsFor(user?.role);
  const state = user ? stateFor(user) : null;
  const closeMobile = () => setMobileOpen(false);

  // localStorage key per student
  const seenKey = user?.id ? `noticed_seen_${user.id}` : null;

  // Load seen IDs from localStorage on mount
  useEffect(() => {
    if (!seenKey) return;
    try {
      const stored = JSON.parse(localStorage.getItem(seenKey) ?? '[]');
      setSeenIds(new Set(stored));
    } catch { /* ignore */ }
  }, [seenKey]);

  // Load notices for students
  useEffect(() => {
    if (user?.role !== 'STUDENT') return;
    const load = () => {
      api.notices(user.schoolId ? { schoolId: user.schoolId } : {})
        .then(n => setAllNotices(n))
        .catch(() => null);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [user?.role, user?.schoolId]);

  // Unread = notices not yet seen
  const unreadNotices = allNotices.filter(n => !seenIds.has(n.id));
  const unreadCount = unreadNotices.length;
  const noticePreview = allNotices.slice(0, 5);

  // Mark all as seen when popup opens
  const openPopup = () => {
    setShowNoticePopup(true);
    if (!seenKey || allNotices.length === 0) return;
    const newSeen = new Set([...seenIds, ...allNotices.map(n => n.id)]);
    setSeenIds(newSeen);
    try { localStorage.setItem(seenKey, JSON.stringify([...newSeen])); } catch { /* ignore */ }
  };

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
      <div className="shrink-0 border-t border-white/10 p-3 relative">
        {/* Themed popover — Change Password only, opens upward above the trigger */}
        {userMenuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
            <div className="absolute left-3 right-3 bottom-full mb-2 z-50 bg-navy-700 rounded-xl shadow-2xl border border-white/10 overflow-hidden">
              <button
                onClick={() => { setUserMenuOpen(false); setProfileOpen(true); closeMobile(); }}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors text-left"
              >
                <i className="fas fa-key text-sky-300 w-4 text-center" />
                Change Password
              </button>
            </div>
          </>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setUserMenuOpen(o => !o)}
            title="Change password"
            className="flex items-center gap-3 min-w-0 flex-1 rounded-lg -m-1 p-1 hover:bg-white/10 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full bg-sky-300 text-navy-800 flex items-center justify-center font-bold text-sm shrink-0">
              {(user?.name ?? '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-sm font-semibold leading-tight truncate">{user?.name}</div>
              <div className="text-sky-300 text-xs truncate">{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</div>
            </div>
          </button>
          <button
            onClick={() => { closeMobile(); setLogoutConfirm(true); }}
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

      {/* ── Profile + change-password modal ─────────────────── */}
      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} />}

      <ConfirmDialog
        open={logoutConfirm}
        title="Sign out?"
        message="You'll need to log in again to access your account."
        confirmLabel="Logout"
        icon="fa-right-from-bracket"
        tone="danger"
        onCancel={() => setLogoutConfirm(false)}
        onConfirm={() => { setLogoutConfirm(false); logout(); navigate('/'); }}
      />

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
            <span className="text-slate-500 text-xs hidden sm:inline">|</span>
            <span className="text-slate-200 text-xs font-medium tracking-wide hidden sm:inline">Valuable Group — EdTech Infrastructure</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Bell notification — students only */}
            {user?.role === 'STUDENT' && (
              <div className="relative">
                <button
                  onClick={openPopup}
                  className="relative w-8 h-8 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                  aria-label="Notices"
                >
                  <i className={`fas fa-bell text-lg ${unreadCount > 0 ? 'text-white animate-[wiggle_1s_ease-in-out_3]' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-lg ring-2 ring-navy-800 animate-bounce">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Dropdown popup */}
                {showNoticePopup && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNoticePopup(false)} />
                    <div className="absolute right-0 top-10 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
                      {/* Header */}
                      <div className="flex items-center justify-between px-4 py-3 bg-navy-800">
                        <div className="flex items-center gap-2">
                          <i className="fas fa-bell text-sky-300 text-sm" />
                          <span className="text-white font-bold text-sm">Notices</span>
                          <span className="bg-slate-600 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-full">{allNotices.length} total</span>
                          {unreadCount > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">{unreadCount} new</span>
                          )}
                        </div>
                        <button onClick={() => setShowNoticePopup(false)} className="text-white/50 hover:text-white text-xs">
                          <i className="fas fa-times" />
                        </button>
                      </div>

                      {/* Notice list */}
                      <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
                        {noticePreview.length === 0 ? (
                          <div className="py-8 text-center text-slate-400 text-sm">No notices</div>
                        ) : noticePreview.map(n => {
                          const typeDot: Record<string, string> = { Urgent: 'bg-rose-500', Academic: 'bg-sky-500', Event: 'bg-violet-500', General: 'bg-slate-400' };
                          const isUrgent = n.type === 'Urgent';
                          const isUnread = !seenIds.has(n.id);
                          return (
                            <div key={n.id} className={`flex items-start gap-3 px-4 py-3 transition-colors ${isUrgent ? 'bg-rose-50 hover:bg-rose-100' : isUnread ? 'bg-sky-50/50 hover:bg-sky-50' : 'hover:bg-slate-50'}`}>
                              {/* Type dot */}
                              <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${typeDot[n.type] ?? 'bg-slate-400'} ${isUrgent ? 'animate-pulse' : ''}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <p className={`text-sm font-semibold truncate ${isUrgent ? 'text-rose-700' : 'text-slate-800'}`}>{n.title}</p>
                                  {isUnread && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-sky-500" title="Unread" />}
                                </div>
                                {n.description && <p className="text-xs text-slate-500 truncate mt-0.5">{n.description}</p>}
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {new Date(n.publishDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  {isUrgent && <span className="ml-1 text-rose-500 font-bold">⚠ Urgent</span>}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer */}
                      <div className="border-t border-slate-100 px-4 py-2.5">
                        <button
                          onClick={() => { setShowNoticePopup(false); navigate('/'); setTimeout(() => { document.querySelector('[data-tab="notices"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); }, 100); }}
                          className="w-full text-center text-xs font-bold text-sky-600 hover:text-sky-800 transition-colors"
                        >
                          View all notices <i className="fas fa-arrow-right text-[10px] ml-1" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Global academic year picker */}
            <select
              value={academicYear}
              onChange={e => setAcademicYear(e.target.value)}
              className="text-xs bg-sky-700 border border-sky-500 text-white rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-sky-300 cursor-pointer"
              title="Academic Year"
            >
              {YEAR_OPTIONS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {state ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-200 text-xs font-medium hidden sm:inline">{state.govLabel}</span>
                <img src={state.logo} alt={state.name} className="h-6 w-auto" />
              </div>
            ) : (
              <span className="text-slate-200 text-xs font-medium">All States — Platform Admin</span>
            )}
          </div>
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
                <span className="text-xs text-slate-400">{state.govLabel} · {academicYear}</span>
              </div>
            ) : (
              <span className="text-xs text-slate-400">Edubeam LMS · All States · {academicYear}</span>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
