import { useCallback, useEffect, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, PieChart, Pie, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { api } from '../api';
import { useAuth } from '../auth';
import { ConfirmDialog } from '../components/ConfirmDialog';

const SUBJECTS = ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Sanskrit',
  'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Political Science'];
const GRADES = [6, 7, 8, 9, 10, 11, 12];
const CAN_MANAGE = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'];

const SCOPE_CFG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  school:   { label: 'This School',     icon: 'fa-school',   color: 'text-sky-700',     bg: 'bg-sky-100'     },
  block:    { label: 'Block-wide',      icon: 'fa-city',     color: 'text-violet-700',  bg: 'bg-violet-100'  },
  district: { label: 'District-wide',   icon: 'fa-map',      color: 'text-amber-700',   bg: 'bg-amber-100'   },
  all:      { label: 'State-wide',      icon: 'fa-globe',    color: 'text-emerald-700', bg: 'bg-emerald-100' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function pctColor(v: number | null) {
  if (v == null) return 'text-slate-400';
  return v >= 75 ? 'text-emerald-600' : v >= 50 ? 'text-amber-600' : 'text-red-500';
}
function pctBadge(v: number | null) {
  if (v == null) return 'bg-slate-100 text-slate-400';
  return v >= 75 ? 'bg-emerald-100 text-emerald-700' : v >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
}

// ── Quiz Statistics Dashboard ────────────────────────────────────────────────
function QuizStatsDashboard({ stats }: { stats: any }) {
  const tip = { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.08)' };

  const distData = [
    { name: 'High (≥75%)',  value: stats.scoreDist?.high ?? 0, fill: '#10b981' },
    { name: 'Mid (50-74%)', value: stats.scoreDist?.mid  ?? 0, fill: '#f59e0b' },
    { name: 'Low (<50%)',   value: stats.scoreDist?.low  ?? 0, fill: '#ef4444' },
  ];
  const totalDist = distData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Quizzes',     val: stats.totalQuizzes,   icon: 'fa-question-circle', bg: 'bg-sky-50',     color: 'text-sky-600'     },
          { label: 'Active',            val: stats.activeQuizzes,  icon: 'fa-play-circle',     bg: 'bg-emerald-50', color: 'text-emerald-600' },
          { label: 'Total Attempts',    val: stats.totalAttempts,  icon: 'fa-users',           bg: 'bg-violet-50',  color: 'text-violet-600'  },
          { label: 'Students Engaged',  val: stats.uniqueStudents, icon: 'fa-user-graduate',   bg: 'bg-amber-50',   color: 'text-amber-600'   },
          { label: 'Schools Attempted', val: stats.schoolsAttempted,icon: 'fa-school',          bg: 'bg-rose-50',    color: 'text-rose-600'    },
          { label: 'Avg Score',         val: stats.avgScore != null ? `${stats.avgScore}%` : '—',
            icon: 'fa-chart-line', bg: 'bg-indigo-50', color: stats.avgScore != null ? pctColor(stats.avgScore) : 'text-slate-400' },
        ].map(k => (
          <div key={k.label} className={`panel flex items-center gap-3 px-4 py-3.5 ${k.bg}`}>
            <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center shrink-0">
              <i className={`fas ${k.icon} ${k.color} text-base`} />
            </div>
            <div>
              <div className="font-heading font-bold text-navy-700 text-lg leading-none">{k.val}</div>
              <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Attempts by Subject */}
        <div className="panel overflow-hidden lg:col-span-2">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-navy-700 text-sm">Attempts by Subject</h3>
            <p className="text-xs text-slate-400 mt-0.5">Total submissions per subject · avg score</p>
          </div>
          <div className="p-4">
            {stats.bySubject?.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.bySubject} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="subject" fontSize={10} tick={{ fill: '#64748b' }}
                    tickFormatter={s => s.replace('Mathematics','Math').replace('Social Science','Soc.Sci').replace('Science','Sci')} />
                  <YAxis fontSize={11} yAxisId="left" allowDecimals={false} />
                  <YAxis fontSize={11} yAxisId="right" orientation="right" domain={[0, 100]}
                    tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tip}
                    formatter={(v: number, name: string) => [name === 'avgScore' ? `${v}%` : v, name === 'avgScore' ? 'Avg Score' : 'Attempts']} />
                  <Bar yAxisId="left" dataKey="attempts" name="Attempts" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                    {(stats.bySubject ?? []).map((_: any, i: number) => (
                      <Cell key={i} fill={`hsl(${210 + i * 18},65%,${52 - i}%)`} />
                    ))}
                  </Bar>
                  <Bar yAxisId="right" dataKey="avgScore" name="Avg Score" radius={[4, 4, 0, 0]} maxBarSize={12}
                    fill="#f59e0b" isAnimationActive={false} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
                <i className="fas fa-chart-bar mr-2 opacity-30" />No attempt data yet
              </div>
            )}
          </div>
        </div>

        {/* Score Distribution */}
        <div className="panel overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-heading font-semibold text-navy-700 text-sm">Score Distribution</h3>
            <p className="text-xs text-slate-400 mt-0.5">Performance bands across all quizzes</p>
          </div>
          <div className="p-4">
            {totalDist > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={distData} dataKey="value" innerRadius={48} outerRadius={72}
                      paddingAngle={3} isAnimationActive={false}>
                      {distData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={tip} formatter={(v: number) => [`${v} students`, '']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-1">
                  {distData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: d.fill }} />
                        <span className="text-slate-600">{d.name}</span>
                      </span>
                      <span className="font-semibold text-slate-700">
                        {d.value} <span className="font-normal text-slate-400">({totalDist > 0 ? Math.round((d.value / totalDist) * 100) : 0}%)</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
                <i className="fas fa-chart-pie mr-2 opacity-30" />No attempts yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top quizzes table */}
      {stats.topQuizzes?.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-heading font-semibold text-navy-700 text-sm">Top Quizzes by Participation</h3>
            <span className="text-xs text-slate-400">Ranked by attempts</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Quiz</th>
                  <th className="px-3 py-3 text-center">Scope</th>
                  <th className="px-3 py-3 text-center">Class</th>
                  <th className="px-3 py-3 text-center">Questions</th>
                  <th className="px-3 py-3 text-center">Attempts</th>
                  <th className="px-3 py-3 text-center">Schools</th>
                  <th className="px-3 py-3 text-center">Avg Score</th>
                  <th className="px-3 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.topQuizzes.map((q: any, i: number) => {
                  const sc = SCOPE_CFG[q.scope ?? 'school'];
                  return (
                    <tr key={q.id} className={i < 3 ? 'bg-amber-50/30' : 'hover:bg-slate-50'}>
                      <td className="px-5 py-2.5 font-bold text-slate-400">
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800 truncate max-w-[200px]">{q.title}</div>
                        <div className="text-xs text-slate-400">{q.subject}</div>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc?.bg} ${sc?.color}`}>
                          <i className={`fas ${sc?.icon} mr-1 text-[9px]`} />{sc?.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-slate-600 text-xs">Class {q.grade}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{q.questionCount}</td>
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-800">{q.attemptCount}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{q.schoolCount}</td>
                      <td className="px-3 py-2.5 text-center">
                        {q.avgScore != null ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctBadge(q.avgScore)}`}>
                            {q.avgScore}%
                          </span>
                        ) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${q.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {q.isActive ? 'Active' : 'Archived'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Quiz card ────────────────────────────────────────────────────────────────
function QuizCard({ quiz, onSelect, onToggle, onDelete, canManage }: {
  quiz: any; onSelect: () => void; onToggle?: () => void; onDelete?: () => void; canManage: boolean;
}) {
  const sc = SCOPE_CFG[quiz.scope ?? 'school'];
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:border-sky-200 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${quiz.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {quiz.isActive ? 'Active' : 'Archived'}
            </span>
            {sc && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}>
                <i className={`fas ${sc.icon} mr-1 text-[10px]`} />{sc.label}
              </span>
            )}
            <span className="text-xs text-slate-400 bg-slate-50 rounded-full px-2 py-0.5">
              Class {quiz.grade}{quiz.section ? `-${quiz.section}` : ''}
            </span>
            <span className="text-xs text-slate-400">· {quiz.subject}</span>
          </div>
          <h3 className="font-semibold text-slate-800 truncate text-base">{quiz.title}</h3>
          {quiz.description && <p className="text-sm text-slate-500 mt-0.5 truncate">{quiz.description}</p>}
          <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-400 flex-wrap">
            <span><i className="fas fa-question-circle mr-1 text-sky-400" />{quiz.questionCount ?? 0} questions</span>
            {canManage && (
              <>
                <span><i className="fas fa-users mr-1 text-violet-400" />{quiz.attemptCount ?? 0} submitted</span>
                {quiz.attemptCount > 0 && quiz.avgScore != null && (
                  <span className={`font-semibold ${pctColor(quiz.avgScore)}`}>
                    <i className="fas fa-chart-line mr-1" />{quiz.avgScore}% avg
                  </span>
                )}
              </>
            )}
            {quiz.dueDate && <span><i className="fas fa-clock mr-1 text-amber-400" />Due {quiz.dueDate}</span>}
            {quiz.myAttempt && (
              <span className="text-emerald-600 font-medium">
                <i className="fas fa-check-circle mr-1" />
                {quiz.myAttempt.score}/{quiz.myAttempt.maxScore} ({Math.round((quiz.myAttempt.score / quiz.myAttempt.maxScore) * 100)}%)
              </span>
            )}
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggle}
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              {quiz.isActive ? 'Archive' : 'Activate'}
            </button>
            <button onClick={onDelete}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-colors">
              <i className="fas fa-trash" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3">
        <button onClick={onSelect}
          className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
            quiz.myAttempt
              ? 'bg-slate-50 text-slate-400 cursor-default'
              : canManage
              ? 'bg-gradient-to-r from-sky-50 to-indigo-50 text-sky-700 hover:from-sky-100 hover:to-indigo-100 border border-sky-100'
              : 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white hover:from-sky-700 hover:to-indigo-700 shadow-sm'
          }`}>
          {quiz.myAttempt ? '✓ Already submitted' : canManage ? 'View Results →' : 'Take Quiz →'}
        </button>
      </div>
    </div>
  );
}

// ── Question builder ─────────────────────────────────────────────────────────
function QuestionBuilder({ questions, onChange }: {
  questions: { question: string; options: string[]; correct: number; marks: number }[];
  onChange: (qs: typeof questions) => void;
}) {
  const addQ = () => onChange([...questions, { question: '', options: ['', '', '', ''], correct: 0, marks: 1 }]);
  const removeQ = (i: number) => onChange(questions.filter((_, j) => j !== i));
  const setField = (i: number, field: string, val: any) =>
    onChange(questions.map((q, j) => j === i ? { ...q, [field]: val } : q));
  const setOption = (qi: number, oi: number, val: string) =>
    onChange(questions.map((q, j) => {
      if (j !== qi) return q;
      const opts = [...q.options]; opts[oi] = val; return { ...q, options: opts };
    }));

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center">
              {i + 1}
            </span>
            <div className="flex items-center gap-3">
              <label className="text-xs text-slate-500">Marks</label>
              <input type="number" min={0.5} max={10} step={0.5} value={q.marks}
                onChange={e => setField(i, 'marks', Number(e.target.value))}
                className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-xs text-center bg-white" />
              <button onClick={() => removeQ(i)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                <i className="fas fa-trash text-xs" />
              </button>
            </div>
          </div>
          <textarea value={q.question} onChange={e => setField(i, 'question', e.target.value)}
            placeholder="Type your question here…" rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white mb-3 resize-none focus:outline-none focus:border-sky-400" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className={`flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all ${q.correct === oi ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                <button onClick={() => setField(i, 'correct', oi)}
                  className={`w-5 h-5 rounded-full border-2 shrink-0 transition-all ${q.correct === oi ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'border-slate-300 hover:border-emerald-400'}`} />
                <input value={opt} onChange={e => setOption(i, oi, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  className="flex-1 text-sm bg-transparent outline-none" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400"><i className="fas fa-info-circle mr-1" />Click the circle to mark the correct answer</p>
        </div>
      ))}
      <button onClick={addQ}
        className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-sky-400 hover:text-sky-600 hover:bg-sky-50 transition-all">
        <i className="fas fa-plus mr-2" />Add Question
      </button>
    </div>
  );
}

