import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';

const ALL_GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const ALL_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F'];

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';
const gradeLabel = (g: number) => `Class ${g}`;

const GRADE_COLORS = [
  '#0076BC', '#1E90FF', '#3AAAC5', '#00BFAE',
  '#34C759', '#32D74B', '#FBBF24', '#F59E0B',
  '#EF4444', '#FF6B35', '#8B5CF6', '#A855F7',
];

export function ClassManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isPrincipal = user?.role === 'PRINCIPAL';
  // Only admin can run the bulk wizard; principals can add/delete their own sections
  const canRunWizard = isAdmin;
  const canManageSections = isAdmin || isPrincipal;

  // Wizard scope (district/block level) — no school needed
  const [wizardScope, setWizardScope] = useState<Scope>({});
  // View scope (school level)
  const [viewScope, setViewScope] = useState<Scope>({});

  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [yearFilter, setYearFilter] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [years, setYears] = useState<any[]>([]);

  // Bulk setup form state
  const [bulk, setBulk] = useState({
    academicYear: '',
    gradeFrom: 6,
    gradeTo: 12,
    sections: ['A', 'B'] as string[],
    capacity: '',
  });

  // School being viewed
  const viewSchoolId = viewScope.schoolId ?? user?.schoolId ?? '';

  // Load years independently on mount
  useEffect(() => {
    api.academicYears().then(yrs => {
      setYears(yrs);
      const cur = yrs.find((y: any) => y.isCurrent);
      if (cur) {
        setYearFilter(cur.label);
        setBulk(b => ({ ...b, academicYear: cur.label }));
      }
    }).catch(() => {});
  }, []);

  // Load sections for the selected school (view panel)
  const loadSections = useCallback(async () => {
    if (!viewSchoolId) { setSections([]); return; }
    setLoading(true);
    try {
      const secs = await api.classSections(viewSchoolId, yearFilter || undefined);
      setSections(secs);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [viewSchoolId, yearFilter]);

  useEffect(() => { loadSections(); }, [loadSections]);

  const toggleSection = (s: string) =>
    setBulk(b => ({
      ...b,
      sections: b.sections.includes(s) ? b.sections.filter(x => x !== s) : [...b.sections, s],
    }));

  const preview = useMemo(() => {
    const grades = Array.from({ length: bulk.gradeTo - bulk.gradeFrom + 1 }, (_, i) => bulk.gradeFrom + i);
    return grades.flatMap(g => bulk.sections.sort().map(s => `${gradeLabel(g)}-${s}`));
  }, [bulk.gradeFrom, bulk.gradeTo, bulk.sections]);

  // Wizard scope description for the info banner
  const wizardScopeLabel = useMemo(() => {
    if (isPrincipal) return 'your school';
    if (wizardScope.schoolId) return 'selected school';
    if (wizardScope.blockId) return 'all schools in selected block';
    if (wizardScope.districtId) return 'all schools in selected district';
    return 'all schools in the state';
  }, [isPrincipal, wizardScope]);

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    if (!bulk.academicYear) { setErr('Select an academic year.'); return; }
    if (bulk.sections.length === 0) { setErr('Select at least one section.'); return; }
    if (bulk.gradeFrom > bulk.gradeTo) { setErr('Grade From must be ≤ Grade To.'); return; }
    setSaving(true);
    try {
      const result = await api.bulkCreateClassSections({
        schoolId: isPrincipal ? (user?.schoolId ?? undefined) : wizardScope.schoolId,
        districtId: !isPrincipal ? wizardScope.districtId : undefined,
        blockId: !isPrincipal ? wizardScope.blockId : undefined,
        academicYear: bulk.academicYear,
        gradeFrom: bulk.gradeFrom,
        gradeTo: bulk.gradeTo,
        sections: [...bulk.sections].sort(),
        capacity: bulk.capacity ? Number(bulk.capacity) : undefined,
      });
      const schoolMsg = result.schools > 1 ? ` across ${result.schools} schools` : '';
      setMsg(`Created ${result.created} class sections${schoolMsg}${result.skipped ? ` (${result.skipped} already existed, skipped)` : ''}.`);
      setShowWizard(false);
      loadSections();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this class section?')) return;
    try { await api.deleteClassSection(id); loadSections(); }
    catch (e: any) { setErr(e.message); }
  };

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
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-chalkboard-teacher" />Academic Structure</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Class Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isPrincipal
              ? "Manage your school's grades and sections"
              : 'Set up class structure at district level — schools can customize their own sections'}
          </p>
        </div>
        {canRunWizard && (
          <button onClick={() => { setShowWizard(s => !s); setMsg(''); setErr(''); }}
            className={showWizard ? 'btn-outline' : 'btn-navy'}>
            {showWizard
              ? <><i className="fas fa-times" />Close</>
              : <><i className="fas fa-layer-group" />Setup Classes</>}
          </button>
        )}
      </div>

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* ── Setup Wizard ── */}
      {showWizard && canRunWizard && (
        <form onSubmit={handleBulkSubmit} className="panel p-5 space-y-5 border-l-4 border-l-sky-500">
          <div>
            <h2 className="font-semibold text-slate-800 text-base mb-0.5">
              <i className="fas fa-layer-group text-sky-500 mr-2" />Class Setup Wizard
            </h2>
            <p className="text-xs text-slate-500">
              Sections will be created for <strong>{wizardScopeLabel}</strong>. Schools can add or remove sections from their own login.
            </p>
          </div>

          {/* Scope selector — only for state/district roles */}
          {!isPrincipal && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                Apply To
              </label>
              <ScopeBar value={wizardScope} onChange={setWizardScope} />
              <p className="text-xs text-slate-400 mt-1.5">
                {wizardScope.schoolId
                  ? 'Will create for this school only.'
                  : wizardScope.blockId
                    ? 'Will create for all schools in the selected block.'
                    : wizardScope.districtId
                      ? 'Will create for all schools in the selected district.'
                      : 'No district/block selected — will create for ALL schools in the state.'}
              </p>
            </div>
          )}

          {/* Step 1 — Academic Year */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              1. Academic Year *
            </label>
            <div className="flex flex-wrap gap-2">
              {years.map(y => (
                <button key={y.id} type="button"
                  onClick={() => setBulk(b => ({ ...b, academicYear: y.label }))}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                    bulk.academicYear === y.label
                      ? 'bg-navy-700 text-white border-navy-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                  }`}>
                  {y.label}{y.isCurrent ? ' ★' : ''}
                </button>
              ))}
              {years.length === 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  No academic years yet — add one in Academic Years first.
                </span>
              )}
            </div>
          </div>

          {/* Step 2 — Grade Range */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              2. Grade Range *
            </label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">From</span>
                <select className={inputCls + ' w-32'} value={bulk.gradeFrom}
                  onChange={e => setBulk(b => ({ ...b, gradeFrom: Number(e.target.value), gradeTo: Math.max(Number(e.target.value), b.gradeTo) }))}>
                  {ALL_GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">To</span>
                <select className={inputCls + ' w-32'} value={bulk.gradeTo}
                  onChange={e => setBulk(b => ({ ...b, gradeTo: Number(e.target.value), gradeFrom: Math.min(b.gradeFrom, Number(e.target.value)) }))}>
                  {ALL_GRADES.map(g => <option key={g} value={g}>{gradeLabel(g)}</option>)}
                </select>
              </div>
              <span className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded px-2 py-1">
                {bulk.gradeTo - bulk.gradeFrom + 1} grade{bulk.gradeTo - bulk.gradeFrom + 1 !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Step 3 — Sections */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              3. Sections per Grade *
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_SECTIONS.map(s => (
                <button key={s} type="button" onClick={() => toggleSection(s)}
                  className={`w-11 h-11 rounded-lg font-bold text-sm border-2 transition-all ${
                    bulk.sections.includes(s)
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-sky-300'
                  }`}>
                  {s}
                </button>
              ))}
              <span className="self-center text-xs text-slate-400 ml-2">
                {bulk.sections.length} selected
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Schools with fewer sections can remove the extras from their own login.
            </p>
          </div>

          {/* Step 4 — Capacity */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
              4. Students per Section (optional)
            </label>
            <input type="number" min="1" max="100" className={inputCls + ' w-36'}
              value={bulk.capacity} onChange={e => setBulk(b => ({ ...b, capacity: e.target.value }))}
              placeholder="e.g. 40" />
          </div>

          {/* Preview */}
          {preview.length > 0 && bulk.academicYear && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                Preview — {preview.length} sections per school · {bulk.academicYear}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {preview.map(label => (
                  <span key={label} className="text-xs font-medium bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving || !bulk.academicYear || bulk.sections.length === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-check" />}
              {saving ? 'Creating…' : `Create ${preview.length} Sections${!isPrincipal ? ' for All Schools' : ''}`}
            </button>
            <button type="button" onClick={() => setShowWizard(false)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* ── View Panel — select a school to inspect ── */}
      <div className="panel p-4 space-y-4">
        <div className="flex items-center gap-2">
          <i className="fas fa-school text-sky-500 text-sm" />
          <span className="font-semibold text-sm text-slate-700">
            {isPrincipal ? "Your School's Classes" : "View a School's Classes"}
          </span>
          {!isPrincipal && (
            <span className="text-xs text-slate-400 ml-1">— select a school below to inspect or customize its sections</span>
          )}
        </div>

        {!isPrincipal && <ScopeBar value={viewScope} onChange={setViewScope} />}

        {/* Year filter */}
        {years.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Year:</span>
            {years.map(y => (
              <button key={y.id} onClick={() => setYearFilter(y.label)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  yearFilter === y.label ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}>
                {y.label}{y.isCurrent ? ' ★' : ''}
              </button>
            ))}
            <button onClick={() => setYearFilter('')}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                !yearFilter ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}>All</button>
          </div>
        )}

        {/* Stats */}
        {viewSchoolId && sections.length > 0 && (
          <div className="flex flex-wrap gap-3">
            <div className="bg-slate-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="font-bold text-slate-700">{sections.length}</span>
              <span className="text-xs text-slate-500">Sections</span>
            </div>
            <div className="bg-slate-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="font-bold text-slate-700">{sortedGrades.length}</span>
              <span className="text-xs text-slate-500">Grades</span>
            </div>
            {totalStudents > 0 && (
              <div className="bg-slate-50 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="font-bold text-slate-700">{totalStudents.toLocaleString()}</span>
                <span className="text-xs text-slate-500">Students</span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {!viewSchoolId && (
          <div className="py-8 text-center text-slate-400">
            <i className="fas fa-school text-2xl mb-2 block text-slate-200" />
            <p className="text-sm text-slate-400">
              {isPrincipal ? 'Loading your school…' : 'Select a district and school to view classes'}
            </p>
          </div>
        )}
        {viewSchoolId && !loading && sections.length === 0 && (
          <div className="py-8 text-center">
            <i className="fas fa-chalkboard-teacher text-2xl mb-2 block text-slate-300" />
            <p className="text-sm text-slate-500 font-medium">No class sections for this school yet</p>
            {canRunWizard && (
              <button onClick={() => { setShowWizard(true); setWizardScope(viewScope); }}
                className="mt-3 btn-primary text-sm">
                <i className="fas fa-layer-group" />Setup Classes Now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Grade grid */}
      {viewSchoolId && (
        <div className="space-y-4">
          {sortedGrades.map(grade => {
            const secs = byGrade[grade];
            const color = GRADE_COLORS[(grade - 1) % GRADE_COLORS.length];
            return (
              <div key={grade} className="panel overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: color }}>
                      {grade}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{gradeLabel(grade)}</h3>
                      <p className="text-xs text-slate-400">{secs.length} section{secs.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {/* School can add an individual section to this grade */}
                  {canManageSections && (
                    <button
                      onClick={async () => {
                        const sec = prompt(`Add a section to ${gradeLabel(grade)} (e.g. E):`);
                        if (!sec) return;
                        try {
                          await api.createClassSection(viewSchoolId, { grade, section: sec.toUpperCase(), academicYear: yearFilter || years.find(y => y.isCurrent)?.label || '' });
                          loadSections();
                        } catch (ex: any) { setErr(ex.message); }
                      }}
                      className="text-xs text-sky-600 hover:text-sky-800 font-medium flex items-center gap-1 px-2 py-1 rounded hover:bg-sky-50">
                      <i className="fas fa-plus" />Add Section
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-4">
                  {secs.sort((a, b) => a.section.localeCompare(b.section)).map(s => (
                    <div key={s.id} className="relative group border border-slate-200 rounded-xl p-3 hover:border-sky-300 hover:shadow-sm transition-all bg-white">
                      <div className="text-center">
                        <div className="text-lg font-bold text-slate-700 mb-0.5">
                          {gradeLabel(s.grade)}-{s.section}
                        </div>
                        {s.stream && <div className="text-[10px] text-slate-400 font-medium">{s.stream}</div>}
                        {s.capacity && <div className="text-xs text-slate-400">Cap: {s.capacity}</div>}
                        {s._count?.students > 0 && (
                          <div className="text-xs text-sky-600 font-medium mt-1">
                            <i className="fas fa-users mr-0.5 text-[10px]" />{s._count.students}
                          </div>
                        )}
                        {s.classTeacherId && (
                          <div className="text-[10px] text-emerald-600 font-medium mt-1">
                            <i className="fas fa-user-tie mr-0.5" />CT Assigned
                          </div>
                        )}
                      </div>
                      {canManageSections && (
                        <button onClick={() => handleDelete(s.id)}
                          title="Remove this section from school"
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
      )}
    </div>
  );
}
