import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const GRADES = [6, 7, 8, 9, 10, 11, 12];
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Political Science', 'Computer Science'];
const today = new Date().toISOString().slice(0, 10);

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';
const btnPrimary = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors';
const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'];
const STATUS_COLOR: Record<string, string> = {
  ISSUED: 'bg-amber-100 text-amber-700',
};

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isOverdue(due: string) {
  return due < today;
}

const emptyForm = {
  title: '',
  subject: SUBJECTS[0],
  grade: 9,
  gradeTo: undefined as number | undefined,
  gradeMode: 'single' as 'single' | 'range' | 'all',
  description: '',
  dueDate: today,
  attachmentUrl: '',
};

// ── Submission modal ──────────────────────────────────────────────────────────
function SubmissionsModal({ hw, onClose }: { hw: any; onClose: () => void }) {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.academic.homework.submissions(hw.id)
      .then(setSubs)
      .catch(() => setSubs([]))
      .finally(() => setLoading(false));
  }, [hw.id]);

  async function mark(id: string, sid: string) {
    await api.academic.homework.markReviewed(id, sid);
    setSubs(s => s.map(x => x.id === sid ? { ...x, markedDone: true } : x));
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-800">{hw.title}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Class {hw.grade}{hw.gradeTo ? `–${hw.gradeTo}` : ''} · {hw.subject} · Due {fmtDate(hw.dueDate)}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times text-lg" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400"><i className="fas fa-spinner fa-spin text-xl" /></div>
          ) : subs.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No submissions yet.</p>
          ) : subs.map((s: any) => (
            <div key={s.id} className="flex items-start gap-3 bg-slate-50 rounded-xl p-3">
              <div className="flex-1">
                <p className="font-medium text-sm text-slate-800">{s.studentName}</p>
                {s.note && <p className="text-xs text-slate-500 mt-1">{s.note}</p>}
                {s.fileUrl && (
                  <a href={s.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-sky-600 hover:underline mt-1 inline-flex items-center gap-1">
                    <i className="fas fa-paperclip" /> Attachment
                  </a>
                )}
                <p className="text-xs text-slate-400 mt-1">{fmtDate(s.submittedAt?.slice(0, 10) ?? today)}</p>
              </div>
              {s.markedDone ? (
                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Reviewed</span>
              ) : (
                <button
                  className="text-xs bg-sky-50 text-sky-600 border border-sky-200 px-2 py-1 rounded hover:bg-sky-100"
                  onClick={() => mark(hw.id, s.id)}
                >
                  Mark Reviewed
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Submit Homework form (student) ────────────────────────────────────────────
function SubmitModal({ hw, studentId, studentName, onClose }: { hw: any; studentId: string; studentName: string; onClose: () => void }) {
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.academic.homework.submit(hw.id, { studentId, studentName, note });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Submit: {hw.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fas fa-times text-lg" />
          </button>
        </div>
        <div className="p-5">
          {done ? (
            <div className="text-center py-6 space-y-2">
              <i className="fas fa-check-circle text-4xl text-emerald-500" />
              <p className="font-semibold text-slate-800">Submitted!</p>
              <button className="mt-4 text-sm text-sky-600 hover:underline" onClick={onClose}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {hw.description && (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 text-sm text-sky-800">
                  {hw.description}
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Your Answer / Note</label>
                <textarea rows={5} className={inputCls} value={note} onChange={e => setNote(e.target.value)} placeholder="Write your answer here…" />
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={submitting} className={btnPrimary}>
                  {submitting ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
                  Submit
                </button>
                <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function Homework() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const isStudent = role === 'STUDENT';
  const canWrite = WRITE_ROLES.includes(role);

  const { academicYear } = useAcademicYear();
  const [scope, setScope] = useState<Scope>({});
  const [filterGrade, setFilterGrade] = useState<number | undefined>(undefined);
  const [filterSubject, setFilterSubject] = useState('');
  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewSubs, setViewSubs] = useState<any | null>(null);
  const [submitTarget, setSubmitTarget] = useState<any | null>(null);

  const schoolId = user?.schoolId ?? scope.schoolId;

  const load = useCallback(() => {
    // Non-school-bound users must select a school first
    if (!schoolId && !isStudent) { setHomeworks([]); setLoading(false); return; }
    setLoading(true);
    const params: any = { academicYear };
    if (schoolId) params.schoolId = schoolId;
    if (filterGrade) params.grade = filterGrade;
    api.academic.homework.list(params)
      .then(rows => {
        setHomeworks(filterSubject ? rows.filter((r: any) => r.subject === filterSubject) : rows);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, filterGrade, filterSubject, academicYear, isStudent]);

  useEffect(() => { load(); }, [load]);

  const gradeLabel = (hw: any) => hw.gradeTo ? `Class ${hw.grade}–${hw.gradeTo}` : `Class ${hw.grade}`;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const grade = filterGrade ?? (form.gradeMode === 'all' ? GRADES[0] : form.grade);
      const gradeTo = filterGrade ? undefined : (form.gradeMode === 'single' ? undefined : form.gradeMode === 'all' ? GRADES[GRADES.length - 1] : form.gradeTo);
      await api.academic.homework.create({
        schoolId,
        grade,
        gradeTo,
        subject: form.subject,
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate,
        attachmentUrl: form.attachmentUrl || undefined,
        academicYear,
      });
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this homework?')) return;
    try {
      await api.academic.homework.remove(id);
      load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <i className="fas fa-book-open text-sky-500" />
            Homework
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isStudent ? 'View and submit your homework assignments' : 'Assign and manage homework'}
          </p>
        </div>
        {canWrite && (
          <button className={btnPrimary} onClick={() => {
            if (!showForm) {
              setForm({
                ...emptyForm,
                grade: filterGrade ?? emptyForm.grade,
                subject: filterSubject || emptyForm.subject,
              });
            }
            setShowForm(v => !v);
          }}>
            <i className={`fas fa-${showForm ? 'times' : 'plus'}`} />
            {showForm ? 'Cancel' : 'Assign Homework'}
          </button>
        )}
      </div>

      {!isStudent && <ScopeBar value={scope} onChange={setScope} />}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Grade</label>
          <select className={inputCls + ' w-32'} value={filterGrade ?? ''} onChange={e => setFilterGrade(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">All</option>
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500">Subject</label>
          <select className={inputCls + ' w-44'} value={filterSubject} onChange={e => setFilterSubject(e.target.value)}>
            <option value="">All</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {err && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <i className="fas fa-exclamation-circle" /> {err}
          <button className="ml-auto text-rose-400 hover:text-rose-600" onClick={() => setErr('')}>
            <i className="fas fa-times" />
          </button>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-sky-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-700">New Homework Assignment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
              <input required type="text" className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Chapter 5 – Arithmetic Progressions" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject *</label>
              <select required className={inputCls} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
                {SUBJECTS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Due Date *</label>
              <input required type="date" className={inputCls} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
              {filterGrade ? (
                <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-800">
                  <i className="fas fa-graduation-cap text-sky-500" />
                  Class {filterGrade}
                  <span className="ml-auto text-xs text-sky-500">from filter</span>
                </div>
              ) : (
                <>
                  <div className="flex gap-1 mb-2">
                    {(['single', 'range', 'all'] as const).map(m => (
                      <button key={m} type="button"
                        className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${form.gradeMode === m ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                        onClick={() => setForm(f => ({ ...f, gradeMode: m }))}
                      >
                        {m === 'single' ? 'Single' : m === 'range' ? 'Range' : 'All'}
                      </button>
                    ))}
                  </div>
                  {form.gradeMode !== 'all' && (
                    <div className="flex gap-2">
                      <select className={inputCls} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: Number(e.target.value) }))}>
                        {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
                      </select>
                      {form.gradeMode === 'range' && (
                        <>
                          <span className="self-center text-slate-400 text-sm">to</span>
                          <select className={inputCls} value={form.gradeTo ?? form.grade} onChange={e => setForm(f => ({ ...f, gradeTo: Number(e.target.value) }))}>
                            {GRADES.filter(g => g >= form.grade).map(g => <option key={g} value={g}>Class {g}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  )}
                  {form.gradeMode === 'all' && (
                    <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-700">
                      Class {GRADES[0]}–{GRADES[GRADES.length - 1]} (All Classes)
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <textarea rows={3} className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Instructions, notes, reference pages…" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-paper-plane" />}
              Assign
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
      ) : !schoolId && !isStudent ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <i className="fas fa-school text-3xl mb-3 block" />
          Select a school to view homework
        </div>
      ) : homeworks.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <i className="fas fa-book-open text-3xl mb-3 block" />
          No homework found.
        </div>
      ) : (
        <div className="space-y-3">
          {homeworks.map((hw: any) => {
            const overdue = isOverdue(hw.dueDate) && hw.dueDate !== today;
            return (
              <div key={hw.id} className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${overdue ? 'border-rose-200' : 'border-slate-200'}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800">{hw.title}</span>
                    <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{hw.subject}</span>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{gradeLabel(hw)}</span>
                    {overdue && <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">Overdue</span>}
                  </div>
                  {hw.description && <p className="text-sm text-slate-500 line-clamp-2 mb-2">{hw.description}</p>}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                    <span><i className="fas fa-calendar-day mr-1" />Due {fmtDate(hw.dueDate)}</span>
                    <span><i className="fas fa-user mr-1" />{hw.createdByName}</span>
                    {!isStudent && hw._count && (
                      <span><i className="fas fa-check-circle mr-1" />{hw._count.submissions} submissions</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {isStudent ? (
                    <button
                      className="px-3 py-1.5 text-xs font-medium bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
                      onClick={() => setSubmitTarget(hw)}
                    >
                      <i className="fas fa-paper-plane mr-1" />Submit
                    </button>
                  ) : (
                    <>
                      <button
                        className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        onClick={() => setViewSubs(hw)}
                      >
                        <i className="fas fa-list mr-1" />Submissions
                      </button>
                      {canWrite && (
                        <button
                          className="px-3 py-1.5 text-xs font-medium bg-rose-50 text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors"
                          onClick={() => handleDelete(hw.id)}
                        >
                          <i className="fas fa-trash mr-1" />Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewSubs && <SubmissionsModal hw={viewSubs} onClose={() => setViewSubs(null)} />}
      {submitTarget && user && (
        <SubmitModal
          hw={submitTarget}
          studentId={user.studentId ?? user.id}
          studentName={user.name}
          onClose={() => { setSubmitTarget(null); load(); }}
        />
      )}
    </div>
  );
}
