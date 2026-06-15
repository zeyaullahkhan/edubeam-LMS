import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';

const GRADES = [6, 7, 8, 9, 10, 11, 12];
const EXAM_TYPES = ['FA1', 'FA2', 'SA1', 'SA2', 'ANNUAL', 'BOARD'];
const ACADEMIC_YEAR = '2025-26';

const SUBJECTS_BY_GRADE: Record<number, string[]> = {
  6:  ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Sanskrit'],
  7:  ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Sanskrit'],
  8:  ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Sanskrit'],
  9:  ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science'],
  10: ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science'],
  11: ['Hindi', 'English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'History', 'Geography', 'Economics', 'Political Science'],
  12: ['Hindi', 'English', 'Physics', 'Chemistry', 'Mathematics', 'Biology', 'History', 'Geography', 'Economics', 'Political Science'],
};

function gradeBadge(letter: string) {
  const colors: Record<string, string> = {
    'A+': 'bg-emerald-100 text-emerald-700',
    'A':  'bg-emerald-50 text-emerald-600',
    'B+': 'bg-sky-100 text-sky-700',
    'B':  'bg-sky-50 text-sky-600',
    'C':  'bg-amber-100 text-amber-700',
    'F':  'bg-red-100 text-red-700',
  };
  return colors[letter] ?? 'bg-slate-100 text-slate-600';
}

// ── TAB: Enter marks ──────────────────────────────────────────────────────────
function EnterMarks({ schoolId }: { schoolId: string }) {
  const [grade, setGrade] = useState(6);
  const [examType, setExamType] = useState('SA1');
  const [students, setStudents] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, string>>>({});
  const [maxMarks, setMaxMarks] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const subjects = SUBJECTS_BY_GRADE[grade] ?? SUBJECTS_BY_GRADE[6];

  const loadStudents = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const res = await api.students.list({ schoolId, grade });
      setStudents(res);
    } finally {
      setLoading(false);
    }
  }, [schoolId, grade]);

  useEffect(() => { loadStudents(); }, [loadStudents]);

  const setMark = (studentId: string, subject: string, val: string) => {
    setMarks(p => ({ ...p, [studentId]: { ...(p[studentId] ?? {}), [subject]: val } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const results: any[] = [];
      for (const s of students) {
        for (const subject of subjects) {
          const val = marks[s.id]?.[subject];
          if (val === undefined || val === '') continue;
          results.push({
            studentId: s.id,
            subject,
            marksObtained: Number(val),
            maxMarks: maxMarks[subject] ?? 100,
          });
        }
      }
      if (!results.length) return;
      await api.attendance.saveResults({ schoolId, grade, examType, academicYear: ACADEMIC_YEAR, results });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Class</label>
          <select value={grade} onChange={e => setGrade(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Exam</label>
          <select value={examType} onChange={e => setExamType(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {/* Max marks per subject */}
      <div>
        <p className="text-xs text-slate-500 mb-2">Max marks per subject (default 100):</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map(sub => (
            <div key={sub} className="flex items-center gap-1 bg-slate-50 rounded-lg px-2 py-1">
              <span className="text-xs text-slate-600 w-24 truncate">{sub}</span>
              <input type="number" min={0} max={200}
                value={maxMarks[sub] ?? 100}
                onChange={e => setMaxMarks(p => ({ ...p, [sub]: Number(e.target.value) }))}
                className="w-14 border border-slate-200 rounded px-1.5 py-0.5 text-xs text-center bg-white" />
            </div>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading students…</div>
      ) : !students.length ? (
        <div className="text-center py-10 text-slate-400">No students found for Class {grade}.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="text-sm" style={{ minWidth: `${200 + subjects.length * 90}px` }}>
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left sticky left-0 bg-slate-50 z-10">Name</th>
                <th className="px-3 py-3">Roll</th>
                {subjects.map(s => (
                  <th key={s} className="px-3 py-3 text-center">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {students.map((st: any) => (
                <tr key={st.id} className="hover:bg-slate-50/50">
                  <td className="px-4 py-2 font-medium text-slate-800 sticky left-0 bg-white">{st.name}</td>
                  <td className="px-3 py-2 text-center text-slate-500 text-xs">{st.rollNo || '—'}</td>
                  {subjects.map(sub => (
                    <td key={sub} className="px-2 py-2 text-center">
                      <input
                        type="number" min={0} max={maxMarks[sub] ?? 100}
                        value={marks[st.id]?.[sub] ?? ''}
                        onChange={e => setMark(st.id, sub, e.target.value)}
                        placeholder="—"
                        className="w-16 border border-slate-200 rounded px-2 py-1 text-xs text-center bg-white focus:border-sky-300 focus:ring-1 focus:ring-sky-200 outline-none" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {saved && <span className="text-emerald-600 text-sm self-center">✓ Marks saved</span>}
        <button onClick={save} disabled={saving}
          className="bg-sky-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Marks'}
        </button>
      </div>
    </div>
  );
}

// ── TAB: View Class Results ───────────────────────────────────────────────────
function ClassResults({ schoolId }: { schoolId: string }) {
  const [grade, setGrade] = useState(10);
  const [examType, setExamType] = useState('SA1');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      setData(await api.attendance.classResults(schoolId, grade, examType, ACADEMIC_YEAR));
    } finally {
      setLoading(false);
    }
  }, [schoolId, grade, examType]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Class</label>
          <select value={grade} onChange={e => setGrade(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Exam</label>
          <select value={examType} onChange={e => setExamType(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {EXAM_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-slate-400">Loading…</div>
      ) : !data?.students?.length ? (
        <div className="text-center py-10 text-slate-400">No results entered yet for Class {grade} — {examType}.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="text-sm w-full" style={{ minWidth: `${300 + (data.subjects?.length ?? 0) * 80}px` }}>
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-3 py-3 text-center">Roll</th>
                {(data.subjects ?? []).map((s: string) => <th key={s} className="px-3 py-3 text-center">{s}</th>)}
                <th className="px-4 py-3 text-center">Total</th>
                <th className="px-4 py-3 text-center">%</th>
                <th className="px-4 py-3 text-center">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.students.map((s: any, i: number) => (
                <tr key={s.id} className={`hover:bg-slate-50/50 ${i < 3 ? 'bg-amber-50/30' : ''}`}>
                  <td className="px-4 py-2 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-slate-400">{i + 1}</span>}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{s.name}</td>
                  <td className="px-3 py-2 text-center text-slate-500 text-xs">{s.rollNo || '—'}</td>
                  {(data.subjects ?? []).map((sub: string) => (
                    <td key={sub} className="px-3 py-2 text-center text-slate-600">{s.subjects[sub] ?? '—'}</td>
                  ))}
                  <td className="px-4 py-2 text-center font-semibold text-slate-700">{s.total}/{s.max}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                      s.pct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                      s.pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    }`}>{s.pct}%</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${gradeBadge(s.grade_letter)}`}>
                      {s.grade_letter}
                    </span>
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

// ── TAB: Individual Report Card ───────────────────────────────────────────────
function IndividualCard({ schoolId }: { schoolId: string }) {
  const [grade, setGrade] = useState(10);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!schoolId) return;
    api.students.list({ schoolId, grade }).then(res => {
      setStudents(res);
      setSelectedId('');
      setData(null);
    });
  }, [schoolId, grade]);

  const load = async (studentId: string) => {
    if (!studentId) return;
    setLoading(true);
    try {
      setData(await api.attendance.reportCard(studentId, ACADEMIC_YEAR));
    } finally {
      setLoading(false);
    }
  };

  const print = () => window.print();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Class</label>
          <select value={grade} onChange={e => setGrade(Number(e.target.value))}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white">
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Student</label>
          <select value={selectedId} onChange={e => { setSelectedId(e.target.value); load(e.target.value); }}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-64">
            <option value="">— Select student —</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name} {s.rollNo ? `(${s.rollNo})` : ''}</option>)}
          </select>
        </div>
        {data && (
          <button onClick={print} className="ml-auto text-sm bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-lg text-slate-600">
            <i className="fas fa-print mr-1" /> Print
          </button>
        )}
      </div>

      {loading && <div className="text-center py-10 text-slate-400">Loading…</div>}

      {data && !loading && (
        <div ref={printRef} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6 print:shadow-none">
          {/* Header */}
          <div className="text-center border-b border-slate-100 pb-4">
            <p className="font-bold text-lg text-slate-800">{data.student?.school?.name}</p>
            <p className="text-xs text-slate-500">UDISE: {data.student?.school?.udiseCode}</p>
            <p className="mt-2 text-base font-semibold text-sky-700">Progress Report Card — {data.academicYear}</p>
          </div>

          {/* Student info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-slate-500">Name:</span> <strong>{data.student?.name}</strong></div>
            <div><span className="text-slate-500">Roll No:</span> <strong>{data.student?.rollNo || '—'}</strong></div>
            <div><span className="text-slate-500">Class:</span> <strong>{data.student?.grade} {data.student?.section}</strong></div>
            <div><span className="text-slate-500">Gender:</span> <strong>{data.student?.gender === 'M' ? 'Male' : 'Female'}</strong></div>
          </div>

          {/* Results table */}
          {Object.keys(data.bySubject ?? {}).length === 0 ? (
            <p className="text-center text-slate-400 py-6">No exam results entered yet for this student.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-sky-50 text-sky-800 text-xs uppercase">
                    <th className="px-4 py-2 text-left border border-slate-200">Subject</th>
                    {EXAM_TYPES.map(e => (
                      <th key={e} className="px-3 py-2 text-center border border-slate-200">{e}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(data.bySubject).map(([subject, exams]: [string, any]) => (
                    <tr key={subject} className="border-b border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-700 border border-slate-200">{subject}</td>
                      {EXAM_TYPES.map(e => (
                        <td key={e} className="px-3 py-2 text-center border border-slate-200">
                          {exams[e] ? (
                            <div>
                              <div className="font-semibold">{exams[e].marks}/{exams[e].max}</div>
                              <div className={`text-xs px-1 py-0.5 rounded ${gradeBadge(exams[e].grade)}`}>{exams[e].grade}</div>
                            </div>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary */}
          <div className="flex gap-6 justify-center flex-wrap pt-2 border-t border-slate-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800">{data.totalMarks}/{data.maxTotal}</p>
              <p className="text-xs text-slate-500">Total Marks</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-bold ${data.overallPct >= 75 ? 'text-emerald-600' : data.overallPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                {data.overallPct}%
              </p>
              <p className="text-xs text-slate-500">Overall</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-sky-600">{data.overallGrade}</p>
              <p className="text-xs text-slate-500">Grade</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'enter',   label: 'Enter Marks',       icon: 'fas fa-edit' },
  { id: 'class',   label: 'Class Results',      icon: 'fas fa-list-ol' },
  { id: 'card',    label: 'Report Card',        icon: 'fas fa-id-card' },
];

export function ReportCard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('enter');
  const [scope, setScope] = useState<Scope>({});

  const schoolId = user?.schoolId ?? scope.schoolId ?? '';

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase mb-1">ACADEMICS</p>
        <h1 className="text-2xl font-bold text-slate-800">Progress Report Card</h1>
        <p className="text-sm text-slate-500 mt-1">Enter exam marks and view student report cards</p>
      </div>

      {!user?.schoolId && (
        <ScopeBar value={scope} onChange={setScope} levels={['district', 'block', 'school']} />
      )}

      {!schoolId ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">
          Please select a school to enter or view results.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100">
          <div className="border-b border-slate-100 px-4">
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}>
                  <i className={t.icon} />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="p-5">
            {tab === 'enter' && <EnterMarks schoolId={schoolId} />}
            {tab === 'class' && <ClassResults schoolId={schoolId} />}
            {tab === 'card'  && <IndividualCard schoolId={schoolId} />}
          </div>
        </div>
      )}
    </div>
  );
}
