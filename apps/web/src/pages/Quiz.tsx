import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { ConfirmDialog } from '../components/ConfirmDialog';

const SUBJECTS = ['Hindi', 'English', 'Mathematics', 'Science', 'Social Science', 'Sanskrit',
  'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Political Science'];
const GRADES = [6, 7, 8, 9, 10, 11, 12];
const CAN_MANAGE = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'];

const SCOPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  school:   { label: 'This School',    icon: 'fa-school',    color: 'bg-sky-100 text-sky-700'     },
  block:    { label: 'Block-wide',     icon: 'fa-city',      color: 'bg-violet-100 text-violet-700'},
  district: { label: 'District-wide',  icon: 'fa-map',       color: 'bg-amber-100 text-amber-700' },
  all:      { label: 'All 500 Schools',icon: 'fa-globe',     color: 'bg-emerald-100 text-emerald-700'},
};

// ── Quiz card shown in the list ───────────────────────────────────────────────
function QuizCard({ quiz, onSelect, onToggle, onDelete, canManage }: {
  quiz: any; onSelect: () => void; onToggle?: () => void; onDelete?: () => void; canManage: boolean;
}) {
  const scopeCfg = SCOPE_LABELS[quiz.scope ?? 'school'];
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5 hover:border-sky-200 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 cursor-pointer" onClick={onSelect}>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${quiz.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {quiz.isActive ? 'Active' : 'Archived'}
            </span>
            {scopeCfg && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${scopeCfg.color}`}>
                <i className={`fas ${scopeCfg.icon} mr-1 text-[10px]`} />{scopeCfg.label}
              </span>
            )}
            <span className="text-xs text-slate-400">Class {quiz.grade}{quiz.section ? `-${quiz.section}` : ''}</span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-400">{quiz.subject}</span>
          </div>
          <h3 className="font-semibold text-slate-800 truncate">{quiz.title}</h3>
          {quiz.description && <p className="text-sm text-slate-500 mt-0.5 truncate">{quiz.description}</p>}
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span><i className="fas fa-question-circle mr-1" />{quiz.questionCount ?? 0} questions</span>
            {canManage && <span><i className="fas fa-users mr-1" />{quiz.attemptCount ?? 0} submitted</span>}
            {quiz.dueDate && <span><i className="fas fa-clock mr-1" />Due {quiz.dueDate}</span>}
            {quiz.myAttempt && (
              <span className="text-sky-600 font-medium">
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
              Delete
            </button>
          </div>
        )}
      </div>
      <div className="mt-3">
        <button onClick={onSelect}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
            quiz.myAttempt
              ? 'bg-slate-100 text-slate-500 cursor-default'
              : canManage
              ? 'bg-sky-50 text-sky-700 hover:bg-sky-100'
              : 'bg-sky-600 text-white hover:bg-sky-700'
          }`}>
          {quiz.myAttempt ? 'Already submitted' : canManage ? 'View / Edit' : 'Take Quiz →'}
        </button>
      </div>
    </div>
  );
}

