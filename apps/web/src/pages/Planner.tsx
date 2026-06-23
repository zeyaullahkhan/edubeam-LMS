import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  SCHEDULE, HOLIDAYS as STATIC_HOLIDAYS, STUDIO_LABELS, SUBJECT_COLOR,
  type ScheduleSession,
} from '../data/schedule';
import { api } from '../api';
import { useAuth } from '../auth';
import type { AuthUser } from '@edubeam/shared';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function pad2(n: number) { return String(n).padStart(2, '0'); }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}`; }

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_SLOTS = ['10:00-10:40', '10:40-11:20', '11:20-12:00', '12:00-12:40'];

const SCOPE_LABEL: Record<string, string> = {
  TENANT: 'State-wide', DISTRICT: 'District', BLOCK: 'Block', SCHOOL: 'School',
};

function scopeColorCls(scope: string) {
  if (scope === 'TENANT')   return 'text-orange-700 bg-orange-100 border-orange-300';
  if (scope === 'DISTRICT') return 'text-amber-700 bg-amber-100 border-amber-300';
  if (scope === 'BLOCK')    return 'text-violet-700 bg-violet-100 border-violet-300';
  return 'text-sky-700 bg-sky-100 border-sky-300'; // SCHOOL
}

function scopeCellBg(scope: string | null, sunday: boolean) {
  if (sunday) return { bg: 'bg-red-50', border: 'border-red-200', hover: 'hover:bg-red-100', label: 'text-red-400' };
  if (scope === 'TENANT')   return { bg: 'bg-orange-50', border: 'border-orange-300', hover: 'hover:bg-orange-100', label: 'text-orange-600' };
  if (scope === 'DISTRICT') return { bg: 'bg-amber-50', border: 'border-amber-200', hover: 'hover:bg-amber-100', label: 'text-amber-600' };
  if (scope === 'BLOCK')    return { bg: 'bg-violet-50', border: 'border-violet-200', hover: 'hover:bg-violet-100', label: 'text-violet-600' };
  if (scope === 'SCHOOL')   return { bg: 'bg-sky-50', border: 'border-sky-200', hover: 'hover:bg-sky-100', label: 'text-sky-600' };
  return { bg: 'bg-white', border: 'border-slate-200', hover: 'hover:bg-sky-50', label: 'text-slate-300' };
}

// ─── Calendar Widget ───────────────────────────────────────────────────────────

const SCOPE_LEVELS = [
  { value: 'TENANT',   label: 'State-wide',   icon: 'fa-globe-asia',      color: 'orange' },
  { value: 'DISTRICT', label: 'District',     icon: 'fa-map-marker-alt',  color: 'amber'  },
  { value: 'BLOCK',    label: 'Block',        icon: 'fa-map-pin',         color: 'violet' },
  { value: 'SCHOOL',   label: 'School',       icon: 'fa-school',          color: 'sky'    },
] as const;

function autoScopeForRole(role: string): string {
  if (role === 'STATE_OFFICIAL') return 'TENANT';
  if (role === 'DISTRICT_OFFICIAL') return 'DISTRICT';
  if (role === 'BLOCK_OFFICIAL') return 'BLOCK';
  return 'SCHOOL';
}

function scopeLevelLabel(role: string): string {
  if (role === 'STATE_OFFICIAL') return 'All schools in the state';
  if (role === 'DISTRICT_OFFICIAL') return 'All schools in your district';
  if (role === 'BLOCK_OFFICIAL') return 'All schools in your block';
  return 'This school only';
}

function CalendarWidget({ user }: { user: AuthUser | null }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [ym, setYm] = useState(() => todayStr.slice(0, 7));
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', startDate: '', endDate: '' });
  // Admin scope selection
  const [scopeLevel, setScopeLevel] = useState('TENANT');
  const [scopeTargetId, setScopeTargetId] = useState('');
  const [scopeDistrictFilter, setScopeDistrictFilter] = useState('');
  const [scopeOpts, setScopeOpts] = useState<{ tenants: any[]; districts: any[]; blocks: any[] }>({ tenants: [], districts: [], blocks: [] });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';
  const canMark = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL'].includes(user?.role ?? '');

  const [year, monthNum] = ym.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const startDow = new Date(year, monthNum - 1, 1).getDay();
  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  const changeMonth = (delta: number) => {
    const d = new Date(year, monthNum - 1 + delta, 1);
    setYm(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    setSelected(null);
    setShowForm(false);
  };

  const loadHolidays = useCallback(async () => {
    setLoading(true);
    try { setHolidays(await api.planner.holidays(ym)); }
    finally { setLoading(false); }
  }, [ym]);

  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  // Fetch scope options for roles that need dropdowns
  useEffect(() => {
    if (canMark) {
      api.planner.scopeOptions().then(setScopeOpts).catch(() => {});
    }
  }, [canMark]);

  const holidaysOnDate = (d: string) =>
    holidays.filter(h => d >= h.startDate && d <= h.endDate);

  const isSunday = (d: string) => new Date(d + 'T00:00:00').getDay() === 0;

  const openForm = () => {
    setShowForm(true);
    setFormError('');
    setScopeLevel('TENANT');
    setScopeTargetId('');
    setScopeDistrictFilter('');
  };

  const handleDateClick = (dateStr: string) => {
    const same = selected === dateStr;
    setSelected(same ? null : dateStr);
    setShowForm(false);
    setForm({ title: '', description: '', startDate: dateStr, endDate: dateStr });
    setFormError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdmin && !scopeTargetId) { setFormError('Please select a specific target for the chosen scope level.'); return; }
    setSaving(true); setFormError('');
    try {
      const payload: any = { ...form };
      if (isAdmin) { payload.scopeLevel = scopeLevel; payload.scopeTargetId = scopeTargetId; }
      await api.planner.createHoliday(payload);
      setShowForm(false);
      setForm(f => ({ ...f, title: '', description: '' }));
      loadHolidays();
    } catch (err: any) {
      setFormError(err.message);
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    setDeletingId(id);
    try { await api.planner.deleteHoliday(id); loadHolidays(); }
    finally { setDeletingId(null); }
  };

  const cells: Array<string | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${ym}-${pad2(d)}`);

  const upcomingHoliday = holidays.find(h => h.startDate >= todayStr);
  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-full';

  // Filtered blocks for admin cascading
  const filteredBlocks = scopeOpts.blocks.filter(b => !scopeDistrictFilter || b.districtId === scopeDistrictFilter);

  return (
    <div className="space-y-4">
      {/* Upcoming holiday banner */}
      {upcomingHoliday && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-2xl flex-shrink-0">🗓️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Next Upcoming Holiday</p>
            <p className="font-bold text-amber-800 text-sm">{upcomingHoliday.title}</p>
            <p className="text-xs text-amber-600">
              {fmtDate(upcomingHoliday.startDate)}
              {upcomingHoliday.endDate !== upcomingHoliday.startDate ? ` – ${fmtDate(upcomingHoliday.endDate)}` : ''}
            </p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${scopeColorCls(upcomingHoliday.scope)}`}>
            {SCOPE_LABEL[upcomingHoliday.scope] ?? upcomingHoliday.scope}
          </span>
        </div>
      )}

      {/* Month navigation + legend */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
            <i className="fas fa-chevron-left text-xs" />
          </button>
          <h3 className="font-bold text-slate-700 text-lg min-w-[180px] text-center">{monthLabel}</h3>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
            <i className="fas fa-chevron-right text-xs" />
          </button>
          {loading && <i className="fas fa-circle-notch fa-spin text-slate-300 text-sm" />}
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" /> Weekend</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 border border-orange-400 inline-block" /> State</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" /> District</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-200 border border-violet-400 inline-block" /> Block</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-sky-200 border border-sky-400 inline-block" /> School</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_NAMES.map(d => (
          <div key={d} className={`text-xs font-bold text-center py-1.5 ${d === 'Sun' ? 'text-red-500' : 'text-slate-500'}`}>{d}</div>
        ))}
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`blank-${i}`} className="rounded-lg" />;
          const dayHolidays = holidaysOnDate(dateStr);
          const sunday = isSunday(dateStr);
          const isSelected = selected === dateStr;
          const isToday = dateStr === todayStr;
          const topScope = dayHolidays.find(h => h.scope === 'TENANT') ? 'TENANT'
            : dayHolidays.find(h => h.scope === 'DISTRICT') ? 'DISTRICT'
            : dayHolidays.find(h => h.scope === 'BLOCK') ? 'BLOCK'
            : dayHolidays.length > 0 ? 'SCHOOL' : null;
          const { bg, border, hover, label } = scopeCellBg(sunday ? null : topScope, sunday);
          const dayNum = parseInt(dateStr.split('-')[2]);
          return (
            <button key={dateStr} onClick={() => handleDateClick(dateStr)}
              className={`relative rounded-xl border px-1.5 pt-2 pb-1.5 text-left transition-all cursor-pointer flex flex-col gap-0.5 min-h-[80px]
                ${bg} ${hover} ${isSelected ? 'border-sky-500 ring-2 ring-sky-300' : border}`}>
              <span className={`text-sm font-bold leading-none self-center mb-0.5 ${
                isToday ? 'bg-sky-600 text-white rounded-full w-6 h-6 flex items-center justify-center'
                : sunday ? 'text-red-500' : 'text-slate-700'
              }`}>{dayNum}</span>
              {sunday && <span className="text-[9px] font-bold text-red-400 text-center w-full">Sunday</span>}
              {dayHolidays.length > 0 && (
                <span className={`text-[9px] font-bold text-center w-full leading-tight break-words ${label}`}>
                  {dayHolidays[0].title}{dayHolidays.length > 1 && ` +${dayHolidays.length - 1}`}
                </span>
              )}
              {!sunday && !topScope && canMark && (
                <span className="text-[9px] text-slate-200 text-center w-full mt-auto leading-tight">+ mark</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date panel */}
      {selected && (
        <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100">
            <p className="font-bold text-slate-700">
              <i className="fas fa-calendar-day text-sky-400 mr-2" />
              {fmtDate(selected)}
            </p>
            {canMark && !isSunday(selected) && (
              <button onClick={() => { showForm ? setShowForm(false) : openForm(); }}
                className="flex items-center gap-1.5 text-xs text-sky-600 bg-sky-50 border border-sky-200 rounded-lg px-3 py-1.5 hover:bg-sky-100 font-semibold">
                <i className={`fas fa-${showForm ? 'times' : 'plus'}`} />
                {showForm ? 'Cancel' : 'Mark Holiday'}
              </button>
            )}
          </div>

          <div className="p-4 space-y-2">
            {isSunday(selected) && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm">
                <i className="fas fa-calendar-times" /> Weekend — No sessions scheduled
              </div>
            )}

            {holidaysOnDate(selected).map(h => (
              <div key={h.id} className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-sm ${scopeColorCls(h.scope)}`}>
                <i className="fas fa-umbrella-beach mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{h.title}</p>
                  {h.description && <p className="text-xs opacity-80 mt-0.5">{h.description}</p>}
                  <p className="text-xs opacity-60 mt-1">
                    {SCOPE_LABEL[h.scope] ?? h.scope} level
                    {h.createdByName && <> · Marked by {h.createdByName}</>}
                    {h.startDate !== h.endDate && <> · {fmtDate(h.startDate)} – {fmtDate(h.endDate)}</>}
                  </p>
                </div>
                {canMark && (
                  <button onClick={() => remove(h.id)} disabled={deletingId === h.id}
                    className="hover:text-red-500 flex-shrink-0 p-1 transition-colors opacity-50 hover:opacity-100 disabled:opacity-30">
                    <i className="fas fa-trash-alt text-xs" />
                  </button>
                )}
              </div>
            ))}

            {!isSunday(selected) && holidaysOnDate(selected).length === 0 && !showForm && (
              <p className="text-sm text-emerald-600 flex items-center gap-1.5">
                <i className="fas fa-check-circle" /> Regular working day
                {canMark && <span className="text-xs text-slate-400">— click "Mark Holiday" to add one</span>}
              </p>
            )}

            {showForm && canMark && (
              <form onSubmit={save} className="space-y-4 pt-3 border-t border-slate-200 mt-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">New Holiday</p>

                {/* Title & description */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Holiday Title *</label>
                    <input className={inputCls} placeholder="e.g. Eid, Independence Day, School Function" required
                      value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Description (optional)</label>
                    <input className={inputCls} placeholder="Additional details..."
                      value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                  </div>
                </div>

                {/* Date range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">From Date</label>
                    <input type="date" className={inputCls} value={form.startDate}
                      onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate }))} />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">To Date</label>
                    <input type="date" className={inputCls} value={form.endDate} min={form.startDate}
                      onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>

                {/* ── Scope selector ── */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3">
                  <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <i className="fas fa-sitemap text-sky-400" /> Applies To (Scope)
                  </p>

                  {isAdmin ? (
                    /* ADMIN: full scope picker */
                    <>
                      <div className="grid grid-cols-4 gap-1.5">
                        {SCOPE_LEVELS.map(sl => (
                          <button key={sl.value} type="button"
                            onClick={() => { setScopeLevel(sl.value); setScopeTargetId(''); setScopeDistrictFilter(''); }}
                            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              scopeLevel === sl.value
                                ? 'bg-sky-600 text-white border-sky-600 shadow'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'
                            }`}>
                            <i className={`fas ${sl.icon} text-base`} />
                            {sl.label}
                          </button>
                        ))}
                      </div>

                      {/* TENANT: state dropdown */}
                      {scopeLevel === 'TENANT' && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Select State *</label>
                          <select value={scopeTargetId} onChange={e => setScopeTargetId(e.target.value)} className={inputCls} required>
                            <option value="">— Choose a state —</option>
                            {scopeOpts.tenants.map(t => (
                              <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* DISTRICT: district dropdown */}
                      {scopeLevel === 'DISTRICT' && (
                        <div>
                          <label className="block text-xs text-slate-500 mb-1">Select District *</label>
                          <select value={scopeTargetId} onChange={e => setScopeTargetId(e.target.value)} className={inputCls} required>
                            <option value="">— Choose a district —</option>
                            {scopeOpts.districts.map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* BLOCK: cascading district → block */}
                      {scopeLevel === 'BLOCK' && (
                        <div className="space-y-2">
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Filter by District</label>
                            <select value={scopeDistrictFilter}
                              onChange={e => { setScopeDistrictFilter(e.target.value); setScopeTargetId(''); }}
                              className={inputCls}>
                              <option value="">— All Districts —</option>
                              {scopeOpts.districts.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-500 mb-1">Select Block *</label>
                            <select value={scopeTargetId} onChange={e => setScopeTargetId(e.target.value)} className={inputCls} required>
                              <option value="">— Choose a block —</option>
                              {filteredBlocks.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}

                      {/* SCHOOL: info message — use principal login */}
                      {scopeLevel === 'SCHOOL' && (
                        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                          <i className="fas fa-info-circle mt-0.5 flex-shrink-0" />
                          For school-level holidays, ask the school Principal to mark it from their login — they have direct access to their school scope.
                        </div>
                      )}
                    </>
                  ) : (
                    /* Non-admin: show fixed scope info */
                    <div className="flex items-center gap-3 flex-wrap">
                      {SCOPE_LEVELS.map(sl => {
                        const isActive = sl.value === autoScopeForRole(user?.role ?? '');
                        return (
                          <div key={sl.value}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${
                              isActive
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-white text-slate-300 border-slate-100'
                            }`}>
                            <i className={`fas ${sl.icon}`} />
                            {sl.label}
                            {isActive && <i className="fas fa-check ml-1" />}
                          </div>
                        );
                      })}
                      <p className="w-full text-xs text-slate-500 mt-1">
                        <i className="fas fa-lock mr-1 text-slate-300" />
                        {scopeLevelLabel(user?.role ?? '')} — scope is set by your role
                      </p>
                    </div>
                  )}
                </div>

                {formError && (
                  <p className="text-xs text-red-500 flex items-center gap-1.5">
                    <i className="fas fa-exclamation-circle" /> {formError}
                  </p>
                )}
                <div className="flex justify-end">
                  <button type="submit" disabled={saving || (isAdmin && scopeLevel !== 'SCHOOL' && !scopeTargetId)}
                    className="bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-40">
                    {saving ? 'Saving…' : 'Mark Holiday'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Holiday list for the month */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-700 text-white text-xs font-semibold px-4 py-2.5 flex items-center justify-between">
          <span><i className="fas fa-list mr-2" />Holidays — {monthLabel}</span>
          {loading && <i className="fas fa-circle-notch fa-spin text-slate-400" />}
        </div>
        {!loading && holidays.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            <i className="fas fa-calendar-check text-2xl mb-2 text-slate-200 block" />
            No holidays marked for this month.
            {canMark && <p className="text-xs mt-1">Click any date on the calendar to add one.</p>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Date</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Holiday</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Scope</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-600">Marked By</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map(h => (
                <tr key={h.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700 whitespace-nowrap text-xs">
                    {fmtDate(h.startDate)}
                    {h.endDate !== h.startDate && <> – {fmtDate(h.endDate)}</>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-800 font-medium">
                    {h.title}
                    {h.description && <p className="text-xs text-slate-400 font-normal">{h.description}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scopeColorCls(h.scope)}`}>
                      {SCOPE_LABEL[h.scope] ?? h.scope}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{h.createdByName ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── School Planner ────────────────────────────────────────────────────────────

function subjectColor(subject: string): string {
  return SUBJECT_COLOR[subject] ?? '#64748b';
}

function SubjectChip({ subject, teacher }: { subject: string; teacher: string }) {
  const color = subjectColor(subject);
  return (
    <div className="rounded-lg px-2 py-1.5 text-white text-xs font-semibold shadow-sm"
      style={{ backgroundColor: color }} title={`${subject} — ${teacher}`}>
      <p className="leading-tight truncate">{subject}</p>
      <p className="text-white/80 text-[10px] leading-tight truncate">{teacher}</p>
    </div>
  );
}

const JUNE_DAYS = 30;
const OFF_DATES = new Set(STATIC_HOLIDAYS.map(h => h.date));
const WORKING_DAYS: string[] = [];
for (let d = 1; d <= JUNE_DAYS; d++) {
  const key = dateKey(2026, 6, d);
  if (!OFF_DATES.has(key)) WORKING_DAYS.push(key);
}

function SchoolPlanner({ apiHolidays }: { apiHolidays: any[] }) {
  const [studio, setStudio] = useState<1 | 2 | 3 | 4>(1);
  const [view, setView] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const key = dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return WORKING_DAYS.find(d => d >= key) ?? WORKING_DAYS[0] ?? '2026-06-01';
  });

  // Merge static + API holidays for off-date detection
  const allOffDates = useMemo(() => {
    const set = new Set(OFF_DATES);
    for (const h of apiHolidays) {
      const start = new Date(h.startDate + 'T00:00:00');
      const end = new Date(h.endDate + 'T00:00:00');
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        set.add(dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate()));
      }
    }
    return set;
  }, [apiHolidays]);

  const weekStart = useMemo(() => {
    const dt = new Date(selectedDate + 'T00:00:00');
    const dow = dt.getDay();
    const start = new Date(dt);
    start.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1));
    return start;
  }, [selectedDate]);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }), [weekStart]);

  const studioSessions = useMemo(() => SCHEDULE.filter(s => s.studio === studio), [studio]);

  function sessionsFor(date: string, slot: string): ScheduleSession | undefined {
    return studioSessions.find(s => s.date === date && s.timeSlot === slot);
  }

  function prevDay() {
    const idx = WORKING_DAYS.indexOf(selectedDate);
    if (idx > 0) setSelectedDate(WORKING_DAYS[idx - 1]);
  }
  function nextDay() {
    const idx = WORKING_DAYS.indexOf(selectedDate);
    if (idx < WORKING_DAYS.length - 1) setSelectedDate(WORKING_DAYS[idx + 1]);
  }

  const isOffDay = (date: string) => allOffDates.has(date);

  const getHolidayName = (date: string) => {
    const staticH = STATIC_HOLIDAYS.find(h => h.date === date);
    if (staticH) return staticH.name;
    const apiH = apiHolidays.find(h => date >= h.startDate && date <= h.endDate);
    return apiH?.title ?? 'Holiday';
  };

  return (
    <div className="space-y-4">
      {/* Studio tabs */}
      <div className="flex flex-wrap gap-2">
        {([1, 2, 3, 4] as const).map(s => (
          <button key={s} onClick={() => setStudio(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              studio === s
                ? 'bg-sky-600 text-white border-sky-600 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'
            }`}>
            <i className="fas fa-tv mr-1.5" />{STUDIO_LABELS[s]}
          </button>
        ))}
      </div>

      {/* View toggle + date nav */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button onClick={() => setView('daily')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${view === 'daily' ? 'bg-white text-sky-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
            <i className="fas fa-calendar-day mr-1.5" />Daily
          </button>
          <button onClick={() => setView('weekly')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${view === 'weekly' ? 'bg-white text-sky-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>
            <i className="fas fa-calendar-week mr-1.5" />Weekly
          </button>
        </div>

        {view === 'daily' && (
          <div className="flex items-center gap-2">
            <button onClick={prevDay} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <i className="fas fa-chevron-left text-xs" />
            </button>
            <select value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 bg-white">
              {WORKING_DAYS.map(d => (
                <option key={d} value={d}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
            <button onClick={nextDay} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <i className="fas fa-chevron-right text-xs" />
            </button>
          </div>
        )}

        {view === 'weekly' && (
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const prev = new Date(weekStart);
              prev.setDate(prev.getDate() - 7);
              const key = dateKey(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
              const found = WORKING_DAYS.find(d => d >= key);
              if (found) setSelectedDate(found);
            }} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <i className="fas fa-chevron-left text-xs" />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2">Week of {fmtDate(weekDates[0])}</span>
            <button onClick={() => {
              const next = new Date(weekStart);
              next.setDate(next.getDate() + 7);
              const key = dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate());
              const found = WORKING_DAYS.find(d => d >= key);
              if (found) setSelectedDate(found);
            }} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <i className="fas fa-chevron-right text-xs" />
            </button>
          </div>
        )}
      </div>

      {/* Daily view */}
      {view === 'daily' && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-5 py-3 bg-slate-700 text-white flex items-center justify-between">
            <span className="font-bold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-sky-300 text-sm font-semibold">{STUDIO_LABELS[studio]}</span>
          </div>
          {isOffDay(selectedDate) ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-calendar-times text-3xl mb-2 text-red-400 block" />
              <p className="font-semibold text-slate-600">{getHolidayName(selectedDate)}</p>
              <p className="text-sm">No sessions scheduled today.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Time Slot</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Teacher</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class Group</th>
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, i) => {
                  const sess = sessionsFor(selectedDate, slot);
                  return (
                    <tr key={slot} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-5 py-3 font-mono text-sm font-semibold text-slate-600">{slot}</td>
                      <td className="px-5 py-3">
                        {sess ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-sm font-semibold"
                            style={{ backgroundColor: subjectColor(sess.subject) }}>{sess.subject}</span>
                        ) : <span className="text-slate-300 text-sm">—</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{sess?.teacher ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{sess?.classGroup ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Weekly view */}
      {view === 'weekly' && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-5 py-3 bg-slate-700 text-white">
            <span className="font-bold">Weekly Schedule — {STUDIO_LABELS[studio]}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '110px' }} />
                {weekDates.map(d => <col key={d} />)}
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                  {weekDates.map(d => {
                    const dt = new Date(d + 'T00:00:00');
                    const off = isOffDay(d);
                    return (
                      <th key={d} className={`text-center px-2 py-2 text-xs font-semibold uppercase tracking-wide ${off ? 'text-red-400 bg-red-50' : 'text-slate-500'}`}>
                        <span>{DAY_NAMES[dt.getDay()]}</span>
                        <span className="block text-sm font-bold">{dt.getDate()}</span>
                        {off && <span className="text-[10px] font-normal normal-case">{getHolidayName(d)}</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, si) => (
                  <tr key={slot} className={`border-t border-slate-100 ${si % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-500 whitespace-nowrap">{slot}</td>
                    {weekDates.map(d => {
                      const off = isOffDay(d);
                      if (off) return <td key={d} className="px-2 py-2 bg-red-50 text-center"><span className="text-red-300 text-xs">—</span></td>;
                      const sess = sessionsFor(d, slot);
                      return (
                        <td key={d} className="px-2 py-2">
                          {sess ? <SubjectChip subject={sess.subject} teacher={sess.teacher} /> : <span className="text-slate-200 text-xs text-center block">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subject legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SUBJECT_COLOR).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5 text-xs font-semibold text-white px-2.5 py-1 rounded-full"
            style={{ backgroundColor: color }}>{name}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Event Notifications ───────────────────────────────────────────────────────

const EVENT_TYPE_COLOR: Record<string, string> = {
  ceremony:   'bg-violet-100 text-violet-700 border-violet-300',
  workshop:   'bg-sky-100 text-sky-700 border-sky-300',
  assessment: 'bg-rose-100 text-rose-700 border-rose-300',
  meeting:    'bg-teal-100 text-teal-700 border-teal-300',
  other:      'bg-slate-100 text-slate-600 border-slate-300',
};

const EVENT_TYPES = ['Ceremony', 'Workshop', 'Assessment', 'Meeting', 'Exam', 'Other'] as const;
type EventType = typeof EVENT_TYPES[number];

const CREATE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL'];

function typeIcon(t: string) {
  const m: Record<string, string> = {
    ceremony: 'star', workshop: 'tools', assessment: 'clipboard-list',
    meeting: 'users', exam: 'file-alt', other: 'info-circle',
  };
  return m[t.toLowerCase()] ?? 'info-circle';
}

function EventNotifications({ user }: { user: AuthUser | null }) {
  const canCreate = CREATE_ROLES.includes(user?.role ?? '');
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', type: 'Other', date: '', endDate: '', urgent: false });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formErr, setFormErr] = useState('');

  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEvents(await api.planner.events()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'urgent') return events.filter(e => e.urgent);
    if (filter === 'all') return events;
    return events.filter(e => e.type.toLowerCase() === filter);
  }, [filter, events]);

  const urgentCount = events.filter(e => e.urgent).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');
    if (!form.title.trim() || !form.date) { setFormErr('Title and date are required.'); return; }
    setSaving(true);
    try {
      await api.planner.createEvent(form);
      setForm({ title: '', description: '', type: 'Other', date: '', endDate: '', urgent: false });
      setShowForm(false);
      load();
    } catch (err: any) {
      setFormErr(err.message ?? 'Failed to save event');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try { await api.planner.deleteEvent(id); load(); }
    finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'urgent', ...EVENT_TYPES.map(t => t.toLowerCase())] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>
              {f === 'urgent' && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
              {f === 'all' ? 'All Events' : f === 'urgent' ? 'Urgent' : f.charAt(0).toUpperCase() + f.slice(1)}
              {f === 'urgent' && urgentCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] rounded-full px-1 min-w-[16px] text-center">{urgentCount}</span>
              )}
            </button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => setShowForm(s => !s)} className={showForm ? 'btn-outline text-sm' : 'btn-navy text-sm'}>
            {showForm ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Add Event</>}
          </button>
        )}
      </div>

      {/* Create event form */}
      {showForm && canCreate && (
        <form onSubmit={handleCreate} className="rounded-xl border border-sky-200 bg-sky-50 p-5 space-y-3">
          <h3 className="font-semibold text-slate-700 text-sm"><i className="fas fa-bell text-sky-500 mr-1.5" />New Event</h3>
          {formErr && <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded px-3 py-2">{formErr}</p>}
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50"
                value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Event title" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
              <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                value={form.date} min={today} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date (optional)</label>
              <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                value={form.endDate} min={form.date || today} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none resize-none"
                rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional details…" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.urgent} onChange={e => setForm({ ...form, urgent: e.target.checked })}
                className="accent-rose-500 w-4 h-4" />
              <span className="text-rose-600 font-semibold">Mark as Urgent</span>
            </label>
            <button type="submit" disabled={saving} className="btn-primary text-sm ml-auto">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
              Save Event
            </button>
          </div>
        </form>
      )}

      {loading && (
        <div className="py-8 text-center text-slate-400">
          <i className="fas fa-circle-notch fa-spin text-2xl mb-2 block" />
          <p className="text-sm">Loading events…</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {filtered.map(ev => {
            const expanded = expandedId === ev.id;
            const colors = EVENT_TYPE_COLOR[ev.type.toLowerCase()] ?? EVENT_TYPE_COLOR.other;
            return (
              <div key={ev.id}
                className={`rounded-xl border-l-4 border border-slate-200 bg-white overflow-hidden transition-all ${ev.urgent ? 'border-l-rose-500' : 'border-l-sky-400'}`}>
                <div className="px-5 py-4 flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm ${colors}`}>
                      <i className={`fas fa-${typeIcon(ev.type)}`} />
                    </span>
                  </div>
                  <button className="flex-1 text-left min-w-0" onClick={() => setExpandedId(expanded ? null : ev.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{ev.title}</span>
                      {ev.urgent && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5 animate-pulse">
                          <i className="fas fa-exclamation-triangle" /> URGENT
                        </span>
                      )}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${colors}`}>{ev.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><i className="fas fa-calendar" /> {fmtDate(ev.date)}</span>
                      {ev.endDate && ev.endDate !== ev.date && <span className="flex items-center gap-1">→ {fmtDate(ev.endDate)}</span>}
                      {ev.createdByName && <span className="flex items-center gap-1"><i className="fas fa-user" /> {ev.createdByName}</span>}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {canCreate && (ev.createdBy === user?.id || user?.role === 'ADMIN') && (
                      <button onClick={() => handleDelete(ev.id)} disabled={deletingId === ev.id}
                        className="text-slate-300 hover:text-rose-500 transition-colors px-1 py-1 text-xs">
                        {deletingId === ev.id ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-trash" />}
                      </button>
                    )}
                    <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-slate-400 text-xs ml-1`} />
                  </div>
                </div>
                {expanded && ev.description && (
                  <div className="px-5 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                    <p className="text-sm text-slate-600 leading-relaxed pt-3">{ev.description}</p>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <i className="fas fa-bell-slash text-3xl mb-2 block" />
              <p className="font-semibold text-slate-500">No events found</p>
              {canCreate && <p className="text-xs mt-1">Click "Add Event" to create the first one.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Planner Page ─────────────────────────────────────────────────────────

type Tab = 'calendar' | 'planner' | 'events';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'calendar', label: 'Holiday Calendar',    icon: 'fas fa-calendar-alt' },
  { id: 'planner',  label: 'Lecture Schedule',    icon: 'fas fa-chalkboard-teacher' },
  { id: 'events',   label: 'Event Notifications', icon: 'fas fa-bell' },
];

export function Planner() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('calendar');
  const [juneHolidays, setJuneHolidays] = useState<any[]>([]);
  useEffect(() => {
    api.planner.holidays('2026-06').then(setJuneHolidays).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase mb-1">PLANNER</p>
          <h1 className="text-2xl font-bold text-slate-800">Academic Planner</h1>
          <p className="text-sm text-slate-500 mt-1">Manage holidays, lecture schedule &amp; events</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <i className="fas fa-sun text-amber-500" />
          <span className="text-sm font-bold text-emerald-700">Summer Camp</span>
          <span className="text-xs text-emerald-500 ml-1">1–30 Jun 2026</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id ? 'bg-sky-600 text-white shadow' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}>
            <i className={t.icon} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {tab === 'calendar' && <CalendarWidget user={user} />}
        {tab === 'planner'  && <SchoolPlanner apiHolidays={juneHolidays} />}
        {tab === 'events'   && <EventNotifications user={user} />}
      </div>
    </div>
  );
}
