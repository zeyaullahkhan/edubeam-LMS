import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';

const LEAVE_REASONS: Record<string, string> = {
  SICK: 'Sickness / Illness',
  FAMILY: 'Family Emergency',
  MEDICAL: 'Medical Appointment',
  PERSONAL: 'Personal Reason',
  OTHER: 'Other',
};

const LEAVE_STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  PENDING:  { label: 'Pending',  bg: 'bg-amber-100',   text: 'text-amber-700'  },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  REJECTED: { label: 'Rejected', bg: 'bg-red-100',     text: 'text-red-700'    },
};

const GRADES = [6, 7, 8, 9, 10, 11, 12];
const ACADEMIC_YEAR = '2025-26';

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; ring: string }> = {
  P:  { label: 'Present',  bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-400' },
  A:  { label: 'Absent',   bg: 'bg-red-100',     text: 'text-red-700',     ring: 'ring-red-400'     },
  L:  { label: 'Late',     bg: 'bg-amber-100',   text: 'text-amber-700',   ring: 'ring-amber-400'   },
  HD: { label: 'Half Day', bg: 'bg-purple-100',  text: 'text-purple-700',  ring: 'ring-purple-400'  },
};

const STAFF_STATUS: Record<string, { label: string; bg: string; text: string }> = {
  P:  { label: 'Present', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  A:  { label: 'Absent',  bg: 'bg-red-100',     text: 'text-red-700'     },
  L:  { label: 'Late',    bg: 'bg-amber-100',   text: 'text-amber-700'   },
  OD: { label: 'On Duty', bg: 'bg-blue-100',    text: 'text-blue-700'    },
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function monthStr(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

// ── Summary chips ─────────────────────────────────────────────────────────────
function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg ${color}`}>
      <span className="text-lg font-semibold">{value}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

// ── TAB: Mark Student Attendance ─────────────────────────────────────────────
function MarkStudents({ schoolId }: { schoolId: string }) {
  const [date, setDate] = useState(todayStr());
  const [grade, setGrade] = useState<number>(6);
  const [data, setData] = useState<any>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await api.attendance.byDate(schoolId, date, grade);
      setData(res);
      const init: Record<string, string> = {};
      for (const s of res.students) if (s.status) init[s.id] = s.status;
      setStatuses(init);
    } finally {
      setLoading(false);
    }
  }, [schoolId, date, grade]);

  useEffect(() => { load(); }, [load]);

  const markAll = (status: string) => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const s of data.students) next[s.id] = status;
    setStatuses(next);
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const records = Object.entries(statuses).map(([studentId, status]) => ({ studentId, status }));
      await api.attendance.markStudents({ schoolId, date, academicYear: ACADEMIC_YEAR, records });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Class</label>
          <select value={grade} onChange={e => setGrade(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div className="flex gap-2 ml-auto">
          {Object.entries(STATUS_CONFIG).map(([s, c]) => (
            <button key={s} onClick={() => markAll(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${c.bg} ${c.text} hover:opacity-80`}>
              All {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      {data && (
        <div className="flex gap-3 flex-wrap">
          <SummaryChip label="Total" value={data.summary.total} color="bg-slate-100 text-slate-700" />
          <SummaryChip label="Present" value={data.summary.present} color="bg-emerald-50 text-emerald-700" />
          <SummaryChip label="Absent" value={data.summary.absent} color="bg-red-50 text-red-700" />
          <SummaryChip label="Late" value={data.summary.late} color="bg-amber-50 text-amber-700" />
          <SummaryChip label="Half Day" value={data.summary.halfDay} color="bg-purple-50 text-purple-700" />
          <SummaryChip label="Not Marked" value={data.summary.notMarked} color="bg-gray-100 text-gray-500" />
        </div>
      )}

      {/* Student grid */}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading students…</div>
      ) : !data?.students?.length ? (
        <div className="text-center py-10 text-slate-400">No students found for Class {grade}.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Roll</th>
                <th className="px-4 py-3 text-left">Section</th>
                <th className="px-4 py-3 text-left">Gender</th>
                <th className="px-4 py-3 text-center">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.students.map((s: any, i: number) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.rollNo || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.section || '—'}</td>
                  <td className="px-4 py-3 text-slate-500">{s.gender === 'M' ? 'Boy' : 'Girl'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      {Object.entries(STATUS_CONFIG).map(([code, cfg]) => (
                        <button key={code}
                          onClick={() => setStatuses(p => ({ ...p, [s.id]: code }))}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                            statuses[s.id] === code
                              ? `${cfg.bg} ${cfg.text} ring-2 ${cfg.ring} scale-105`
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}>
                          {code}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {saved && <span className="text-emerald-600 text-sm self-center">✓ Saved successfully</span>}
        <button onClick={save} disabled={saving || !Object.keys(statuses).length}
          className="bg-sky-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Attendance'}
        </button>
      </div>
    </div>
  );
}

// ── TAB: Mark Staff Attendance ────────────────────────────────────────────────
function MarkStaff({ schoolId }: { schoolId: string }) {
  const [date, setDate] = useState(todayStr());
  const [data, setData] = useState<any>(null);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await api.attendance.staffByDate(schoolId, date);
      setData(res);
      const init: Record<string, string> = {};
      for (const s of res.staff) if (s.status) init[s.id] = s.status;
      setStatuses(init);
    } finally {
      setLoading(false);
    }
  }, [schoolId, date]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const records = Object.entries(statuses).map(([staffId, status]) => ({ staffId, status }));
      await api.attendance.markStaff({ schoolId, date, academicYear: ACADEMIC_YEAR, records });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Date</label>
          <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
      </div>

      {data && (
        <div className="flex gap-3 flex-wrap">
          <SummaryChip label="Total" value={data.summary.total} color="bg-slate-100 text-slate-700" />
          <SummaryChip label="Present" value={data.summary.present} color="bg-emerald-50 text-emerald-700" />
          <SummaryChip label="Absent" value={data.summary.absent} color="bg-red-50 text-red-700" />
          <SummaryChip label="On Duty" value={data.summary.onDuty} color="bg-blue-50 text-blue-700" />
          <SummaryChip label="Not Marked" value={data.summary.notMarked} color="bg-gray-100 text-gray-500" />
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading staff…</div>
      ) : !data?.staff?.length ? (
        <div className="text-center py-10 text-slate-400">No staff found for this school.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Designation</th>
                <th className="px-4 py-3 text-center">Attendance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.staff.map((s: any, i: number) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.staffType}</td>
                  <td className="px-4 py-3 text-slate-500">{s.designation || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-1">
                      {Object.entries(STAFF_STATUS).map(([code, cfg]) => (
                        <button key={code}
                          onClick={() => setStatuses(p => ({ ...p, [s.id]: code }))}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                            statuses[s.id] === code
                              ? `${cfg.bg} ${cfg.text} ring-2 ring-slate-300 scale-105`
                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                          }`}>
                          {code}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {saved && <span className="text-emerald-600 text-sm self-center">✓ Saved</span>}
        <button onClick={save} disabled={saving || !Object.keys(statuses).length}
          className="bg-sky-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Staff Attendance'}
        </button>
      </div>
    </div>
  );
}

// ── TAB: Monthly Report ───────────────────────────────────────────────────────
function MonthlyReport({ schoolId }: { schoolId: string }) {
  const [month, setMonth] = useState(monthStr());
  const [grade, setGrade] = useState<number>(6);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      setData(await api.attendance.monthly(schoolId, month, grade));
    } finally {
      setLoading(false);
    }
  }, [schoolId, month, grade]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = () => {
    if (!data?.students?.length) return;
    const header = 'Name,Roll,Section,Present,Absent,Late,Half-Day,Attendance%';
    const rows = data.students.map((s: any) =>
      `"${s.name}",${s.rollNo || ''},${s.section || ''},${s.present},${s.absent},${s.late},${s.halfDay},${s.pct}%`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `attendance_${month}_class${grade}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Class</label>
          <select value={grade} onChange={e => setGrade(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <button onClick={exportCsv} className="ml-auto text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg">
          Export CSV
        </button>
      </div>

      {data && (
        <div className="text-sm text-slate-500">
          Working days recorded: <strong className="text-slate-700">{data.workingDays}</strong>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : !data?.students?.length ? (
        <div className="text-center py-10 text-slate-400">No attendance data for this month.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Roll</th>
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Absent</th>
                <th className="px-4 py-3 text-center">Late</th>
                <th className="px-4 py-3 text-center">Half Day</th>
                <th className="px-4 py-3 text-center">Attendance %</th>
                <th className="px-4 py-3 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.students.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500">{s.rollNo || '—'}</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-medium">{s.present}</td>
                  <td className="px-4 py-3 text-center text-red-500">{s.absent}</td>
                  <td className="px-4 py-3 text-center text-amber-600">{s.late}</td>
                  <td className="px-4 py-3 text-center text-purple-600">{s.halfDay}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                      s.pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{s.pct}%</span>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-600">{s.grade_letter}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── TAB: Date-wise School Report ──────────────────────────────────────────────
function DateReport({ schoolId }: { schoolId: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(todayStr());
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId || !from || !to) return;
    setLoading(true);
    try {
      setData(await api.attendance.report(schoolId, from, to));
    } finally {
      setLoading(false);
    }
  }, [schoolId, from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs text-slate-500 mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">To</label>
          <input type="date" value={to} max={todayStr()} onChange={e => setTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : !data.length ? (
        <div className="text-center py-10 text-slate-400">No attendance data for selected range.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-center">Total Marked</th>
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Absent</th>
                <th className="px-4 py-3 text-center">Late</th>
                <th className="px-4 py-3 text-center">Half Day</th>
                <th className="px-4 py-3 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((r: any) => {
                const pct = r.total ? Math.round(r.present / r.total * 100) : 0;
                return (
                  <tr key={r.date} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium text-slate-700">{r.date}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{r.total}</td>
                    <td className="px-4 py-3 text-center text-emerald-600 font-medium">{r.present}</td>
                    <td className="px-4 py-3 text-center text-red-500">{r.absent}</td>
                    <td className="px-4 py-3 text-center text-amber-600">{r.late}</td>
                    <td className="px-4 py-3 text-center text-purple-600">{r.halfDay}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                          <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-600">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── TAB: Staff Monthly Report ─────────────────────────────────────────────────
function StaffMonthlyReport({ schoolId }: { schoolId: string }) {
  const [month, setMonth] = useState(monthStr());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try { setData(await api.attendance.staffMonthly(schoolId, month)); }
    finally { setLoading(false); }
  }, [schoolId, month]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white" />
        </div>
      </div>
      {data && <div className="text-sm text-slate-500">Working days: <strong>{data.workingDays}</strong></div>}
      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : !data?.staff?.length ? (
        <div className="text-center py-10 text-slate-400">No staff attendance data.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-center">Present</th>
                <th className="px-4 py-3 text-center">Absent</th>
                <th className="px-4 py-3 text-center">Late</th>
                <th className="px-4 py-3 text-center">On Duty</th>
                <th className="px-4 py-3 text-center">Attendance %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.staff.map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.staffType}</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-medium">{s.present}</td>
                  <td className="px-4 py-3 text-center text-red-500">{s.absent}</td>
                  <td className="px-4 py-3 text-center text-amber-600">{s.late}</td>
                  <td className="px-4 py-3 text-center text-blue-600">{s.onDuty}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                      s.pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{s.pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Holidays are managed in Planner → Holiday Calendar tab.

// ── TAB: Leave Requests (teacher / principal view) ────────────────────────────
function LeaveRequestsTab({ schoolId }: { schoolId: string }) {
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [remarkInputs, setRemarkInputs] = useState<Record<string, string>>({});
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await api.attendance.schoolLeaves(schoolId, statusFilter || undefined);
      setLeaves(res.leaves);
    } finally { setLoading(false); }
  }, [schoolId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handle = async (id: string, action: 'approve' | 'reject') => {
    setActionId(id);
    try {
      const remark = remarkInputs[id];
      if (action === 'approve') await api.attendance.approveLeave(id, remark);
      else await api.attendance.rejectLeave(id, remark);
      setRemarkInputs(r => { const n = { ...r }; delete n[id]; return n; });
      load();
    } finally { setActionId(null); }
  };

  const statusBadge = (status: string) => {
    const cfg = LEAVE_STATUS_CFG[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === s ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            {s === '' ? 'All' : LEAVE_STATUS_CFG[s]?.label ?? s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : !leaves.length ? (
        <div className="text-center py-10 text-slate-400">No leave requests found.</div>
      ) : (
        <div className="space-y-3">
          {leaves.map(l => (
            <div key={l.id} className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{l.studentName ?? 'Student'}</span>
                    {statusBadge(l.status)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 space-x-3">
                    <span><i className="fas fa-calendar mr-1 text-sky-400" />{l.startDate}{l.endDate !== l.startDate ? ` → ${l.endDate}` : ''}</span>
                    <span><i className="fas fa-tag mr-1 text-slate-300" />{LEAVE_REASONS[l.reason] ?? l.reason}</span>
                  </div>
                  {l.remarks && (
                    <p className="text-xs text-slate-600 mt-1.5 bg-slate-50 rounded-lg px-3 py-2 italic">"{l.remarks}"</p>
                  )}
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap flex-shrink-0">
                  {new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              {l.status === 'PENDING' && (
                <div className="flex flex-col gap-2">
                  <input placeholder="Approver remarks (optional)…"
                    value={remarkInputs[l.id] ?? ''}
                    onChange={e => setRemarkInputs(r => ({ ...r, [l.id]: e.target.value }))}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-xs w-full bg-white" />
                  <div className="flex gap-2">
                    <button disabled={actionId === l.id} onClick={() => handle(l.id, 'approve')}
                      className="flex-1 bg-emerald-600 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50">
                      <i className="fas fa-check mr-1" />Approve
                    </button>
                    <button disabled={actionId === l.id} onClick={() => handle(l.id, 'reject')}
                      className="flex-1 bg-red-500 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-red-600 disabled:opacity-50">
                      <i className="fas fa-times mr-1" />Reject
                    </button>
                  </div>
                </div>
              )}

              {l.status !== 'PENDING' && l.approvedByName && (
                <div className="text-xs text-slate-400 border-t border-slate-50 pt-2">
                  <span className={l.status === 'APPROVED' ? 'text-emerald-600' : 'text-red-500'}>
                    <i className={`fas ${l.status === 'APPROVED' ? 'fa-check-circle' : 'fa-times-circle'} mr-1`} />
                    {l.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {l.approvedByName}
                  </span>
                  {l.approvedAt && <span> · {new Date(l.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                  {l.approverRemarks && <span className="italic"> · "{l.approverRemarks}"</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TAB: My Leave (student view) ──────────────────────────────────────────────
function MyLeaveTab() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ startDate: todayStr(), endDate: todayStr(), reason: 'SICK', remarks: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.attendance.myLeaves(); setLeaves(res.leaves); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true); setError('');
    try {
      await api.attendance.applyLeave({ ...form, remarks: form.remarks || undefined });
      setForm({ startDate: todayStr(), endDate: todayStr(), reason: 'SICK', remarks: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-full';

  const statusBadge = (status: string) => {
    const cfg = LEAVE_STATUS_CFG[status] ?? { label: status, bg: 'bg-slate-100', text: 'text-slate-600' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">Apply for leave and track your requests</p>
        <button onClick={() => setShowForm(f => !f)}
          className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-700">
          <i className="fas fa-plus mr-1.5" />{showForm ? 'Cancel' : 'Apply for Leave'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-700">New Leave Application</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From Date</label>
              <input type="date" className={inputCls} value={form.startDate} min={todayStr()}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To Date</label>
              <input type="date" className={inputCls} value={form.endDate} min={form.startDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Reason *</label>
              <select className={inputCls} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                {Object.entries(LEAVE_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-500 mb-1">Additional Remarks</label>
              <textarea rows={3} className={inputCls} placeholder="Provide more details about your leave..."
                value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="bg-sky-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : !leaves.length ? (
        <div className="text-center py-10 text-slate-400">No leave requests yet. Click "Apply for Leave" to submit one.</div>
      ) : (
        <div className="space-y-3">
          {leaves.map(l => (
            <div key={l.id} className="bg-white border border-slate-100 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-700">{LEAVE_REASONS[l.reason] ?? l.reason}</span>
                    {statusBadge(l.status)}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    <i className="fas fa-calendar mr-1" />{l.startDate}{l.endDate !== l.startDate ? ` → ${l.endDate}` : ''}
                  </p>
                  {l.remarks && <p className="text-xs text-slate-600 mt-1.5 italic">"{l.remarks}"</p>}
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">
                  {new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
              {l.status !== 'PENDING' && l.approvedByName && (
                <div className="text-xs mt-2 pt-2 border-t border-slate-50">
                  <span className={l.status === 'APPROVED' ? 'text-emerald-600' : 'text-red-500'}>
                    <i className={`fas ${l.status === 'APPROVED' ? 'fa-check-circle' : 'fa-times-circle'} mr-1`} />
                    {l.status === 'APPROVED' ? 'Approved' : 'Rejected'} by {l.approvedByName}
                    {l.approvedAt && <> on {new Date(l.approvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>}
                  </span>
                  {l.approverRemarks && <p className="text-slate-500 italic mt-0.5">"{l.approverRemarks}"</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'mark-students',  label: 'Mark Student Attendance', icon: 'fas fa-user-check' },
  { id: 'mark-staff',     label: 'Mark Staff Attendance',   icon: 'fas fa-chalkboard-teacher' },
  { id: 'monthly',        label: 'Monthly Report',          icon: 'fas fa-calendar-alt' },
  { id: 'date-report',    label: 'Date-wise Report',        icon: 'fas fa-table' },
  { id: 'staff-monthly',  label: 'Staff Monthly Report',    icon: 'fas fa-users' },
  { id: 'leave-requests', label: 'Leave Requests',          icon: 'fas fa-clipboard-list' },
  { id: 'my-leave',       label: 'My Leave',                icon: 'fas fa-calendar-check' },
];

const STUDENT_TAB_IDS = ['mark-students', 'monthly', 'date-report', 'leave-requests'];
const STAFF_TAB_IDS = ['mark-staff', 'staff-monthly'];

export function Attendance({ mode = 'all' }: { mode?: 'student' | 'staff' | 'all' }) {
  const { user } = useAuth();

  const isStudent = user?.role === 'STUDENT';

  const visibleTabs = TABS.filter(t => {
    if (isStudent) return t.id === 'my-leave';
    if (t.id === 'my-leave') return false; // hidden for non-students
    if (mode === 'student') return STUDENT_TAB_IDS.includes(t.id);
    if (mode === 'staff') return STAFF_TAB_IDS.includes(t.id);
    return true;
  });

  const [tab, setTab] = useState(visibleTabs[0]?.id ?? 'mark-students');
  const [scope, setScope] = useState<Scope>({});

  const schoolId = user?.schoolId ?? scope.schoolId ?? '';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase mb-1">ATTENDANCE</p>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Management</h1>
          <p className="text-sm text-slate-500 mt-1">Mark and track student and staff attendance</p>
        </div>
      </div>

      {/* School scope picker for state/district admins */}
      {!user?.schoolId && (
        <ScopeBar value={scope} onChange={setScope} />
      )}

      {!schoolId && !isStudent ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">
          Please select a school to mark or view attendance.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          {/* Tabs */}
          <div className="border-b border-slate-100 px-4 overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {visibleTabs.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    tab === t.id
                      ? 'border-sky-500 text-sky-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  <i className={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {tab === 'mark-students'  && <MarkStudents schoolId={schoolId} />}
            {tab === 'mark-staff'     && <MarkStaff    schoolId={schoolId} />}
            {tab === 'monthly'        && <MonthlyReport schoolId={schoolId} />}
            {tab === 'date-report'    && <DateReport   schoolId={schoolId} />}
            {tab === 'staff-monthly'  && <StaffMonthlyReport schoolId={schoolId} />}
            {tab === 'leave-requests' && <LeaveRequestsTab schoolId={schoolId} />}
            {tab === 'my-leave'       && <MyLeaveTab />}
          </div>
        </div>
      )}
    </div>
  );
}
