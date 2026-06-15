import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const GENDER_LABELS: Record<string, string> = { M: 'Male', F: 'Female', O: 'Other' };
const CAT_COLORS: Record<string, string> = { GEN: 'bg-blue-100 text-blue-700', OBC: 'bg-green-100 text-green-700', SC: 'bg-purple-100 text-purple-700', ST: 'bg-orange-100 text-orange-700' };

function AttendancePill({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    P: 'bg-emerald-500',
    A: 'bg-red-500',
    L: 'bg-yellow-400',
    HD: 'bg-orange-400',
  };
  const label: Record<string, string> = { P: 'P', A: 'A', L: 'L', HD: 'HD' };
  return <span className={`inline-block w-7 h-7 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${cfg[status] ?? 'bg-slate-300 text-slate-600'}`}>{label[status] ?? '?'}</span>;
}

type Tab = 'profile' | 'attendance' | 'report';

export function StudentPortal() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [profile, setProfile] = useState<any>(null);
  const [calData, setCalData] = useState<any>(null);
  const [reportCard, setReportCard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    api.attendance.studentMe().then(d => { setProfile(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.studentId) return;
    api.attendance.calendar(user.studentId, calMonth).then(setCalData).catch(() => setCalData(null));
  }, [user?.studentId, calMonth]);

  useEffect(() => {
    if (tab !== 'report' || !user?.studentId) return;
    api.attendance.reportCard(user.studentId, '2025-26').then(setReportCard).catch(() => setReportCard(null));
  }, [tab, user?.studentId]);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading your profile…</div>;
  if (!profile) return <div className="text-center py-16 text-slate-400">No student profile linked. Contact your school admin.</div>;

  const { student, thisMonth, examResults } = profile;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header card */}
      <div className="bg-gradient-to-br from-sky-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold">
            {student.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{student.name}</h1>
            <p className="text-sky-200 text-sm">Class {student.grade}{student.section ? `-${student.section}` : ''} · {student.school}</p>
            <p className="text-sky-200 text-xs mt-0.5">{student.school}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-2xl font-bold">{thisMonth.total > 0 ? Math.round((thisMonth.present / thisMonth.total) * 100) : '--'}%</div>
            <div className="text-sky-200 text-xs">This Month Attendance</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-emerald-300">{thisMonth.present}</div>
            <div className="text-xs text-sky-200">Present</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-red-300">{thisMonth.absent}</div>
            <div className="text-xs text-sky-200">Absent</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-yellow-300">{thisMonth.late}</div>
            <div className="text-xs text-sky-200">Late</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {(['profile', 'attendance', 'report'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'profile' ? 'My Profile' : t === 'attendance' ? 'Attendance' : 'Report Card'}
          </button>
        ))}
      </div>

      {/* Profile tab */}
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
              ['School', student.school?.name ?? student.school ?? '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
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

      {/* Attendance tab */}
      {tab === 'attendance' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Attendance Calendar</h2>
            <input
              type="month"
              value={calMonth}
              max={new Date().toISOString().slice(0, 7)}
              onChange={e => setCalMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700"
            />
          </div>

          {calData ? (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Present</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Absent</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Late</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Half Day</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-200 inline-block" /> No Record</span>
              </div>
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-[10px] text-center text-slate-400 font-medium">{d}</div>
                ))}
                {(() => {
                  const [y, m] = calMonth.split('-').map(Number);
                  const firstDay = new Date(y, m - 1, 1).getDay();
                  const daysInMonth = new Date(y, m, 0).getDate();
                  const attMap: Record<string, string> = {};
                  for (const r of calData.records ?? []) attMap[r.date] = r.status;
                  const cells = [];
                  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />);
                  for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const status = attMap[dateStr];
                    const bgColor = status === 'P' ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : status === 'A' ? 'bg-red-100 border-red-300 text-red-700'
                      : status === 'L' ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                      : status === 'HD' ? 'bg-orange-100 border-orange-300 text-orange-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400';
                    cells.push(
                      <div key={d} className={`border rounded-lg p-1 text-center text-xs font-medium ${bgColor}`}>
                        <div className="text-[11px]">{d}</div>
                        {status && <div className="text-[9px] leading-tight">{status}</div>}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
              <div className="grid grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                {[
                  { label: 'Present', val: calData.summary?.present ?? 0, color: 'text-emerald-600' },
                  { label: 'Absent', val: calData.summary?.absent ?? 0, color: 'text-red-600' },
                  { label: 'Late', val: calData.summary?.late ?? 0, color: 'text-yellow-600' },
                  { label: 'Half Day', val: calData.summary?.halfDay ?? 0, color: 'text-orange-600' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="text-center">
                    <div className={`text-lg font-bold ${color}`}>{val}</div>
                    <div className="text-xs text-slate-400">{label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">No attendance data for this month.</p>
          )}
        </div>
      )}

      {/* Report card tab */}
      {tab === 'report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Report Card — 2025-26</h2>
            {reportCard && (
              <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
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
    </div>
  );
}
