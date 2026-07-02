import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { useAcademicYear } from '../contexts/AcademicYearContext';

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';
const btnPrimary = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors';
const btnDanger = 'px-2 py-1 rounded text-xs bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors';

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'];

export function TeacherAllocation() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');
  const isSchoolBound = !!user?.schoolId;

  const { academicYear } = useAcademicYear();
  const [scope, setScope] = useState<Scope>({});
  const [allocations, setAllocations] = useState<any[]>([]);
  const [classSections, setClassSections] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]); // Staff[]
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ staffId: '', classSectionId: '', subjectId: '' });
  const [saving, setSaving] = useState(false);

  const schoolId = user?.schoolId ?? scope.schoolId;

  const load = useCallback(() => {
    if (!schoolId && !isSchoolBound) return;
    setLoading(true);
    api.academic.allocations.list(schoolId, academicYear)
      .then(setAllocations)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, academicYear, isSchoolBound]);

  useEffect(() => { load(); }, [load]);

  // Load school resources when school is known
  useEffect(() => {
    if (!schoolId) return;
    api.staff.list({ schoolId }).then(setStaff).catch(() => setStaff([]));
    api.classSections(schoolId, academicYear).then(setClassSections).catch(() => setClassSections([]));
    api.schoolSubjects(user?.tenantId ?? undefined)
      .then(subs => {
        // deduplicate by name (same subject can exist for multiple grades)
        const seen = new Set<string>();
        setSubjects((subs as any[]).filter(s => { if (seen.has(s.name)) return false; seen.add(s.name); return true; }));
      })
      .catch(() => setSubjects([]));
  }, [schoolId, academicYear, user?.tenantId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.staffId || !form.classSectionId || !form.subjectId) return;
    setSaving(true);
    try {
      await api.academic.allocations.create({ ...form, academicYear, schoolId });
      setShowForm(false);
      setForm({ staffId: '', classSectionId: '', subjectId: '' });
      load();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this allocation?')) return;
    try {
      await api.academic.allocations.remove(id);
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
            <i className="fas fa-user-tie text-sky-500" />
            Teacher Allocation
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Assign teachers to class sections and subjects</p>
        </div>
        {canWrite && (
          <button className={btnPrimary} onClick={() => setShowForm(v => !v)}>
            <i className={`fas fa-${showForm ? 'times' : 'plus'}`} />
            {showForm ? 'Cancel' : 'Add Allocation'}
          </button>
        )}
      </div>

      <ScopeBar value={scope} onChange={setScope} />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <i className="fas fa-calendar-alt text-sky-500" />
          Academic Year: <span className="font-semibold text-sky-700">{academicYear}</span>
          <span className="text-xs text-slate-400">(change in the top bar)</span>
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

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border border-sky-200 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-slate-700">New Allocation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Staff Member</label>
              <select required className={inputCls} value={form.staffId} onChange={e => setForm(f => ({ ...f, staffId: e.target.value }))}>
                <option value="">Select staff…</option>
                {staff.map((s: any) => <option key={s.id} value={s.id}>{s.name} — {s.designation ?? 'Teacher'}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Class Section</label>
              <select required className={inputCls} value={form.classSectionId} onChange={e => setForm(f => ({ ...f, classSectionId: e.target.value }))}>
                <option value="">
                  {classSections.length === 0 && schoolId ? 'No sections found — create them in Classes' : 'Select class section…'}
                </option>
                {classSections.map((c: any) => <option key={c.id} value={c.id}>Class {c.grade} – {c.section}</option>)}
              </select>
              {classSections.length === 0 && schoolId && (
                <p className="text-xs text-amber-600 mt-1">
                  <i className="fas fa-info-circle mr-1" />
                  No class sections for this school/year. Go to <a href="/classes" className="underline">Classes</a> to create them first.
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
              <select required className={inputCls} value={form.subjectId} onChange={e => setForm(f => ({ ...f, subjectId: e.target.value }))}>
                <option value="">Select subject…</option>
                {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Academic Year</label>
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-sm text-sky-800">
                <i className="fas fa-calendar-alt text-sky-500" />
                {academicYear}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-check" />}
              Save Allocation
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
      ) : !schoolId && !isSchoolBound ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <i className="fas fa-school text-3xl mb-3 block" />
          Select a school to view allocations
        </div>
      ) : allocations.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          <i className="fas fa-user-tie text-3xl mb-3 block" />
          No allocations found. Add one above.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Staff</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Class / Section</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Subject</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Academic Year</th>
                {canWrite && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allocations.map((a: any) => (
                <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800">{a.staffId}</td>
                  <td className="px-4 py-3 text-slate-600">
                    Class {a.classSection?.grade} – {a.classSection?.section}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{a.subject?.name ?? a.subject}</td>
                  <td className="px-4 py-3 text-slate-500">{a.academicYear}</td>
                  {canWrite && (
                    <td className="px-4 py-3 text-right">
                      <button className={btnDanger} onClick={() => handleDelete(a.id)}>
                        <i className="fas fa-trash" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
