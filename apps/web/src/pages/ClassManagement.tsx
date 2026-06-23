import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'];
const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];
const STREAMS = ['', 'Science', 'Commerce', 'Arts'];

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

const gradeLabel = (g: number) => `Class ${g}`;

const GRADE_COLORS = [
  '#0076BC', '#1E90FF', '#3AAAC5', '#00BFAE',
  '#34C759', '#32D74B', '#FBBF24', '#F59E0B',
  '#EF4444', '#FF6B35', '#8B5CF6', '#A855F7',
];

export function ClassManagement() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');

  const [scope, setScope] = useState<Scope>({});
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ grade: 1, section: 'A', academicYear: '', capacity: '', stream: '', classTeacherId: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [years, setYears] = useState<any[]>([]);

  const schoolId = scope.schoolId ?? user?.schoolId ?? '';

  const load = useCallback(async () => {
    if (!schoolId) { setSections([]); return; }
    setLoading(true);
    try {
      const [secs, yrs] = await Promise.all([
        api.classSections(schoolId, yearFilter || undefined),
        api.academicYears(schoolId),
      ]);
      setSections(secs);
      setYears(yrs);
      const cur = yrs.find((y: any) => y.isCurrent);
      if (cur && !yearFilter) setYearFilter(cur.label);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [schoolId, yearFilter]);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!schoolId) { setErr('Select a school first.'); return; }
    setSaving(true);
    try {
      await api.createClassSection(schoolId, {
        grade: Number(form.grade),
        section: form.section,
        academicYear: form.academicYear,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        stream: form.stream || undefined,
        classTeacherId: form.classTeacherId || undefined,
      });
      setMsg('Class section created.');
      setShowForm(false);
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this class section? This cannot be undone.')) return;
    try { await api.deleteClassSection(id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  // Group sections by grade
  const byGrade = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const s of sections) {
      if (!map[s.grade]) map[s.grade] = [];
      map[s.grade].push(s);
    }
    return map;
  }, [sections]);

  const sortedGrades = Object.keys(byGrade).map(Number).sort((a, b) => a - b);
  const totalStudents = sections.reduce((sum, s) => sum + (s._count?.students ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-chalkboard-teacher" />Academic Structure</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Class Management</h1>
          <p className="text-sm text-slate-500 mt-1">Grade and section structure for each academic year</p>
        </div>
        {canWrite && (
          <button onClick={() => setShowForm(s => !s)} className={showForm ? 'btn-outline' : 'btn-navy'}>
            {showForm ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Add Section</>}
          </button>
        )}
      </div>

      <ScopeBar value={scope} onChange={setScope} />

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* Year filter */}
      {years.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Academic Year:</span>
          {years.map(y => (
            <button key={y.id} onClick={() => setYearFilter(y.label)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                yearFilter === y.label ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>
              {y.label}{y.isCurrent ? ' ★' : ''}
            </button>
          ))}
          <button onClick={() => setYearFilter('')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              !yearFilter ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>All</button>
        </div>
      )}

      {/* Summary chips */}
      {sections.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="panel px-4 py-2 flex items-center gap-2">
            <span className="text-lg font-bold text-slate-800">{sections.length}</span>
            <span className="text-xs text-slate-500">Sections</span>
          </div>
          <div className="panel px-4 py-2 flex items-center gap-2">
            <span className="text-lg font-bold text-slate-800">{sortedGrades.length}</span>
            <span className="text-xs text-slate-500">Grades</span>
          </div>
          {totalStudents > 0 && (
            <div className="panel px-4 py-2 flex items-center gap-2">
              <span className="text-lg font-bold text-slate-800">{totalStudents.toLocaleString()}</span>
              <span className="text-xs text-slate-500">Students enrolled</span>
            </div>
          )}
        </div>
      )}

      {/* Create form */}
      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="panel p-5 space-y-4 border-l-4 border-l-sky-500">
          <h2 className="font-semibold text-slate-700"><i className="fas fa-plus-circle text-sky-500 mr-1.5" />New Class Section</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grade *</label>
              <select required className={inputCls} value={form.grade} onChange={e => setForm({ ...form, grade: Number(e.target.value) })}>
                {GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Section *</label>
              <select required className={inputCls} value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                {SECTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Academic Year *</label>
              <select required className={inputCls} value={form.academicYear} onChange={e => setForm({ ...form, academicYear: e.target.value })}>
                <option value="">Select year...</option>
                {years.map(y => <option key={y.id} value={y.label}>{y.label}{y.isCurrent ? ' (Current)' : ''}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stream (optional)</label>
              <select className={inputCls} value={form.stream} onChange={e => setForm({ ...form, stream: e.target.value })}>
                {STREAMS.map(s => <option key={s} value={s}>{s || 'General'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Capacity (optional)</label>
              <input type="number" min="1" max="100" className={inputCls} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} placeholder="e.g. 40" />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}Create Section
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* Empty states */}
      {!schoolId && (
        <div className="py-12 text-center panel text-slate-400">
          <i className="fas fa-school text-3xl mb-2 block text-slate-300" />
          <p className="font-semibold text-slate-500">Select a school to view classes</p>
        </div>
      )}
      {schoolId && !loading && sections.length === 0 && (
        <div className="py-12 text-center panel text-slate-400">
          <i className="fas fa-chalkboard-teacher text-3xl mb-2 block text-slate-300" />
          <p className="font-semibold text-slate-500">No class sections defined yet</p>
          {canWrite && <p className="text-xs mt-1">Click "Add Section" to create class sections.</p>}
        </div>
      )}

      {/* Grade grid */}
      <div className="space-y-4">
        {sortedGrades.map(grade => {
          const secs = byGrade[grade];
          const color = GRADE_COLORS[(grade - 1) % GRADE_COLORS.length];
          return (
            <div key={grade} className="panel overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: color }}>
                  {grade}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{gradeLabel(grade)}</h3>
                  <p className="text-xs text-slate-400">{secs.length} section{secs.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
                {secs.map(s => (
                  <div key={s.id} className="relative group border border-slate-200 rounded-xl p-3 hover:border-sky-300 hover:shadow-sm transition-all bg-white">
                    <div className="text-center">
                      <div className="text-lg font-bold text-slate-700 mb-0.5">
                        {gradeLabel(s.grade)}-{s.section}
                      </div>
                      {s.stream && <div className="text-[10px] text-slate-400 font-medium mb-1">{s.stream}</div>}
                      {s.capacity && (
                        <div className="text-xs text-slate-400">Cap: {s.capacity}</div>
                      )}
                      {s.classTeacherId && (
                        <div className="text-[10px] text-sky-600 font-medium mt-1">
                          <i className="fas fa-user-tie mr-0.5" />Class Teacher
                        </div>
                      )}
                    </div>
                    {canWrite && (
                      <button onClick={() => handleDelete(s.id)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1">
                        <i className="fas fa-times text-xs" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
