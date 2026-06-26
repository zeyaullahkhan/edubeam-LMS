import { useEffect, useMemo, useState } from 'react';
import {
  GENDERS, GENDER_LABELS, STAFF_TYPES, STAFF_TYPE_LABELS,
  type Staff as StaffMember, type StaffDemographics, type TeacherStats,
} from '@edubeam/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { exportCsv } from '../export';
import { parseCsv, readFileText } from '../csv';
import { downloadStaffTemplate, parseUploadFile } from '../excel';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { Attendance } from './Attendance';
import { ConfirmDialog } from '../components/ConfirmDialog';

type SubPage = 'list' | 'attendance';
const SUB_TABS: { id: SubPage; label: string; icon: string }[] = [
  { id: 'list',       label: 'Staff List',  icon: 'fas fa-list' },
  { id: 'attendance', label: 'Attendance',  icon: 'fas fa-user-check' },
];

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'PRINCIPAL'];
const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

const TYPE_ICONS: Record<string, string> = {
  PRINCIPAL: 'fas fa-user-tie',
  TEACHER: 'fas fa-chalkboard-teacher',
  FACULTY: 'fas fa-user-graduate',
  LAB_ASSISTANT: 'fas fa-laptop-code',
};

const emptyStaff: Partial<StaffMember> = {
  name: '', gender: 'M', staffType: 'TEACHER', designation: '', qualification: '',
  subjects: '', phone: '', email: '', department: '', salaryGroup: '', isClassTeacher: false, classTeacherOf: '',
};