// ── Create Quiz form ─────────────────────────────────────────────────────────
function CreateQuizView({ user, onCreated }: { user: any; onCreated: () => void }) {
  const role = user?.role ?? '';

  const availableScopes = (() => {
    const all = [
      { value: 'school',   label: 'School',    icon: 'fa-school',   desc: 'Only this school' },
      { value: 'block',    label: 'Block',      icon: 'fa-city',     desc: 'All schools in block' },
      { value: 'district', label: 'District',   icon: 'fa-map',      desc: 'All schools in district' },
      { value: 'all',      label: 'State-wide', icon: 'fa-globe',    desc: 'Every school in the state' },
    ];
    if (['ADMIN', 'STATE_OFFICIAL'].includes(role)) return all;
    if (role === 'DISTRICT_OFFICIAL') return all.slice(0, 3);
    if (role === 'BLOCK_OFFICIAL')    return all.slice(0, 2);
    return all.slice(0, 1); // PRINCIPAL / TEACHER: school only
  })();

  const defaultScope = availableScopes[0].value; // start at narrowest scope; user widens deliberately

  const [form, setForm] = useState({
    title: '', description: '', subject: 'Mathematics', grade: 9, section: '', dueDate: '',
    scope: defaultScope,
    tenantId: user?.tenantId ?? '',
    districtId: user?.districtId ?? '',
    blockId: user?.blockId ?? '',
    schoolId: user?.schoolId ?? '',
  });
  const [questions, setQuestions] = useState<any[]>([{ question: '', options: ['', '', '', ''], correct: 0, marks: 1 }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Tenant/district/block pickers for platform admin
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);

  const isPlatformAdmin = role === 'ADMIN' && !user?.tenantId;

  useEffect(() => {
    if (isPlatformAdmin) api.tenants().then(setTenants).catch(() => null);
  }, [isPlatformAdmin]);

  useEffect(() => {
    if ((form.scope === 'district' || form.scope === 'block' || form.scope === 'school') &&
        (isPlatformAdmin || !user?.districtId)) {
      api.schoolDistricts().then(d => setDistricts(d)).catch(() => null);
    }
  }, [form.scope, isPlatformAdmin]);

  useEffect(() => {
    if (form.scope === 'block' || form.scope === 'school') {
      const dist = districts.find(d => d.id === form.districtId);
      setBlocks(dist?.blocks ?? []);
    }
  }, [form.districtId, districts, form.scope]);

  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (form.scope === 'all' && !form.tenantId && !user?.tenantId) { setErr('Please select a state to broadcast to all schools'); return; }
    if (form.scope === 'district' && !form.districtId && !user?.districtId) { setErr('Please select a district'); return; }
    if (form.scope === 'block' && !form.blockId && !user?.blockId && !form.districtId && !user?.districtId) { setErr('Please select a block or district'); return; }
    if (questions.some(q => !q.question.trim())) { setErr('Fill in all question text'); return; }
    if (questions.some(q => q.options.some((o: string) => !o.trim()))) { setErr('Fill in all answer options'); return; }

    setSaving(true); setErr('');
    try {
      const payload: any = {
        title: form.title, description: form.description || undefined,
        subject: form.subject, grade: Number(form.grade),
        section: form.section || undefined, dueDate: form.dueDate || undefined,
        scope: form.scope,
      };
      if (form.scope === 'school') {
        payload.schoolId = form.schoolId || user?.schoolId;
      } else if (form.scope === 'block') {
        payload.blockId = form.blockId || user?.blockId;
        payload.districtId = form.districtId || user?.districtId;
      } else if (form.scope === 'district') {
        payload.districtId = form.districtId || user?.districtId;
      } else if (form.scope === 'all') {
        payload.tenantId = form.tenantId || user?.tenantId;
      }

      const quiz = await api.quiz.create(payload);
      await api.quiz.setQuestions(quiz.id, questions);
      onCreated();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100';

  return (
    <div className="max-w-3xl space-y-5">
      {/* Scope selector */}
      <div className="panel p-5 space-y-4">
        <h2 className="font-heading font-semibold text-navy-700">Quiz Settings</h2>

        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-2.5 uppercase tracking-wide">Publish Scope *</label>
          <div className={`grid gap-2 ${availableScopes.length <= 2 ? 'grid-cols-2' : availableScopes.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
            {availableScopes.map(s => {
              const cfg = SCOPE_CFG[s.value];
              const sel = form.scope === s.value;
              return (
                <button key={s.value} type="button" onClick={() => set('scope', s.value)}
                  className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 text-center transition-all ${
                    sel ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sel ? 'bg-sky-600' : 'bg-slate-100'}`}>
                    <i className={`fas ${cfg.icon} text-sm ${sel ? 'text-white' : 'text-slate-400'}`} />
                  </div>
                  <span className={`text-xs font-bold ${sel ? 'text-sky-700' : 'text-slate-600'}`}>{s.label}</span>
                  <span className="text-[10px] text-slate-400 leading-tight">{s.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Platform Admin: tenant picker for state-wide */}
        {isPlatformAdmin && form.scope === 'all' && (
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Select State *</label>
            <select value={form.tenantId} onChange={e => set('tenantId', e.target.value)} className={inp}>
              <option value="">— Choose state —</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* District picker when needed */}
        {(isPlatformAdmin || !user?.districtId) && (form.scope === 'district' || form.scope === 'block' || form.scope === 'school') && (
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Select District *</label>
            <select value={form.districtId} onChange={e => set('districtId', e.target.value)} className={inp}>
              <option value="">— Choose district —</option>
              {districts.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}

        {/* Block picker */}
        {(isPlatformAdmin || !user?.blockId) && (form.scope === 'block' || form.scope === 'school') && blocks.length > 0 && (
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Select Block</label>
            <select value={form.blockId} onChange={e => set('blockId', e.target.value)} className={inp}>
              <option value="">— All blocks in district —</option>
              {blocks.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1.5">Quiz Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Unit Test 1 — Algebra" className={inp} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1.5">Description (optional)</label>
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Instructions for students" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Subject</label>
            <select value={form.subject} onChange={e => set('subject', e.target.value)} className={inp}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Class</label>
            <select value={form.grade} onChange={e => set('grade', Number(e.target.value))} className={inp}>
              {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Section (optional)</label>
            <input value={form.section} onChange={e => set('section', e.target.value)}
              placeholder="A, B, C…" className={inp} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1.5">Due Date (optional)</label>
            <input type="date" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} className={inp} />
          </div>
        </div>
      </div>

      {/* Question builder */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading font-semibold text-navy-700">Questions</h2>
          <span className="text-xs text-slate-400 bg-slate-50 rounded-full px-3 py-1">
            {questions.length} question{questions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <QuestionBuilder questions={questions} onChange={setQuestions} />
      </div>

      {err && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <i className="fas fa-exclamation-circle shrink-0" />
          {err}
        </div>
      )}

      <div className="flex justify-end gap-3 pb-4">
        <button onClick={onCreated}
          className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          className="px-7 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-sm font-semibold hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-sm">
          {saving ? <><i className="fas fa-circle-notch fa-spin mr-2" />Saving…</> : `Save Quiz (${questions.length} Q)`}
        </button>
      </div>
    </div>
  );
}

// ── Take quiz (student) ───────────────────────────────────────────────────────
function TakeQuizView({ quizId, onDone }: { quizId: string; onDone: () => void }) {
  const [quiz, setQuiz] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [startedAt] = useState(Date.now());

  useEffect(() => {
    api.quiz.get(quizId).then(q => {
      setQuiz(q);
      if (q.myAttempt) { setSubmitted(true); setResult(q.myAttempt); }
    }).finally(() => setLoading(false));
  }, [quizId]);

  const submit = async () => {
    if (!quiz) return;
    const unanswered = quiz.questions.filter((q: any) => answers[q.id] === undefined).length;
    if (unanswered > 0 && !confirm(`${unanswered} question(s) unanswered. Submit anyway?`)) return;
    setSaving(true);
    try {
      const r = await api.quiz.submitAttempt(quizId, { answers, timeTaken: Math.round((Date.now() - startedAt) / 1000) });
      setResult(r); setSubmitted(true);
    } catch (e: any) {
      alert(e.message ?? 'Failed to submit');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="text-center py-20 text-slate-400"><i className="fas fa-circle-notch fa-spin mr-2" />Loading quiz…</div>;
  if (!quiz)  return <div className="text-center py-20 text-slate-400">Quiz not found.</div>;

  if (submitted && result) {
    const pct = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
    const grade = pct >= 75 ? { label: 'Excellent!', cls: 'text-emerald-600', bg: 'bg-emerald-100 text-emerald-700' }
                : pct >= 50 ? { label: 'Good effort', cls: 'text-amber-500', bg: 'bg-amber-100 text-amber-700' }
                :              { label: 'Keep practising', cls: 'text-red-600', bg: 'bg-red-100 text-red-700' };
    return (
      <div className="max-w-lg mx-auto space-y-6 py-8">
        <button onClick={onDone} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
          <i className="fas fa-arrow-left" /> Back to quizzes
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-lg p-10 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto">
            <span className={`text-5xl font-bold ${grade.cls}`}>{pct}%</span>
          </div>
          <div>
            <p className="text-slate-800 text-xl font-bold">{result.score} / {result.maxScore} marks</p>
            <p className="text-slate-400 text-sm mt-1">{quiz.title}</p>
          </div>
          <span className={`inline-block px-5 py-1.5 rounded-full text-sm font-semibold ${grade.bg}`}>{grade.label}</span>
          {result.timeTaken && (
            <p className="text-xs text-slate-400">Completed in {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</p>
          )}
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).length;
  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <button onClick={onDone} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
          <i className="fas fa-arrow-left" /> Back
        </button>
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${(answered / quiz.questions.length) * 100}%` }} />
          </div>
          <span className="text-sm text-slate-500">{answered}/{quiz.questions.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 text-lg">{quiz.title}</h2>
        <p className="text-sm text-slate-500 mt-1">{quiz.subject} · Class {quiz.grade}{quiz.section ? `-${quiz.section}` : ''}</p>
        {quiz.description && <p className="text-sm text-slate-600 mt-2 bg-sky-50 rounded-xl px-4 py-2.5">{quiz.description}</p>}
      </div>

      {quiz.questions.map((q: any, i: number) => (
        <div key={q.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start gap-3">
            <span className="bg-gradient-to-br from-sky-500 to-indigo-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">{i + 1}</span>
            <div className="flex-1">
              <p className="text-slate-800 font-medium mb-4">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt: string, oi: number) => (
                  <button key={oi} onClick={() => setAnswers(p => ({ ...p, [q.id]: oi }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                      answers[q.id] === oi
                        ? 'border-sky-500 bg-sky-50 text-sky-800 font-semibold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'}`}>
                    <span className="font-bold mr-2 text-slate-400">{String.fromCharCode(65 + oi)}.</span>{opt}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">{q.marks} mark{q.marks !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pb-2">
        <button onClick={submit} disabled={saving}
          className="px-8 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 transition-all shadow-md">
          {saving ? <><i className="fas fa-circle-notch fa-spin mr-2" />Submitting…</> : 'Submit Quiz →'}
        </button>
      </div>
    </div>
  );
}

// ── Results view ─────────────────────────────────────────────────────────────
function ResultsView({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const tip = { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.08)' };

  useEffect(() => { api.quiz.results(quizId).then(setData).finally(() => setLoading(false)); }, [quizId]);

  if (loading) return <div className="text-center py-16 text-slate-400"><i className="fas fa-circle-notch fa-spin mr-2" />Loading results…</div>;
  if (!data)   return <div className="text-center py-16 text-slate-400">No data.</div>;

  const distData = (() => {
    const high = data.attempts.filter((a: any) => a.pct >= 75).length;
    const mid  = data.attempts.filter((a: any) => a.pct >= 50 && a.pct < 75).length;
    const low  = data.attempts.filter((a: any) => a.pct < 50).length;
    return [
      { name: '≥75%', value: high, fill: '#10b981' },
      { name: '50–74%', value: mid, fill: '#f59e0b' },
      { name: '<50%', value: low, fill: '#ef4444' },
    ].filter(d => d.value > 0);
  })();

  const sc = SCOPE_CFG[data.quiz.scope ?? 'school'];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
          <i className="fas fa-arrow-left" /> Back
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-slate-800 text-lg">{data.quiz.title}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-sm text-slate-500">{data.quiz.subject} · Class {data.quiz.grade}</span>
            {sc && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sc.bg} ${sc.color}`}><i className={`fas ${sc.icon} mr-1 text-[9px]`}/>{sc.label}</span>}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Submitted', val: data.totalAttempts, color: 'text-slate-800', bg: 'bg-white' },
          { label: 'Avg Score', val: data.avgScore != null ? `${data.avgScore}%` : '—',
            color: pctColor(data.avgScore), bg: 'bg-white' },
          { label: 'Questions', val: data.questions.length, color: 'text-slate-800', bg: 'bg-white' },
          { label: 'Top Score', val: data.attempts.length ? `${data.attempts[0].pct}%` : '—',
            color: 'text-emerald-600', bg: 'bg-white' },
        ].map(k => (
          <div key={k.label} className={`panel ${k.bg} px-5 py-4 text-center`}>
            <div className={`text-3xl font-bold ${k.color}`}>{k.val}</div>
            <div className="text-xs text-slate-400 mt-1">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {data.attempts.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Score bar */}
          <div className="panel overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-navy-700">Score Distribution</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={distData} dataKey="value" innerRadius={45} outerRadius={65}
                    paddingAngle={3} isAnimationActive={false}>
                    {distData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} />
                  <Legend iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          {/* Per-student scores */}
          <div className="panel overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-navy-700">Student Scores</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={data.attempts.slice(0, 20).map((a: any) => ({
                  name: a.student?.name?.split(' ')[0] ?? 'S',
                  score: a.pct,
                }))} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" fontSize={10} tick={{ fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} fontSize={11} tickFormatter={v => `${v}%`} />
                  <Tooltip contentStyle={tip} formatter={(v: number) => [`${v}%`, 'Score']} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]} maxBarSize={20} isAnimationActive={false}>
                    {data.attempts.slice(0, 20).map((a: any, i: number) => (
                      <Cell key={i} fill={a.pct >= 75 ? '#10b981' : a.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      {data.attempts.length > 0 ? (
        <div className="panel overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-navy-700">Leaderboard</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-3 py-3 text-center">Roll</th>
                  <th className="px-3 py-3 text-center">Score</th>
                  <th className="px-3 py-3 text-center">%</th>
                  <th className="px-3 py-3 text-center">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {data.attempts.map((a: any, i: number) => (
                  <tr key={a.studentId} className={i < 3 ? 'bg-amber-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-2.5 font-bold">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-slate-400 text-xs">{i + 1}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{a.student?.name ?? a.studentId}</td>
                    <td className="px-3 py-2.5 text-center text-slate-400 text-xs">{a.student?.rollNo ?? '—'}</td>
                    <td className="px-3 py-2.5 text-center text-slate-700">{a.score}/{a.maxScore}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pctBadge(a.pct)}`}>{a.pct}%</span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-400 text-xs">
                      {a.timeTaken ? `${Math.floor(a.timeTaken / 60)}m ${a.timeTaken % 60}s` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-slate-400">No submissions yet.</div>
      )}
    </div>
  );
}

// ── Main Quiz page ────────────────────────────────────────────────────────────
type View = 'list' | 'create' | 'take' | 'results';

export function Quiz() {
  const { user } = useAuth();
  const [view, setView]       = useState<View>('list');
  const [selectedId, setSelectedId] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [stats, setStats]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const isStudent = user?.role === 'STUDENT';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = user?.schoolId ? { schoolId: user.schoolId } : {};
      const [q, s] = await Promise.all([
        api.quiz.list(params).catch(() => []),
        canManage ? api.quiz.stats(params).catch(() => null) : Promise.resolve(null),
      ]);
      setQuizzes(q);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [user?.schoolId, canManage]);

  useEffect(() => { if (view === 'list') load(); }, [load, view]);

  const handleToggle = async (id: string) => { await api.quiz.toggle(id); load(); };
  const handleDelete = async (id: string) => { await api.quiz.remove(id); load(); };

  if (view === 'create') return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase mb-1">QUIZ ENGINE</p>
        <h1 className="text-2xl font-bold text-slate-800">Create New Quiz</h1>
        <p className="text-sm text-slate-500 mt-1">Build MCQ questions and assign to any scope</p>
      </div>
      <CreateQuizView user={user} onCreated={() => setView('list')} />
    </div>
  );

  if (view === 'take') return (
    <TakeQuizView quizId={selectedId} onDone={() => { setView('list'); load(); }} />
  );

  if (view === 'results') return (
    <ResultsView quizId={selectedId} onBack={() => setView('list')} />
  );

  // ── List view
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-question-circle" />Quiz Engine</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">
            {isStudent ? 'My Quizzes' : 'Quiz Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isStudent
              ? 'Take assigned quizzes and view your results'
              : 'Create and manage MCQ quizzes across School · Block · District · State levels'}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setView('create')}
            className="flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-sky-700 hover:to-indigo-700 shadow-sm transition-all">
            <i className="fas fa-plus" /> New Quiz
          </button>
        )}
      </div>

      {/* Tab switcher for managers */}
      {canManage && (
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {(['list', 'stats'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === t ? 'bg-white shadow-sm text-navy-700' : 'text-slate-500 hover:text-slate-700'}`}>
              <i className={`fas ${t === 'list' ? 'fa-list' : 'fa-chart-bar'} mr-2`} />
              {t === 'list' ? 'Quizzes' : 'Statistics'}
            </button>
          ))}
        </div>
      )}

      {/* Stats tab */}
      {activeTab === 'stats' && canManage && (
        stats ? <QuizStatsDashboard stats={stats} /> : (
          <div className="text-center py-16 text-slate-400">
            <i className="fas fa-circle-notch fa-spin mr-2" />Loading statistics…
          </div>
        )
      )}

      {/* Quiz list tab */}
      {(activeTab === 'list' || isStudent) && (
        loading ? (
          <div className="text-center py-16 text-slate-400"><i className="fas fa-circle-notch fa-spin mr-2" />Loading quizzes…</div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-question-circle text-4xl text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              {isStudent ? 'No quizzes assigned to you yet.' : 'No quizzes created yet.'}
            </p>
            {canManage && (
              <button onClick={() => setView('create')}
                className="mt-4 px-6 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-semibold hover:bg-sky-700 transition-colors">
                <i className="fas fa-plus mr-2" />Create first quiz
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map(q => (
              <QuizCard key={q.id} quiz={q} canManage={canManage}
                onSelect={() => { setSelectedId(q.id); setView(isStudent && !q.myAttempt ? 'take' : 'results'); }}
                onToggle={canManage ? () => handleToggle(q.id) : undefined}
                onDelete={canManage ? () => setConfirmDeleteId(q.id) : undefined}
              />
            ))}
          </div>
        )
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Delete quiz"
        message="Delete this quiz and all student attempts? This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={() => { handleDelete(confirmDeleteId!); setConfirmDeleteId(null); }}
      />
    </div>
  );
}
