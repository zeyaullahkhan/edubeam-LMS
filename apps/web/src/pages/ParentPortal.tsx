import { useEffect, useState } from 'react';
import { api } from '../api';

const GRADE_LABEL = (g: number) => `Class ${g}`;
const CAT_COLORS: Record<string, string> = {
  GEN: 'bg-blue-100 text-blue-700',
  OBC: 'bg-green-100 text-green-700',
  SC: 'bg-purple-100 text-purple-700',
  ST: 'bg-orange-100 text-orange-700',
};

type ChildView = 'overview' | 'attendance' | 'report';

function ChildCard({ child, onSelect }: { child: any; onSelect: () => void }) {
  const total = child.thisMonth.total;
  const pct = total > 0 ? Math.round((child.thisMonth.present / total) * 100) : null;

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-xl border border-slate-200 p-5 hover:border-sky-300 hover:shadow-md cursor-pointer transition-all group"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shrink-0">
          {child.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 group-hover:text-sky-700 transition-colors truncate">{child.name}</h3>
          <p className="text-sm text-slate-500">{GRADE_LABEL(child.grade)}{child.section ? `-${child.section}` : ''} · Roll {child.rollNo ?? '—'}</p>
          <p className="text-xs text-slate-400 truncate">{child.school}</p>
        </div>
        <div className="text-right shrink-0">
          <div className={`text-xl font-bold ${pct == null ? 'text-slate-300' : pct >= 75 ? 'text-emerald-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
            {pct != null ? `${pct}%` : '—'}
          </div>
          <div className="text-[10px] text-slate-400">This Month</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          { label: 'Present', val: child.thisMonth.present, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Absent', val: child.thisMonth.absent, color: 'text-red-600 bg-red-50' },
          { label: 'Late', val: child.thisMonth.late, color: 'text-yellow-600 bg-yellow-50' },
        ].map(({ label, val, color }) => (
          <div key={label} className={`rounded-lg p-2 text-center ${color}`}>
            <div className="text-base font-bold">{val}</div>
            <div className="text-[10px] font-medium">{label}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center text-xs text-sky-600 font-medium group-hover:text-sky-700">
        <span>View details</span>
        <i className="fas fa-chevron-right ml-1 text-[10px]" />
      </div>
    </div>
  );
}

function ChildDetail({ child, onBack }: { child: any; onBack: () => void }) {
  const [view, setView] = useState<ChildView>('attendance');
  const [calData, setCalData] = useState<any>(null);
  const [reportCard, setReportCard] = useState<any>(null);
  const [calMonth, setCalMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    api.attendance.calendar(child.id, calMonth).then(setCalData).catch(() => setCalData(null));
  }, [child.id, calMonth]);

  useEffect(() => {
    if (view !== 'report') return;
    api.attendance.reportCard(child.id, '2025-26').then(setReportCard).catch(() => setReportCard(null));
  }, [view, child.id]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <i className="fas fa-arrow-left" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-white font-bold">
            {child.name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-slate-800">{child.name}</h2>
            <p className="text-xs text-slate-500">{GRADE_LABEL(child.grade)}{child.section ? `-${child.section}` : ''} · {child.school}</p>
          </div>
          {child.category && (
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${CAT_COLORS[child.category] ?? 'bg-slate-100 text-slate-600'}`}>
              {child.category}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {(['attendance', 'report'] as ChildView[]).map(t => (
          <button
            key={t}
            onClick={() => setView(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${view === t ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'attendance' ? 'Attendance' : 'Report Card'}
          </button>
        ))}
      </div>

      {/* Attendance view */}
      {view === 'attendance' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-700">Monthly Attendance</h3>
            <input
              type="month"
              value={calMonth}
              max={new Date().toISOString().slice(0, 7)}
              onChange={e => setCalMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          {calData ? (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                {[['bg-emerald-500', 'Present'], ['bg-red-500', 'Absent'], ['bg-yellow-400', 'Late'], ['bg-orange-400', 'Half Day']].map(([c, l]) => (
                  <span key={l} className="flex items-center gap-1"><span className={`w-3 h-3 rounded-full inline-block ${c}`} /> {l}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
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
                    const bg = status === 'P' ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : status === 'A' ? 'bg-red-100 border-red-300 text-red-700'
                      : status === 'L' ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                      : status === 'HD' ? 'bg-orange-100 border-orange-300 text-orange-700'
                      : 'bg-slate-50 border-slate-200 text-slate-400';
                    cells.push(
                      <div key={d} className={`border rounded-lg p-1 text-center text-xs font-medium ${bg}`}>
                        <div className="text-[11px]">{d}</div>
                        {status && <div className="text-[9px]">{status}</div>}
                      </div>
                    );
                  }
                  return cells;
                })()}
              </div>
              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100">
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

      {/* Report Card view */}
      {view === 'report' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 space-y-4">
          <h3 className="font-semibold text-slate-700">Report Card — 2025-26</h3>
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
                </div>
              </div>
              {Object.keys(reportCard.bySubject).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left p-3 text-slate-500 font-medium">Subject</th>
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
                                {ex ? <span className="font-semibold">{ex.marks}/{ex.max}</span> : <span className="text-slate-300">—</span>}
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

export function ParentPortal() {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    api.attendance.children()
      .then(d => { setChildren(d.children ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading your children's profiles…</div>;

  if (selected) return <ChildDetail child={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">My Children</h1>
        <p className="text-slate-500 text-sm mt-1">Track attendance and academic progress</p>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="fas fa-users text-4xl mb-3 opacity-30" />
          <p>No children linked to your account.</p>
          <p className="text-sm mt-1">Contact your school admin to link your children.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {children.map(child => (
            <ChildCard key={child.id} child={child} onSelect={() => setSelected(child)} />
          ))}
        </div>
      )}
    </div>
  );
}
