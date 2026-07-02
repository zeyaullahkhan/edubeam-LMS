import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const GRADES = [6, 7, 8, 9, 10, 11, 12];
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Political Science', 'Computer Science'];
const STATUS_OPTS = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] as const;
type Status = typeof STATUS_OPTS[number];

const STATUS_COLOR: Record<Status, string> = {
  NOT_STARTED: 'bg-slate-100 text-slate-600',
  IN_PROGRESS:  'bg-amber-100 text-amber-700',
  COMPLETED:    'bg-emerald-100 text-emerald-700',
};
const STATUS_LABEL: Record<Status, string> = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS:  'In Progress',
  COMPLETED:    'Completed',
};

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';
const btnPrimary = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors';
const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'];

const TABS = [
  { id: 'chapters', label: 'Chapter Progress', icon: 'fa-book' },
  { id: 'completion', label: 'Syllabus Completion', icon: 'fa-tasks' },
] as const;

// ── Progress update modal ─────────────────────────────────────────────────────
function ProgressModal({ chapter, onSave, onClose }: { chapter: any; onSave: (dto: any) => Promise<void>; onClose: () => void }) {
  const prog = chapter.progress;
  const [completedTopics, setCompletedTopics] = useState<number>(prog?.completedTopics ?? 0);
  const [status, setStatus] = useState<Status>(prog?.status ?? 'NOT_STARTED');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave({ completedTopics, status }); onClose(); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Update: {chapter.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times text-lg" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Topics Completed ({completedTopics} / {chapter.totalTopics})
            </label>
            <input
              type="range" min={0} max={chapter.totalTopics} value={completedTopics}
              onChange={e => {
                const v = Number(e.target.value);
                setCompletedTopics(v);
                if (v === 0) setStatus('NOT_STARTED');
                else if (v === chapter.totalTopics) setStatus('COMPLETED');
                else setStatus('IN_PROGRESS');
              }}
              className="w-full accent-sky-600"
            />
            <input
              type="number" min={0} max={chapter.totalTopics} value={completedTopics}
              onChange={e => setCompletedTopics(Math.min(chapter.totalTopics, Math.max(0, Number(e.target.value))))}
              className={inputCls + ' mt-2 w-20'}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTS.map(s => (
                <button key={s} type="button"
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${status === s ? STATUS_COLOR[s] + ' border-current' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setStatus(s)}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
              Save
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Chapter modal ─────────────────────────────────────────────────────────
function AddChapterModal({ schoolId, grade, subject, academicYear, onSave, onClose }: {
  schoolId?: string; grade: number; subject: string; academicYear: string;
  onSave: () => void; onClose: () => void;
}) {
  const [form, setForm] = useState({ chapterNo: 1, title: '', totalTopics: 1 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.academic.syllabus.addChapter({ schoolId, grade, subject, academicYear, ...form });
      onSave();
      onClose();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Add Chapter</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-lg" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-rose-600 text-sm">{err}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Chapter No.</label>
              <input required type="number" min={1} className={inputCls} value={form.chapterNo} onChange={e => setForm(f => ({ ...f, chapterNo: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Total Topics</label>
              <input required type="number" min={1} className={inputCls} value={form.totalTopics} onChange={e => setForm(f => ({ ...f, totalTopics: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Chapter Title *</label>
            <input required type="text" className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Real Numbers" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
              Add
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function AcademicProgress() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');

  const { academicYear } = useAcademicYear();
  const [tab, setTab] = useState<'chapters' | 'completion'>('chapters');
  const [scope, setScope] = useState<Scope>({});
  const [grade, setGrade] = useState(9);
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [chapters, setChapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [editChapter, setEditChapter] = useState<any | null>(null);
  const [showAddChapter, setShowAddChapter] = useState(false);

  const schoolId = user?.schoolId ?? scope.schoolId;

  const load = useCallback(() => {
    if (!schoolId && !user?.schoolId) { setChapters([]); return; }
    setLoading(true);
    api.academic.syllabus.list({ schoolId, grade, subject, academicYear })
      .then(setChapters)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, grade, subject, academicYear, user?.schoolId]);

  useEffect(() => { load(); }, [load]);

  async function saveProgress(chapterId: string, dto: { completedTopics: number; status: string }) {
    await api.academic.syllabus.updateProgress(chapterId, dto);
    load();
  }

  async function deleteChapter(id: string) {
    if (!confirm('Remove this chapter?')) return;
    try { await api.academic.syllabus.removeChapter(id); load(); }
    catch (e: any) { setErr(e.message); }
  }

  // Completion stats
  const total = chapters.length;
  const completed = chapters.filter(c => c.progress?.status === 'COMPLETED').length;
  const inProgress = chapters.filter(c => c.progress?.status === 'IN_PROGRESS').length;
  const notStarted = total - completed - inProgress;
  const completionPct = total === 0 ? 0 : Math.round((completed / total) * 100);

  // Per-subject totals for Completion tab
  const topicTotal = chapters.reduce((s, c) => s + (c.totalTopics ?? 1), 0);
  const topicDone = chapters.reduce((s, c) => s + (c.progress?.completedTopics ?? 0), 0);
  const topicPct = topicTotal === 0 ? 0 : Math.round((topicDone / topicTotal) * 100);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <i className="fas fa-tasks text-sky-500" />
          Academic Progress
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Track chapter completion and syllabus progress</p>
      </div>

      <ScopeBar value={scope} onChange={setScope} />

      {/* Tab strip */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fas ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl p-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Grade</label>
          <select className={inputCls + ' w-32'} value={grade} onChange={e => setGrade(Number(e.target.value))}>
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Subject</label>
          <select className={inputCls + ' w-44'} value={subject} onChange={e => setSubject(e.target.value)}>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        {canWrite && tab === 'chapters' && (
          <button className={btnPrimary} onClick={() => setShowAddChapter(true)}>
            <i className="fas fa-plus" />
            Add Chapter
          </button>
        )}
      </div>

      {err && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <i className="fas fa-exclamation-circle" /> {err}
          <button className="ml-auto text-rose-400 hover:text-rose-600" onClick={() => setErr('')}><i className="fas fa-times" /></button>
        </div>
      )}

      {tab === 'chapters' && (
        <>
          {loading ? (
            <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
          ) : chapters.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <i className="fas fa-book text-3xl mb-3 block" />
              No chapters added yet.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-12">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Chapter</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-40">Progress</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 w-32">Status</th>
                    {canWrite && <th className="px-4 py-3 w-24" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chapters.map((c: any) => {
                    const prog = c.progress;
                    const pct = c.totalTopics > 0 ? Math.round(((prog?.completedTopics ?? 0) / c.totalTopics) * 100) : 0;
                    const st: Status = prog?.status ?? 'NOT_STARTED';
                    return (
                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono">{c.chapterNo}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{c.title}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${st === 'COMPLETED' ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-10 text-right">{prog?.completedTopics ?? 0}/{c.totalTopics}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[st]}`}>
                            {STATUS_LABEL[st]}
                          </span>
                        </td>
                        {canWrite && (
                          <td className="px-4 py-3">
                            <div className="flex gap-2 justify-end">
                              <button
                                className="text-xs bg-sky-50 text-sky-600 border border-sky-200 px-2 py-1 rounded hover:bg-sky-100"
                                onClick={() => setEditChapter(c)}
                              >
                                <i className="fas fa-edit" />
                              </button>
                              <button
                                className="text-xs bg-rose-50 text-rose-600 border border-rose-200 px-2 py-1 rounded hover:bg-rose-100"
                                onClick={() => deleteChapter(c.id)}
                              >
                                <i className="fas fa-trash" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'completion' && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Chapters', value: total, color: 'text-slate-700', bg: 'bg-slate-50 border-slate-200' },
              { label: 'Completed', value: completed, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'In Progress', value: inProgress, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
              { label: 'Not Started', value: notStarted, color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200' },
            ].map(card => (
              <div key={card.label} className={`border rounded-xl p-4 ${card.bg}`}>
                <p className="text-xs text-slate-400 mb-1">{card.label}</p>
                <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Chapter completion bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                {subject} – Class {grade} — Chapter Completion
              </span>
              <span className="text-sm font-bold text-sky-600">{completionPct}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="text-xs text-slate-400">{completed} of {total} chapters completed</p>
          </div>

          {/* Topic-level bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">Topic Coverage</span>
              <span className="text-sm font-bold text-sky-600">{topicPct}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${topicPct}%` }} />
            </div>
            <p className="text-xs text-slate-400">{topicDone} of {topicTotal} topics covered</p>
          </div>

          {/* Chapter list with mini bars */}
          {chapters.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <span className="text-sm font-semibold text-slate-600">Chapter-wise Breakdown</span>
              </div>
              <div className="divide-y divide-slate-100">
                {chapters.map((c: any) => {
                  const pct = c.totalTopics > 0 ? Math.round(((c.progress?.completedTopics ?? 0) / c.totalTopics) * 100) : 0;
                  const st: Status = c.progress?.status ?? 'NOT_STARTED';
                  return (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-4">
                      <span className="text-slate-400 text-xs w-8">Ch.{c.chapterNo}</span>
                      <span className="flex-1 text-sm text-slate-700">{c.title}</span>
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${st === 'COMPLETED' ? 'bg-emerald-500' : 'bg-sky-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLOR[st]}`}>{STATUS_LABEL[st]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {editChapter && (
        <ProgressModal
          chapter={editChapter}
          onSave={async (dto) => { await saveProgress(editChapter.id, dto); setEditChapter(null); }}
          onClose={() => setEditChapter(null)}
        />
      )}
      {showAddChapter && (
        <AddChapterModal
          schoolId={schoolId}
          grade={grade}
          subject={subject}
          academicYear={academicYear}
          onSave={load}
          onClose={() => setShowAddChapter(false)}
        />
      )}
    </div>
  );
}
