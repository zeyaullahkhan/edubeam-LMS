import { useEffect, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { SCHEDULE, SUBJECT_COLOR } from '../data/schedule';

// ─── constants ────────────────────────────────────────────────────────────────

const GENDER_LABELS: Record<string, string> = { M: 'Male', F: 'Female', O: 'Other' };
const CAT_COLORS: Record<string, string> = {
  GEN: 'bg-blue-100 text-blue-700', OBC: 'bg-green-100 text-green-700',
  SC: 'bg-purple-100 text-purple-700', ST: 'bg-orange-100 text-orange-700',
};

const ATT_CFG: Record<string, { bg: string; border: string; label: string; dot: string }> = {
  P:  { bg: 'bg-emerald-50', border: 'border-emerald-300', label: 'P',  dot: 'bg-emerald-500' },
  A:  { bg: 'bg-red-50',     border: 'border-red-300',     label: 'A',  dot: 'bg-red-500' },
  L:  { bg: 'bg-yellow-50',  border: 'border-yellow-300',  label: 'L',  dot: 'bg-yellow-400' },
  HD: { bg: 'bg-orange-50',  border: 'border-orange-300',  label: 'HD', dot: 'bg-orange-400' },
};

const LEAVE_REASONS = [
  { value: 'SICK',     label: 'Sickness / Illness' },
  { value: 'FAMILY',   label: 'Family Emergency' },
  { value: 'MEDICAL',  label: 'Medical Appointment' },
  { value: 'PERSONAL', label: 'Personal Reason' },
  { value: 'OTHER',    label: 'Other' },
];

const LEAVE_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:  { label: 'Pending',  cls: 'text-amber-700 bg-amber-100 border-amber-300' },
  APPROVED: { label: 'Approved', cls: 'text-emerald-700 bg-emerald-100 border-emerald-300' },
  REJECTED: { label: 'Rejected', cls: 'text-red-700 bg-red-100 border-red-300' },
};

function studioForGrade(grade: number): 1 | 2 | 3 | 4 {
  if (grade <= 7)  return 1;
  if (grade <= 9)  return 2;
  if (grade <= 11) return 3;
  return 4;
}

function pad2(n: number) { return String(n).padStart(2, '0'); }
function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

type Tab = 'profile' | 'attendance' | 'leave' | 'report' | 'notices';

// ─── StudentPortal ────────────────────────────────────────────────────────────