export function Staff() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');
  const [subPage, setSubPage] = useState<SubPage>('list');
  const needsSchool = user?.role === 'ADMIN' || user?.role === 'STATE_OFFICIAL' || user?.role === 'DISTRICT_OFFICIAL';

  const [scope, setScope] = useState<Scope>({});
  const [rows, setRows] = useState<StaffMember[]>([]);
  const [summary, setSummary] = useState<StaffDemographics | null>(null);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [staffType, setStaffType] = useState('');
  const [q, setQ] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<StaffMember>>(emptyStaff);
  const [msg, setMsg] = useState('');
  const [confirmStaff, setConfirmStaff] = useState<StaffMember | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  const filter = useMemo(
    () => ({ ...scope, staffType: staffType || undefined, q: q || undefined }),
    [scope, staffType, q],
  );

  // Only load list when a scope is actively selected OR the user has a fixed scope (principal/district)
  const hasScope = !!(scope.districtId || scope.blockId || scope.schoolId || user?.schoolId || user?.districtId);

  const load = () => {
    if (!hasScope) { setRows([]); setSummary(null); setLoading(false); return; }
    setLoading(true);
    Promise.all([api.staff.list(filter), api.staff.summary(scope)])
      .then(([r, s]) => { setRows(r); setSummary(s); })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  // Reload real ICT teacher stats whenever district scope changes
  useEffect(() => {
    api.teacherStats(scope.districtId).then(setTeacherStats).catch(() => {});
  }, [scope.districtId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [JSON.stringify(filter), hasScope]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await api.staff.create({ ...form, schoolId: scope.schoolId });
      setMsg(`${form.name} added to staff.`);
      setForm(emptyStaff);
      setShowForm(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onBulk = async (file: File) => {
    setErr(''); setMsg('');
    try {
      const rows = file.name.endsWith('.csv')
        ? parseCsv(await readFileText(file)).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), String(v)])))
        : await parseUploadFile(file);
      // Validate required fields
      const validationErrors: string[] = [];
      rows.forEach((r, i) => {
        const rowNum = i + 3;
        if (!r.fullname && !r.name) validationErrors.push(`Row ${rowNum}: Name is required`);
        const gv = (r.gender || '').toUpperCase().charAt(0);
        if (gv !== 'M' && gv !== 'F') validationErrors.push(`Row ${rowNum}: Gender must be M or F`);
        if (!(r.stafftype || r.type || '').trim()) validationErrors.push(`Row ${rowNum}: Staff Type is required`);
      });
      if (validationErrors.length > 0) {
        const shown = validationErrors.slice(0, 8);
        const more = validationErrors.length - shown.length;
        setErr(shown.join('\n') + (more > 0 ? `\n…and ${more} more issue(s)` : ''));
        return;
      }

      const parsed = rows.map((r) => ({
        name: r.fullname || r.name,
        gender: (r.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
        staffType: (r.stafftype || r.type || 'TEACHER').toUpperCase().replace(/[\s-]+/g, '_'),
        designation: r.designation || null,
        qualification: r.qualification || null,
        subjects: r.subjects || null,
        phone: r.phone || null,
        email: r.email || null,
        department: r.department || null,
        salaryGroup: r.salarygroup || null,
        employeeId: r.employeeid || null,
        aadhaarNo: r.aadhaarno || null,
        dateOfBirth: r.dateofbirth || null,
        joiningDate: r.joiningdate || null,
        contractType: r.contracttype || null,
        isClassTeacher: /^(y|yes|true|1)$/i.test(r.classteacheryesno || r.isclassteacher || ''),
        classTeacherOf: r.classteacherof || null,
        address: r.address || null,
        bankAccount: r.bankaccountno || r.bankaccount || null,
        ifscCode: r.ifsccode || null,
      }));
      const res = await api.staff.bulk(scope.schoolId, parsed as Partial<StaffMember>[]);
      setMsg(`Imported ${res.inserted} staff${res.skipped ? `, skipped ${res.skipped}` : ''}.`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const toggleClassTeacher = async (s: StaffMember) => {
    try { await api.staff.update(s.id, { isClassTeacher: !s.isClassTeacher }); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const remove = async (s: StaffMember) => {
    try { await api.staff.remove(s.id); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      {/* Sub-page tab bar */}
      <div className="flex gap-1 border-b border-slate-200">
        {SUB_TABS.map(t => (
          <button key={t.id} onClick={() => setSubPage(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subPage === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <i className={t.icon} />{t.label}
          </button>
        ))}
      </div>

      {subPage === 'attendance' && <Attendance mode="staff" />}

      {subPage === 'list' && <>
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-chalkboard-teacher" />Staff Registry</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Staff</h1>
          <p className="text-sm text-slate-500 mt-1">Teachers, faculty, lab assistants &amp; role assignment · 2025–26</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canWrite && (
            <>
              <button onClick={downloadStaffTemplate} className="btn-outline" title="Download Excel template">
                <i className="fas fa-file-excel text-emerald-600" />Template
              </button>
              <label className="btn-outline cursor-pointer" title="Upload filled Excel template">
                <i className="fas fa-file-import" />Bulk Upload
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onBulk(e.target.files[0])} />
              </label>
              <button onClick={() => setShowForm((s) => !s)} className={showForm ? 'btn-outline' : 'btn-navy'}>
                {showForm ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-user-plus" />Add Staff</>}
              </button>
            </>
          )}
          <button
            onClick={() => exportCsv('staff', rows.map((s) => ({
              Name: s.name, Type: STAFF_TYPE_LABELS[s.staffType], Designation: s.designation ?? '',
              Qualification: s.qualification ?? '', Subjects: s.subjects ?? '', Department: s.department ?? '',
              'Class Teacher': s.isClassTeacher ? (s.classTeacherOf ?? 'Yes') : 'No', Phone: s.phone ?? '',
              'Salary Group': s.salaryGroup ?? '', School: s.school ?? '',
            })))}
            className="btn-outline"
          >
            <i className="fas fa-download" />Export
          </button>
        </div>
      </div>

      <ScopeBar value={scope} onChange={setScope} />

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle mt-0.5 shrink-0" /><span className="whitespace-pre-line">{err}</span></div>}

      {/* Real ICT teacher stats */}
      {teacherStats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DemoCard
              label="Total Teachers"
              value={teacherStats.totalTeachers.toLocaleString()}
              sub="From ICT deployment data · Real"
              icon="fas fa-chalkboard-teacher"
              accent="linear-gradient(135deg,#003087,#0076BC)"
              badge="live"
            />
            <DemoCard
              label="ICT Lab Schools"
              value={teacherStats.ictSchools.toLocaleString()}
              sub="Schools with ICT labs"
              icon="fas fa-laptop-code"
              accent="linear-gradient(135deg,#7C3AED,#9F67E8)"
              badge="live"
            />
            <DemoCard
              label="ICT Students"
              value={teacherStats.totalStudents.toLocaleString()}
              sub="Students in ICT schools"
              icon="fas fa-user-graduate"
              accent="linear-gradient(135deg,#065f46,#059669)"
              badge="live"
            />
          </div>

          {/* District-wise teacher breakdown — only visible at state level */}
          {!scope.districtId && teacherStats.byDistrict.length > 0 && (
            <div className="panel overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-heading font-semibold text-navy-700">
                  Teachers by District
                  <span className="ml-2 text-sm font-normal text-slate-400">(ICT deployment · real data)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">Select a district in the Scope bar to filter all data below</p>
              </div>
              <table className="w-full text-sm data-table" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: 'auto' }} />
                  <col style={{ width: '100px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-left">District</th>
                    <th className="text-right">ICT Schools</th>
                    <th className="text-right">Teachers</th>
                    <th className="text-right">Students</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherStats.byDistrict.map((d) => (
                    <tr key={d.districtId}>
                      <td className="font-medium text-navy-700">{d.district}</td>
                      <td className="text-right">{d.schools}</td>
                      <td className="text-right font-semibold text-navy-700">{d.teachers.toLocaleString()}</td>
                      <td className="text-right">{d.students.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                    <td className="px-4 py-2 text-navy-700">Total</td>
                    <td className="px-4 py-2 text-right">{teacherStats.ictSchools}</td>
                    <td className="px-4 py-2 text-right text-navy-700">{teacherStats.totalTeachers.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right">{teacherStats.totalStudents.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add form */}
      {showForm && canWrite && (
        <form onSubmit={submit} className="panel p-5">
          <h2 className="font-heading font-semibold text-navy-700 mb-4"><i className="fas fa-user-plus text-sky-500 mr-2" />Add staff member</h2>
          {needsSchool && !scope.schoolId && (
            <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Select a specific <strong>school</strong> in the scope bar above before adding staff.
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Full name"><input required className={inputCls} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Staff type">
              <select className={inputCls} value={form.staffType} onChange={(e) => setForm({ ...form, staffType: e.target.value as StaffMember['staffType'] })}>
                {STAFF_TYPES.map((t) => <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>)}
              </select>
            </Field>
            <Field label="Gender">
              <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as StaffMember['gender'] })}>
                {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
              </select>
            </Field>
            <Field label="Designation"><input className={inputCls} value={form.designation ?? ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></Field>
            <Field label="Qualification"><input className={inputCls} placeholder="e.g. M.Sc, B.Ed" value={form.qualification ?? ''} onChange={(e) => setForm({ ...form, qualification: e.target.value })} /></Field>
            <Field label="Subjects"><input className={inputCls} placeholder="comma separated" value={form.subjects ?? ''} onChange={(e) => setForm({ ...form, subjects: e.target.value })} /></Field>
            <Field label="Phone"><input className={inputCls} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field label="Email"><input className={inputCls} value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label="Department"><input className={inputCls} value={form.department ?? ''} onChange={(e) => setForm({ ...form, department: e.target.value })} /></Field>
            <Field label="Salary group"><input className={inputCls} placeholder="e.g. Level 8" value={form.salaryGroup ?? ''} onChange={(e) => setForm({ ...form, salaryGroup: e.target.value })} /></Field>
            <Field label="Class teacher of"><input className={inputCls} placeholder="e.g. 8-A" value={form.classTeacherOf ?? ''} onChange={(e) => setForm({ ...form, classTeacherOf: e.target.value, isClassTeacher: !!e.target.value })} /></Field>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100">
            <button type="submit" className="btn-primary"><i className="fas fa-user-plus" />Add staff</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="no-print panel px-4 py-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><i className="fas fa-search text-xs" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className={inputCls + ' pl-9 w-56'} />
        </div>
        <select className={inputCls + ' w-auto'} value={staffType} onChange={(e) => setStaffType(e.target.value)}>
          <option value="">All types</option>
          {STAFF_TYPES.map((t) => <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr>
              <th>Name</th><th>Type</th><th>Qualification</th><th>Subjects</th>
              <th>Class Teacher</th><th>Contact</th>{canWrite && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-navy-600/10 flex items-center justify-center flex-shrink-0">
                      <i className={`${TYPE_ICONS[s.staffType] ?? 'fas fa-user'} text-navy-600 text-xs`} />
                    </div>
                    <div>
                      <div className="font-semibold text-navy-700">{s.name}</div>
                      <div className="text-xs text-slate-400">{s.designation ?? ''}{s.school ? ` · ${s.school}` : ''}</div>
                    </div>
                  </div>
                </td>
                <td><span className="text-xs font-semibold text-navy-600 bg-navy-50 border border-navy-100 rounded px-2 py-0.5">{STAFF_TYPE_LABELS[s.staffType]}</span></td>
                <td className="text-slate-600">{s.qualification ?? '—'}</td>
                <td className="text-slate-600">{s.subjects ?? '—'}</td>
                <td>
                  {s.isClassTeacher
                    ? <span className="badge-virtual">{s.classTeacherOf ?? 'Yes'}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="text-xs text-slate-500">{s.phone ?? ''}{s.email ? <div>{s.email}</div> : null}</td>
                {canWrite && (
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => toggleClassTeacher(s)} className="text-xs text-slate-600 hover:text-sky-600 font-medium px-2 py-1 rounded hover:bg-sky-50">
                      {s.isClassTeacher ? 'Unassign CT' : 'Make CT'}
                    </button>
                    <button onClick={() => setConfirmStaff(s)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="flex items-center gap-2 p-5 text-slate-400 text-sm"><i className="fas fa-circle-notch fa-spin" />Loading…</div>}
        {!loading && !hasScope && (
          <div className="py-12 text-center text-slate-400 text-sm">
            <i className="fas fa-filter text-3xl mb-3 block text-slate-300" />
            <p className="font-medium text-slate-500 mb-1">Select a scope to view staff</p>
            <p className="text-xs">Use the District / Block / School filter above to load staff data.</p>
          </div>
        )}
        {!loading && hasScope && rows.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm"><i className="fas fa-chalkboard-teacher text-2xl mb-2 block" />No staff match the current filters.</div>
        )}
        {!loading && rows.length > 0 && (
          <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100 bg-slate-50/50">Showing {rows.length} staff members</div>
        )}
      </div>
      </>}

      <ConfirmDialog
        open={!!confirmStaff}
        title="Remove staff member"
        message={confirmStaff ? `Remove ${confirmStaff.name}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        onCancel={() => setConfirmStaff(null)}
        onConfirm={() => { remove(confirmStaff!); setConfirmStaff(null); }}
      />
    </div>
  );
}

function DemoCard({ label, value, sub, icon, accent, badge }: {
  label: string; value: string | number; sub?: string; icon: string; accent: string; badge?: 'live';
}) {
  return (
    <div className="stat-card flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: accent }}>
        <i className={icon} />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="text-xs uppercase tracking-widest font-semibold text-slate-500 leading-none">{label}</div>
          {badge === 'live' && <span className="badge-real text-[9px] px-1 py-0.5">LIVE</span>}
        </div>
        <div className="font-heading font-bold text-navy-700 text-xl leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function BreakdownList({ items, total }: { items: { label: string; count: number }[]; total: number }) {
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.label}>
          <div className="flex justify-between text-xs mb-0.5">
            <span className="text-slate-600 font-medium">{it.label}</span>
            <span className="text-slate-400">{it.count}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-300 rounded-full" style={{ width: `${total ? (it.count / total) * 100 : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