// ── Question builder for teachers ─────────────────────────────────────────────
function QuestionBuilder({ questions, onChange }: {
  questions: { question: string; options: string[]; correct: number; marks: number }[];
  onChange: (qs: typeof questions) => void;
}) {
  const addQuestion = () => onChange([...questions, { question: '', options: ['', '', '', ''], correct: 0, marks: 1 }]);
  const removeQ = (i: number) => onChange(questions.filter((_, j) => j !== i));

  const setField = (i: number, field: string, val: any) => {
    const qs = questions.map((q, j) => j === i ? { ...q, [field]: val } : q);
    onChange(qs);
  };

  const setOption = (qi: number, oi: number, val: string) => {
    const qs = questions.map((q, j) => {
      if (j !== qi) return q;
      const opts = [...q.options];
      opts[oi] = val;
      return { ...q, options: opts };
    });
    onChange(qs);
  };

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-600">Q{i + 1}</span>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Marks</label>
              <input type="number" min={0.5} max={10} step={0.5} value={q.marks}
                onChange={e => setField(i, 'marks', Number(e.target.value))}
                className="w-14 border border-slate-200 rounded px-2 py-1 text-xs text-center bg-white" />
              <button onClick={() => removeQ(i)} className="text-red-400 hover:text-red-600 text-xs">
                <i className="fas fa-trash" />
              </button>
            </div>
          </div>
          <textarea value={q.question}
            onChange={e => setField(i, 'question', e.target.value)}
            placeholder="Question text…"
            rows={2}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white mb-3 resize-none" />
          <div className="grid grid-cols-2 gap-2 mb-2">
            {q.options.map((opt, oi) => (
              <div key={oi} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${q.correct === oi ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                <button onClick={() => setField(i, 'correct', oi)}
                  className={`w-5 h-5 rounded-full border-2 shrink-0 transition-colors ${q.correct === oi ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`} />
                <input value={opt}
                  onChange={e => setOption(i, oi, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  className="flex-1 text-sm bg-transparent outline-none" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">Click the circle next to the correct answer</p>
        </div>
      ))}
      <button onClick={addQuestion}
        className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-sm text-slate-500 hover:border-sky-400 hover:text-sky-600 transition-colors">
        <i className="fas fa-plus mr-2" />Add Question
      </button>
    </div>
  );
}

// ── Create / Edit quiz form ───────────────────────────────────────────────────
function CreateQuizView({ schoolId, user, onCreated }: { schoolId: string; user: any; onCreated: () => void }) {
  const [form, setForm] = useState({
    title: '', description: '', subject: 'Mathematics', grade: 9, section: '', dueDate: '',
    scope: 'school',
  });
  const [questions, setQuestions] = useState<any[]>([{ question: '', options: ['', '', '', ''], correct: 0, marks: 1 }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Determine which scopes are available based on user role
  const availableScopes = (() => {
    const role = user?.role ?? '';
    const scopes: { value: string; label: string; desc: string }[] = [
      { value: 'school', label: 'This School', desc: 'Visible to students in the selected school only' },
    ];
    if (['ADMIN', 'STATE_OFFICIAL', 'BLOCK_OFFICIAL', 'DISTRICT_OFFICIAL'].includes(role)) {
      scopes.push({ value: 'block', label: 'Block-wide', desc: 'Visible to all schools in the block' });
      scopes.push({ value: 'district', label: 'District-wide', desc: 'Visible to all schools in the district' });
      scopes.push({ value: 'all', label: 'All 500 Schools', desc: 'Visible to every school in the state' });
    } else if (role === 'PRINCIPAL') {
      // Principals can only publish to their school
    }
    return scopes;
  })();

  const save = async () => {
    if (!form.title.trim()) { setErr('Title is required'); return; }
    if (questions.some(q => !q.question.trim())) { setErr('Fill in all question text'); return; }
    if (questions.some(q => q.options.some((o: string) => !o.trim()))) { setErr('Fill in all answer options'); return; }
    setSaving(true);
    setErr('');
    try {
      const payload: any = {
        ...form,
        grade: Number(form.grade),
        scope: form.scope,
        schoolId: form.scope === 'school' ? schoolId : undefined,
        blockId: form.scope === 'block' ? (user?.blockId ?? undefined) : undefined,
        districtId: (form.scope === 'district' || form.scope === 'block') ? (user?.districtId ?? undefined) : undefined,
      };
      const quiz = await api.quiz.create(payload);
      await api.quiz.setQuestions(quiz.id, questions);
      onCreated();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Quiz Details</h2>

        {/* Scope selector — only shown for roles that have options */}
        {availableScopes.length > 1 && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-2">Publish To *</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {availableScopes.map(s => {
                const cfg = SCOPE_LABELS[s.value];
                return (
                  <button key={s.value} type="button"
                    onClick={() => setForm(p => ({ ...p, scope: s.value }))}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                      form.scope === s.value
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}>
                    <i className={`fas ${cfg.icon} text-lg ${form.scope === s.value ? 'text-sky-600' : 'text-slate-400'}`} />
                    <span className={`text-xs font-semibold ${form.scope === s.value ? 'text-sky-700' : 'text-slate-600'}`}>{s.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Unit Test 1 — Algebra" className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Description</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Optional instructions for students" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Subject</label>
            <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} className={inputCls}>
              {SUBJECTS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Class</label>
            <select value={form.grade} onChange={e => setForm(p => ({ ...p, grade: Number(e.target.value) }))} className={inputCls}>
              {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Section (optional)</label>
            <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}
              placeholder="A, B, C…" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Due Date (optional)</label>
            <input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))}
              className={inputCls} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-semibold text-slate-800 mb-4">Questions</h2>
        <QuestionBuilder questions={questions} onChange={setQuestions} />
      </div>

      {err && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2">{err}</p>}

      <div className="flex justify-end gap-3">
        <button onClick={onCreated} className="px-5 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          className="px-6 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 disabled:opacity-50">
          {saving ? 'Saving…' : `Save Quiz (${questions.length} Q)`}
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
    if (unanswered > 0 && !confirm(`You have ${unanswered} unanswered question(s). Submit anyway?`)) return;
    setSaving(true);
    try {
      const r = await api.quiz.submitAttempt(quizId, { answers, timeTaken: Math.round((Date.now() - startedAt) / 1000) });
      setResult(r);
      setSubmitted(true);
    } catch (e: any) {
      alert(e.message ?? 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-16 text-slate-400">Loading quiz…</div>;
  if (!quiz) return <div className="text-center py-16 text-slate-400">Quiz not found.</div>;

  if (submitted && result) {
    const pct = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <button onClick={onDone} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
          <i className="fas fa-arrow-left" /> Back to quizzes
        </button>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-center space-y-4">
          <div className={`text-6xl font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-red-600'}`}>
            {pct}%
          </div>
          <p className="text-slate-600 text-lg font-medium">{result.score} / {result.maxScore} marks</p>
          <p className="text-slate-400 text-sm">{quiz.title}</p>
          <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${pct >= 75 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
            {pct >= 75 ? 'Excellent!' : pct >= 50 ? 'Good effort' : 'Keep practising'}
          </div>
          {result.timeTaken && (
            <p className="text-xs text-slate-400">Completed in {Math.floor(result.timeTaken / 60)}m {result.timeTaken % 60}s</p>
          )}
        </div>
      </div>
    );
  }

  const answered = Object.keys(answers).length;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <button onClick={onDone} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
          <i className="fas fa-arrow-left" /> Back
        </button>
        <span className="text-sm text-slate-500">{answered} / {quiz.questions.length} answered</span>
      </div>

      <div className="bg-white rounded-xl border border-slate-100 p-5">
        <h2 className="font-bold text-slate-800 text-lg">{quiz.title}</h2>
        <p className="text-sm text-slate-500 mt-1">{quiz.subject} · Class {quiz.grade}{quiz.section ? `-${quiz.section}` : ''}</p>
        {quiz.description && <p className="text-sm text-slate-600 mt-2 bg-sky-50 rounded-lg px-3 py-2">{quiz.description}</p>}
      </div>

      {quiz.questions.map((q: any, i: number) => (
        <div key={q.id} className="bg-white rounded-xl border border-slate-100 p-5">
          <div className="flex items-start gap-3">
            <span className="bg-sky-100 text-sky-700 rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
            <div className="flex-1">
              <p className="text-slate-800 font-medium mb-4">{q.question}</p>
              <div className="space-y-2">
                {q.options.map((opt: string, oi: number) => (
                  <button key={oi} onClick={() => setAnswers(p => ({ ...p, [q.id]: oi }))}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 text-sm transition-all ${
                      answers[q.id] === oi
                        ? 'border-sky-500 bg-sky-50 text-sky-800 font-medium'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}>
                    <span className="font-semibold mr-2">{String.fromCharCode(65 + oi)}.</span>
                    {opt}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">{q.marks} mark{q.marks !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      ))}

      <div className="flex justify-end pb-6">
        <button onClick={submit} disabled={saving}
          className="px-8 py-3 bg-sky-600 text-white rounded-xl font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors">
          {saving ? 'Submitting…' : 'Submit Quiz'}
        </button>
      </div>
    </div>
  );
}

// ── Teacher results view ──────────────────────────────────────────────────────
function ResultsView({ quizId, onBack }: { quizId: string; onBack: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.quiz.results(quizId).then(setData).finally(() => setLoading(false));
  }, [quizId]);

  if (loading) return <div className="text-center py-16 text-slate-400">Loading results…</div>;
  if (!data) return <div className="text-center py-16 text-slate-400">No data.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm">
          <i className="fas fa-arrow-left" /> Back to quizzes
        </button>
        <h2 className="font-bold text-slate-800 text-lg">{data.quiz.title} — Results</h2>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Submitted', val: data.totalAttempts, color: 'text-slate-800' },
          { label: 'Average Score', val: data.avgScore != null ? `${data.avgScore}%` : '—', color: data.avgScore >= 75 ? 'text-emerald-600' : data.avgScore >= 50 ? 'text-amber-600' : 'text-red-600' },
          { label: 'Questions', val: data.questions.length, color: 'text-slate-800' },
        ].map(({ label, val, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 p-4 text-center shadow-sm">
            <div className={`text-3xl font-bold ${color}`}>{val}</div>
            <div className="text-xs text-slate-400 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {data.attempts.length > 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
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
                <tr key={a.studentId} className={i < 3 ? 'bg-amber-50/30' : ''}>
                  <td className="px-4 py-2 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-slate-400">{i + 1}</span>}
                  </td>
                  <td className="px-4 py-2 font-medium text-slate-800">{a.student?.name ?? a.studentId}</td>
                  <td className="px-3 py-2 text-center text-slate-400 text-xs">{a.student?.rollNo ?? '—'}</td>
                  <td className="px-3 py-2 text-center">{a.score}/{a.maxScore}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${a.pct >= 75 ? 'bg-emerald-100 text-emerald-700' : a.pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {a.pct}%
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center text-slate-400 text-xs">
                    {a.timeTaken ? `${Math.floor(a.timeTaken / 60)}m ${a.timeTaken % 60}s` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState('');
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<Scope>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canManage = CAN_MANAGE.includes(user?.role ?? '');
  const isStudent = user?.role === 'STUDENT';

  const schoolId = user?.schoolId ?? scope.schoolId ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQuizzes(await api.quiz.list(schoolId ? { schoolId } : {}));
    } catch {
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { if (view === 'list') load(); }, [load, view]);

  const handleToggle = async (id: string) => {
    await api.quiz.toggle(id);
    load();
  };

  const handleDelete = async (id: string) => {
    await api.quiz.remove(id);
    load();
  };

  if (view === 'create') {
    return (
      <div className="p-6">
        <div className="mb-4">
          <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase mb-1">QUIZ ENGINE</p>
          <h1 className="text-2xl font-bold text-slate-800">Create Quiz</h1>
        </div>
        <CreateQuizView schoolId={schoolId} user={user} onCreated={() => { setView('list'); }} />
      </div>
    );
  }

  if (view === 'take') {
    return (
      <div className="p-6">
        <TakeQuizView quizId={selectedId} onDone={() => { setView('list'); load(); }} />
      </div>
    );
  }

  if (view === 'results') {
    return (
      <div className="p-6">
        <ResultsView quizId={selectedId} onBack={() => setView('list')} />
      </div>
    );
  }

  // List view
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold tracking-widest text-sky-600 uppercase mb-1">QUIZ ENGINE</p>
          <h1 className="text-2xl font-bold text-slate-800">
            {isStudent ? 'My Quizzes' : 'Quiz Management'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isStudent ? 'Take assigned quizzes and view your results' : 'Create MCQ quizzes and track student performance'}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setView('create')} disabled={!schoolId}
            className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors">
            <i className="fas fa-plus" /> New Quiz
          </button>
        )}
      </div>

      {!isStudent && !user?.schoolId && (
        <ScopeBar value={scope} onChange={setScope} />
      )}

      {!schoolId && !isStudent ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-amber-700 text-sm">
          Please select a school to view or create quizzes.
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-slate-400">Loading quizzes…</div>
      ) : quizzes.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <i className="fas fa-question-circle text-5xl mb-3 opacity-20 block" />
          {isStudent ? 'No quizzes assigned to you yet.' : 'No quizzes yet. Create your first quiz!'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizzes.map(q => (
            <QuizCard
              key={q.id}
              quiz={q}
              canManage={canManage}
              onSelect={() => {
                setSelectedId(q.id);
                setView(isStudent && !q.myAttempt ? 'take' : 'results');
              }}
              onToggle={canManage ? () => handleToggle(q.id) : undefined}
              onDelete={canManage ? () => setConfirmDeleteId(q.id) : undefined}
            />
          ))}
        </div>
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
