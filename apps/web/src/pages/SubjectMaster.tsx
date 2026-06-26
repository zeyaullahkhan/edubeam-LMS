import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'];
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const STREAMS = ['', 'Science', 'Commerce', 'Arts', 'Vocational'];

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

const SUBJECT_COLORS: Record<string, string> = {
  Mathematics:   '#0076BC', Math: '#0076BC',
  Science:       '#34C759', Physics: '#34C759', Chemistry: '#00BFAE', Biology: '#32D74B',
  English:       '#8B5CF6', Hindi: '#F59E0B', Sanskrit: '#EF4444',
  'Social Science': '#FF6B35', History: '#FF6B35', Geography: '#FBBF24', Civics: '#F59E0B',
  Computer:      '#1E90FF', default: '#94A3B8',
};

function subjectColor(name: string): string {
  const key = Object.keys(SUBJECT_COLORS).find(k => name.toLowerCase().includes(k.toLowerCase()));
  return key ? SUBJECT_COLORS[key] : SUBJECT_COLORS.default;
}

export function SubjectMaster() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');

  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editSubject, setEditSubject] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', code: '', grade: '', stream: '', maxMarks: '100', isElective: false });
  const [gradeFilter, setGradeFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setSubjects(await api.schoolSubjects()); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ name: '', code: '', grade: '', stream: '', maxMarks: '100', isElective: false }); setEditSubject(null); setShowForm(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || undefined,
        grade: form.grade ? Number(form.grade) : undefined,
        stream: form.stream || undefined,
        maxMarks: Number(form.maxMarks),
        isElective: form.isElective,
      };
      if (editSubject) {
        await api.updateSubject(editSubject.id, payload);
        setMsg('Subject updated.');
      } else {
        await api.createSubject(payload);
        setMsg('Subject created.');
      }
      resetForm();
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Remove this subject? It will be deactivated.')) return;
    try { await api.deleteSubject(id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const startEdit = (s: any) => {
    setEditSubject(s);
    setForm({ name: s.name, code: s.code ?? '', grade: s.grade ? String(s.grade) : '', stream: s.stream ?? '', maxMarks: String(s.maxMarks ?? 100), isElective: s.isElective ?? false });
    setShowForm(true);
  };

  const filtered = useMemo(() => {
    if (!gradeFilter) return subjects;
    return subjects.filter(s => String(s.grade ?? '') === gradeFilter || (!s.grade && gradeFilter === 'all-grades'));
  }, [subjects, gradeFilter]);

  const gradesPresent = useMemo(() => {
    const set = new Set<string>();
    subjects.forEach(s => set.add(s.grade ? String(s.grade) : ''));
    return Array.from(set).sort((a, b) => Number(a || 99) - Number(b || 99));
  }, [subjects]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-book-open" />Curriculum</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Subject Master</h1>
          <p className="text-sm text-slate-500 mt-1">Define subjects offered — used for homework, results, and curriculum tracking</p>
        </div>
        {canWrite && (
          <button onClick={() => { resetForm(); setShowForm(s => !s); }} className={showForm && !editSubject ? 'btn-outline' : 'btn-navy'}>
            {showForm && !editSubject ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Add Subject</>}
          </button>
        )}
      </div>

      {msg &&<div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* Create / Edit form */}
      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="panel p-5 space-y-4 border-l-4 border-l-sky-500">
          <h2 className="font-semibold text-slate-700">
            <i className="fas fa-edit text-sky-500 mr-1.5" />{editSubject ? 'Edit Subject' : 'New Subject'}
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Name *</label>
              <input required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Code (optional)</label>
              <input className={inputCls} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATH101" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grade (leave blank = all grades)</label>
              <select className={inputCls} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                <option value="">All grades</option>
                {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stream (optional)</label>
              <select className={inputCls} value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })}>
                {STREAMS.map(s => <option key={s} value={s}>{s || 'General'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Max Marks</label>
              <input type="number" min="1" max="1000" className={inputCls} value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input type="checkbox" id="isElective" checked={form.isElective} onChange={e => setForm({ ...form, isElective: e.target.checked })} className="rounded" />
              <label htmlFor="isElective" className="text-sm text-slate-700 cursor-pointer">Elective subject</label>
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
              {editSubject ? 'Update' : 'Create'}
            </button>
            <button type="button" onClick={resetForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* Grade filter */}
      {gradesPresent.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Filter by grade:</span>
          <button onClick={() => setGradeFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !gradeFilter ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>All</button>
          {gradesPresent.filter(Boolean).map(g => (
            <button key={g} onClick={() => setGradeFilter(g)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                gradeFilter === g ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>Class {g}</button>
          ))}
        </div>
      )}

      {/* Empty states */}
      {!loading && subjects.length === 0 && (
        <div className="py-12 text-center panel text-slate-400">
          <i className="fas fa-book-open text-3xl mb-2 block text-slate-300" />
          <p className="font-semibold text-slate-500">No subjects defined yet</p>
          {canWrite && <p className="text-xs mt-1">Click "Add Subject" to start building the subject master.</p>}
        </div>
      )}

      {/* Subject grid */}
      {filtered.length > 0 && (
        <>
          <p className="text-xs text-slate-400">{filtered.length} subject{filtered.length !== 1 ? 's' : ''}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(s => {
              const color = subjectColor(s.name);
              return (
                <div key={s.id} className="panel p-4 flex items-start gap-3 group hover:shadow-md transition-shadow">
                  <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                    style={{ backgroundColor: color }}>
                    {(s.code || s.name).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-800 text-sm leading-tight">{s.name}</span>
                      {s.isElective && (
                        <span className="shrink-0 text-[10px] font-semibold text-violet-600 bg-violet-100 rounded-full px-1.5 py-0.5">Elective</span>
                      )}
                    </div>
                    {s.code && <p className="text-xs text-slate-400 font-mono mt-0.5">{s.code}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-400">
                      {s.grade ? <span><i className="fas fa-graduation-cap mr-0.5" />Class {s.grade}</span> : <span>All grades</span>}
                      {s.stream && <span><i className="fas fa-tag mr-0.5" />{s.stream}</span>}
                      <span><i className="fas fa-star-half-alt mr-0.5" />{s.maxMarks} marks</span>
                    </div>
                  </div>
                  {canWrite && (
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <button onClick={() => startEdit(s)} className="text-slate-300 hover:text-sky-500 transition-colors p-1">
                        <i className="fas fa-edit text-xs" />
                      </button>
                      <button onClick={() => handleDeactivate(s.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1">
                        <i className="fas fa-trash text-xs" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