export function StudentPortal() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<any>(null);
  const [calData, setCalData] = useState<any>(null);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [reportCard, setReportCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date().toISOString().slice(0, 7));

  // Notices state
  const [notices, setNotices] = useState<any[]>([]);

  // My Leave state
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveForm, setLeaveForm] = useState({ startDate: todayStr(), endDate: todayStr(), reason: 'SICK', remarks: '' });
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [leaveError, setLeaveError] = useState('');
  const [leaveSuccess, setLeaveSuccess] = useState('');

  useEffect(() => {
    api.attendance.studentMe().then(d => {
      setProfile(d);
      setLoading(false);
      // Load notices for the student's school once we have the school
      if (d?.student?.schoolId) {
        api.notices({ schoolId: d.student.schoolId })
          .then((n) => setNotices(n))
          .catch(() => null);
      }
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.studentId) return;
    api.attendance.calendar(user.studentId, calMonth).then(setCalData).catch(() => setCalData(null));
    api.planner.holidays(calMonth).then(setHolidays).catch(() => setHolidays([]));
  }, [user?.studentId, calMonth]);

  const loadLeaves = useCallback(() => {
    api.attendance.myLeaves().then(r => setLeaves(r.leaves ?? [])).catch(() => setLeaves([]));
  }, []);

  useEffect(() => {
    if (tab === 'leave') loadLeaves();
  }, [tab, loadLeaves]);

  useEffect(() => {
    if (tab !== 'report' || !user?.studentId) return;
    api.attendance.reportCard(user.studentId, '2025-26').then(setReportCard).catch(() => setReportCard(null));
  }, [tab, user?.studentId]);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading your profile…</div>;
  if (!profile) return <div className="text-center py-16 text-slate-400">No student profile linked. Contact your school admin.</div>;

  const { student, thisMonth } = profile;
  const grade = parseInt(String(student.grade)) || 0;
  const studio = studioForGrade(grade);
  const today = todayStr();
  const upcomingHoliday = holidays.find(h => h.startDate >= today);

  // Schedule lookup: key = "YYYY-MM-DD"
  const scheduleByDate: Record<string, any[]> = {};
  for (const s of SCHEDULE) {
    if (s.studio === studio) {
      if (!scheduleByDate[s.date]) scheduleByDate[s.date] = [];
      scheduleByDate[s.date].push(s);
    }
  }

  const submitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeaveSubmitting(true); setLeaveError(''); setLeaveSuccess('');
    try {
      await api.attendance.applyLeave(leaveForm);
      setLeaveSuccess('Leave request submitted successfully!');
      setLeaveForm({ startDate: todayStr(), endDate: todayStr(), reason: 'SICK', remarks: '' });
      loadLeaves();
    } catch (err: any) { setLeaveError(err.message); }
    finally { setLeaveSubmitting(false); }
  };

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-full';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold flex-shrink-0">
            {student.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold leading-tight">{student.name}</h1>
            <p className="text-sky-200 text-sm mt-0.5">
              Class {student.grade}{student.section ? `-${student.section}` : ''} &nbsp;·&nbsp; {student.school}
            </p>
            <p className="text-sky-300 text-xs mt-1">
              <i className="fas fa-tv mr-1" />Studio {studio} schedule
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-2xl font-bold">
              {thisMonth.total > 0 ? Math.round((thisMonth.present / thisMonth.total) * 100) : '--'}%
            </div>
            <div className="text-sky-200 text-xs">This Month</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: 'Present', val: thisMonth.present, cls: 'text-emerald-300' },
            { label: 'Absent',  val: thisMonth.absent,  cls: 'text-red-300' },
            { label: 'Late',    val: thisMonth.late,    cls: 'text-yellow-300' },
          ].map(item => (
            <div key={item.label} className="bg-white/10 rounded-lg p-3 text-center">
              <div className={`text-xl font-bold ${item.cls}`}>{item.val}</div>
              <div className="text-xs text-sky-200">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {([
          { id: 'profile',    label: 'My Profile',  icon: 'fa-user' },
          { id: 'attendance', label: 'Attendance',  icon: 'fa-calendar-check' },
          { id: 'leave',      label: 'My Leave',    icon: 'fa-calendar-times' },
          { id: 'report',     label: 'Report Card', icon: 'fa-graduation-cap' },
          { id: 'notices',    label: 'Notices',     icon: 'fa-bullhorn', badge: notices.filter(n => n.type === 'Urgent').length },
        ] as { id: Tab; label: string; icon: string; badge?: number }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 relative flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
              tab === t.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <i className={`fas ${t.icon}`} />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            {t.badge ? <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {/* ── Profile ─────────────────────────────────────────────────────────── */}
      {/* Urgent notice banner on profile tab */}
      {tab === 'profile' && notices.filter(n => n.type === 'Urgent').length > 0 && (
        <button onClick={() => setTab('notices')} className="w-full text-left bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-rose-100 transition-colors">
          <i className="fas fa-exclamation-triangle text-rose-500 text-lg animate-pulse" />
          <div>
            <p className="font-bold text-rose-700 text-sm">{notices.filter(n => n.type === 'Urgent').length} Urgent Notice{notices.filter(n => n.type === 'Urgent').length > 1 ? 's' : ''} from your school</p>
            <p className="text-xs text-rose-500">{notices.find(n => n.type === 'Urgent')?.title}</p>
          </div>
          <i className="fas fa-arrow-right text-rose-400 ml-auto" />
        </button>
      )}

      {tab === 'profile' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Personal Details</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Roll No', student.rollNo ?? '—'],
              ['Admission No', student.admissionNo ?? '—'],
              ['Gender', GENDER_LABELS[student.gender] ?? student.gender],
              ['Date of Birth', student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN') : '—'],
              ['Category', student.category],
              ['Religion', student.religion ?? '—'],
              ['Guardian', student.guardianName ?? '—'],
              ['Guardian Phone', student.guardianPhone ?? '—'],
              ['Address', student.address ?? '—'],
              ['RTE Admitted', student.isRte ? 'Yes' : 'No'],
              ['Academic Year', student.academicYear],
              ['School', student.school ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400 text-xs">{label}</dt>
                <dd className="font-medium text-slate-700 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
          {student.category && (
            <div className="mt-4">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${CAT_COLORS[student.category] ?? 'bg-slate-100 text-slate-600'}`}>
                {student.category}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Attendance ───────────────────────────────────────────────────────── */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          {/* Upcoming holiday banner */}
          {upcomingHoliday && calMonth === today.slice(0, 7) && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <span className="text-xl flex-shrink-0">🗓️</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide">Upcoming Holiday</p>
                <p className="font-bold text-amber-800 text-sm">{upcomingHoliday.title}</p>
                <p className="text-xs text-amber-600">{fmtDate(upcomingHoliday.startDate)}
                  {upcomingHoliday.endDate !== upcomingHoliday.startDate && <> – {fmtDate(upcomingHoliday.endDate)}</>}
                  {upcomingHoliday.description && <> · {upcomingHoliday.description}</>}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold text-slate-800">Attendance Calendar</h2>
            <input type="month" value={calMonth} max={new Date().toISOString().slice(0, 7)}
              onChange={e => setCalMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700" />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Present</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Absent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Late</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Half Day</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" /> Holiday</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-sky-400 inline-block" /> Class</span>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className={`text-[10px] text-center font-bold py-1 ${d === 'Sun' ? 'text-red-400' : 'text-slate-400'}`}>{d}</div>
            ))}
            {(() => {
              const [y, m] = calMonth.split('-').map(Number);
              const firstDay = new Date(y, m - 1, 1).getDay();
              const daysInMonth = new Date(y, m, 0).getDate();
              const attMap: Record<string, string> = {};
              for (const r of calData?.records ?? []) attMap[r.date] = r.status;
              const holidayMap: Record<string, any> = {};
              for (const h of holidays) {
                const start = new Date(h.startDate + 'T00:00:00');
                const end   = new Date(h.endDate   + 'T00:00:00');
                for (let dd = new Date(start); dd <= end; dd.setDate(dd.getDate() + 1)) {
                  const key = `${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}-${pad2(dd.getDate())}`;
                  holidayMap[key] = h;
                }
              }

              const cells = [];
              for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);

              for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
                const dow = new Date(dateStr + 'T00:00:00').getDay();
                const isSun = dow === 0;
                const status = attMap[dateStr];
                const holiday = holidayMap[dateStr];
                const sessions = scheduleByDate[dateStr] ?? [];
                const isToday = dateStr === today;

                let bg = 'bg-white', border = 'border-slate-200';
                if (holiday)          { bg = 'bg-amber-50'; border = 'border-amber-300'; }
                else if (isSun)       { bg = 'bg-red-50';   border = 'border-red-200'; }
                else if (status === 'P')  { bg = 'bg-emerald-50'; border = 'border-emerald-200'; }
                else if (status === 'A')  { bg = 'bg-red-50';     border = 'border-red-200'; }
                else if (status === 'L')  { bg = 'bg-yellow-50';  border = 'border-yellow-200'; }
                else if (status === 'HD') { bg = 'bg-orange-50';  border = 'border-orange-200'; }

                cells.push(
                  <div key={d} className={`border rounded-lg p-1 flex flex-col min-h-[72px] ${bg} ${border} ${isToday ? 'ring-2 ring-sky-400' : ''}`}>
                    {/* Day number + status */}
                    <div className="flex items-start justify-between mb-0.5">
                      <span className={`text-[11px] font-bold leading-none ${isSun ? 'text-red-400' : 'text-slate-600'} ${isToday ? 'bg-sky-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px]' : ''}`}>
                        {d}
                      </span>
                      {status && !holiday && (
                        <span className={`text-[8px] font-bold rounded px-0.5 leading-tight ${
                          status === 'P'  ? 'text-emerald-600' :
                          status === 'A'  ? 'text-red-600' :
                          status === 'L'  ? 'text-yellow-600' :
                          status === 'HD' ? 'text-orange-600' : ''
                        }`}>{ATT_CFG[status]?.label}</span>
                      )}
                    </div>

                    {/* Holiday indicator */}
                    {holiday && (
                      <span className="text-[8px] font-bold text-amber-700 leading-tight truncate">
                        {holiday.title}
                      </span>
                    )}
                    {isSun && !holiday && (
                      <span className="text-[8px] text-red-300 leading-tight">Sun</span>
                    )}

                    {/* Lecture schedule dots */}
                    {!holiday && !isSun && sessions.length > 0 && (
                      <div className="flex flex-wrap gap-0.5 mt-auto pt-0.5">
                        {sessions.slice(0, 4).map((s, i) => (
                          <span key={i} className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: SUBJECT_COLOR[s.subject] ?? '#64748b' }}
                            title={`${s.timeSlot}: ${s.subject}`} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return cells;
            })()}
          </div>

          {/* Subject dot legend for this studio */}
          {Object.keys(scheduleByDate).length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1.5 font-semibold uppercase tracking-wide">Studio {studio} Subjects</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SUBJECT_COLOR).map(([name, color]) => (
                  <span key={name} className="flex items-center gap-1 text-xs text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Monthly summary */}
          {calData && (
            <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              {[
                { label: 'Present',  val: calData.summary?.present  ?? 0, cls: 'text-emerald-600' },
                { label: 'Absent',   val: calData.summary?.absent   ?? 0, cls: 'text-red-600' },
                { label: 'Late',     val: calData.summary?.late     ?? 0, cls: 'text-yellow-600' },
                { label: 'Half Day', val: calData.summary?.halfDay  ?? 0, cls: 'text-orange-600' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="text-center">
                  <div className={`text-lg font-bold ${cls}`}>{val}</div>
                  <div className="text-xs text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Holiday list for the month */}
          {holidays.length > 0 && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <i className="fas fa-umbrella-beach mr-1 text-amber-400" />Holidays This Month
              </p>
              {holidays.map(h => (
                <div key={h.id} className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">{h.title}</p>
                    {h.description && <p className="text-xs text-amber-600">{h.description}</p>}
                    <p className="text-xs text-amber-500 mt-0.5">{fmtDate(h.startDate)}
                      {h.endDate !== h.startDate && <> – {fmtDate(h.endDate)}</>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── My Leave ─────────────────────────────────────────────────────────── */}
      {tab === 'leave' && (
        <div className="space-y-4">
          {/* Apply form */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-paper-plane text-sky-400" /> Apply for Leave
            </h2>
            <form onSubmit={submitLeave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">From Date</label>
                  <input type="date" className={inputCls} value={leaveForm.startDate} min={today}
                    onChange={e => setLeaveForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">To Date</label>
                  <input type="date" className={inputCls} value={leaveForm.endDate} min={leaveForm.startDate}
                    onChange={e => setLeaveForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Reason *</label>
                <select className={inputCls} value={leaveForm.reason}
                  onChange={e => setLeaveForm(f => ({ ...f, reason: e.target.value }))}>
                  {LEAVE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Additional Remarks (optional)</label>
                <textarea className={inputCls + ' resize-none'} rows={3}
                  placeholder="Describe your reason in more detail…"
                  value={leaveForm.remarks} onChange={e => setLeaveForm(f => ({ ...f, remarks: e.target.value }))} />
              </div>
              {leaveError   && <p className="text-xs text-red-500 flex items-center gap-1"><i className="fas fa-exclamation-circle" />{leaveError}</p>}
              {leaveSuccess && <p className="text-xs text-emerald-600 flex items-center gap-1"><i className="fas fa-check-circle" />{leaveSuccess}</p>}
              <button type="submit" disabled={leaveSubmitting}
                className="w-full bg-sky-600 text-white py-2.5 rounded-lg font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors">
                {leaveSubmitting ? 'Submitting…' : 'Submit Leave Request'}
              </button>
            </form>
          </div>

          {/* Leave history */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
            <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-history text-slate-400" /> My Leave Requests
            </h2>
            {leaves.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                <i className="fas fa-calendar-check text-2xl block mb-2 text-slate-200" />
                No leave requests yet.
              </p>
            ) : (
              <div className="space-y-3">
                {leaves.map(l => {
                  const st = LEAVE_STATUS[l.status] ?? { label: l.status, cls: 'text-slate-600 bg-slate-100 border-slate-200' };
                  return (
                    <div key={l.id} className="border border-slate-100 rounded-xl p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">
                            {fmtDate(l.startDate)}{l.endDate !== l.startDate && <> – {fmtDate(l.endDate)}</>}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {LEAVE_REASONS.find(r => r.value === l.reason)?.label ?? l.reason}
                          </p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                      </div>
                      {l.remarks && (
                        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                          "{l.remarks}"
                        </p>
                      )}
                      {l.status !== 'PENDING' && (
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <i className={`fas fa-${l.status === 'APPROVED' ? 'check-circle text-emerald-400' : 'times-circle text-red-400'}`} />
                          {l.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {l.approvedByName ?? 'Unknown'}
                          {l.approvedAt && <> · {new Date(l.approvedAt).toLocaleDateString('en-IN')}</>}
                          {l.approverRemarks && <> · "{l.approverRemarks}"</>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Report Card ──────────────────────────────────────────────────────── */}
      {tab === 'report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Report Card — 2025-26</h2>
            {reportCard && (
              <button onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                <i className="fas fa-print text-xs" /> Print
              </button>
            )}
          </div>
          {reportCard ? (
            <>
              <div className="flex items-center gap-4 p-4 bg-sky-50 rounded-xl border border-sky-100">
                <div className="text-center">
                  <div className="text-3xl font-bold text-sky-700">{reportCard.overallPct}%</div>
                  <div className="text-xs text-sky-500 mt-0.5">Overall</div>
                </div>
                <div className="w-px h-12 bg-sky-200" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-700">{reportCard.overallGrade}</div>
                  <div className="text-xs text-indigo-400 mt-0.5">Grade</div>
                </div>
                <div className="ml-auto text-right text-sm text-slate-500">
                  <div>{reportCard.totalMarks} / {reportCard.maxTotal} marks</div>
                  <div className="text-xs">All exams combined</div>
                </div>
              </div>
              {Object.keys(reportCard.bySubject).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left p-3 text-slate-500 font-medium rounded-l-lg">Subject</th>
                        {['FA1', 'FA2', 'SA1', 'SA2', 'ANNUAL'].map(e => (
                          <th key={e} className="text-center p-3 text-slate-500 font-medium">{e}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportCard.bySubject).map(([subject, exams]: [string, any]) => (
                        <tr key={subject} className="border-t border-slate-50">
                          <td className="p-3 font-medium text-slate-700">{subject}</td>
                          {['FA1', 'FA2', 'SA1', 'SA2', 'ANNUAL'].map(e => {
                            const ex = exams[e];
                            return (
                              <td key={e} className="p-3 text-center">
                                {ex ? (
                                  <span className="inline-flex flex-col items-center">
                                    <span className="font-semibold text-slate-800">{ex.marks}/{ex.max}</span>
                                    <span className="text-[10px] text-slate-400">{ex.grade}</span>
                                  </span>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-400 text-sm text-center py-6">No exam results entered yet.</p>
              )}
            </>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">No report card data available.</p>
          )}
        </div>
      )}
      {/* ── Notices ─────────────────────────────────────────────────────────── */}
      {tab === 'notices' && (
        <div className="space-y-3">
          {notices.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-xl border border-slate-100 shadow-sm text-slate-400">
              <i className="fas fa-bullhorn text-3xl mb-2 block text-slate-200" />
              <p className="font-semibold text-slate-500">No notices from your school</p>
            </div>
          ) : notices.map((n) => {
            const typeColor: Record<string, string> = {
              Urgent: 'border-l-rose-500 bg-rose-50',
              Academic: 'border-l-sky-500 bg-sky-50',
              Event: 'border-l-violet-500 bg-violet-50',
              General: 'border-l-slate-400 bg-white',
            };
            const typeIcon: Record<string, string> = {
              Urgent: 'fa-exclamation-triangle text-rose-500',
              Academic: 'fa-graduation-cap text-sky-500',
              Event: 'fa-calendar-star text-violet-500',
              General: 'fa-bullhorn text-slate-400',
            };
            return (
              <div key={n.id} className={`rounded-xl border border-slate-200 border-l-4 p-4 ${typeColor[n.type] ?? 'bg-white border-l-slate-400'}`}>
                <div className="flex items-start gap-3">
                  <i className={`fas ${typeIcon[n.type] ?? 'fa-bullhorn text-slate-400'} mt-0.5`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-800">{n.title}</span>
                      {n.type === 'Urgent' && <span className="text-xs font-bold text-rose-600 animate-pulse">⚠ URGENT</span>}
                    </div>
                    {n.description && <p className="text-sm text-slate-600 mt-1">{n.description}</p>}
                    <p className="text-xs text-slate-400 mt-1.5">
                      <i className="fas fa-calendar mr-1" />
                      {new Date(n.publishDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {n.createdByName && <> · <i className="fas fa-user mr-1" />{n.createdByName}</>}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
