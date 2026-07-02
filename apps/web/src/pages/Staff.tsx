import { useEffect, useMemo, useState } from 'react';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import type React from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  GENDERS, GENDER_LABELS, STAFF_TYPES, STAFF_TYPE_LABELS,
  type Staff as StaffMember, type StaffDemographics, type TeacherStats,
} from '@edubeam/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { FileUpload } from '../components/FileUpload';
import { exportCsv } from '../export';
import { parseCsv, readFileText } from '../csv';
import { downloadStaffTemplate, parseUploadFile } from '../excel';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { Attendance } from './Attendance';
import { ConfirmDialog } from '../components/ConfirmDialog';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['Single', 'Married', 'Widowed', 'Divorced'];
const STAFF_CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const RELIGIONS = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Other'];
const EMPLOYEE_TYPES = ['Permanent', 'Contractual', 'Guest'];

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
  const { academicYear } = useAcademicYear();
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
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [editForm, setEditForm] = useState<Partial<StaffMember>>({});
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

  const openEdit = (s: StaffMember) => {
    setEditStaff(s);
    setEditForm({ ...s });
    setMsg('');
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStaff) return;
    setErr(''); setMsg('');
    try {
      await api.staff.update(editStaff.id, editForm);
      setMsg(`${editForm.name} updated.`);
      setEditStaff(null);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onBulk = async (file: File) => {
    setErr(''); setMsg('');
    if (needsSchool && !scope.schoolId) {
      setErr('Please select a specific school in the Scope bar before uploading staff.');
      return;
    }
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
          <p className="text-sm text-slate-500 mt-1">Teachers, faculty, lab assistants &amp; role assignment · {academicYear}</p>
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
              {/* Bar chart */}
              <div className="p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={teacherStats.byDistrict} margin={{ top: 4, right: 16, left: 0, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="district" tick={{ fontSize: 11 }} angle={-40} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => v.toLocaleString()} />
                    <Legend verticalAlign="top" />
                    <Bar dataKey="teachers" name="Teachers" fill="#0076BC" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="schools" name="ICT Schools" fill="#3AAAC5" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
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

          {/* Staff composition pie chart — visible when school is selected and has staff */}
          {summary && summary.byType && summary.byType.length > 0 && (
            <div className="panel p-5">
              <h2 className="font-heading font-semibold text-navy-700 mb-4">Staff Composition by Type</h2>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={summary.byType} dataKey="count" nameKey="staffType" cx="50%" cy="50%" outerRadius={90} label={({ staffType, percent }: { staffType: string; percent: number }) => `${STAFF_TYPE_LABELS[staffType as keyof typeof STAFF_TYPE_LABELS] ?? staffType} (${(percent * 100).toFixed(0)}%)`} labelLine>
                    {summary.byType.map((_: any, i: number) => (
                      <Cell key={i} fill={['#003087', '#0076BC', '#3AAAC5', '#be185d', '#f59e0b', '#10b981'][i % 6]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v, STAFF_TYPE_LABELS[name as keyof typeof STAFF_TYPE_LABELS] ?? name]} />
                  <Legend formatter={(v: string) => STAFF_TYPE_LABELS[v as keyof typeof STAFF_TYPE_LABELS] ?? v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {/* Add form — quick create. Full extended profile is edited via the tabbed modal below. */}
      {showForm && canWrite && (
        <form onSubmit={submit} className="panel p-5">
          <h2 className="font-heading font-semibold text-navy-700 mb-4">
            <i className="fas fa-user-plus text-sky-500 mr-2" />
            Add staff member
          </h2>
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
          <div className="pt-4 mt-4 border-t border-slate-100 flex gap-2">
            <button type="submit" className="btn-primary">
              <i className="fas fa-user-plus" />Add staff
            </button>
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
                    {s.photoUrl ? (
                      <img src={s.photoUrl} alt={s.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-navy-600/10 flex items-center justify-center flex-shrink-0">
                        <i className={`${TYPE_ICONS[s.staffType] ?? 'fas fa-user'} text-navy-600 text-xs`} />
                      </div>
                    )}
                    <div>
                      <div className="font-semibold text-navy-700">{s.name}</div>
                      <div className="text-xs text-slate-400">
                        {s.employeeId ? `${s.employeeId} · ` : ''}{s.designation ?? ''}{s.school ? ` · ${s.school}` : ''}
                      </div>
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
                    <button onClick={() => openEdit(s)} className="text-xs text-sky-600 hover:text-sky-800 font-medium px-2 py-1 rounded hover:bg-sky-50">Edit</button>
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

      {/* ── Edit staff modal (full-view, tabbed — matches Student / School) ── */}
      {editStaff && (
        <StaffModal
          staff={editStaff}
          editForm={editForm}
          setEditForm={setEditForm}
          onSubmit={submitEdit}
          onClose={() => setEditStaff(null)}
        />
      )}

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

// ── Staff edit modal (full-view, tabbed — matches Student / School layout) ────

type StaffTabId = 'basic' | 'family' | 'contact' | 'identity' | 'employment' | 'address' | 'emergency' | 'status';

const STAFF_TABS: { id: StaffTabId; label: string; icon: string }[] = [
  { id: 'basic',      label: 'Basic Info',        icon: 'fas fa-id-card' },
  { id: 'family',     label: 'Family',            icon: 'fas fa-users' },
  { id: 'contact',    label: 'Contact',           icon: 'fas fa-phone' },
  { id: 'identity',   label: 'Identity',          icon: 'fas fa-fingerprint' },
  { id: 'employment', label: 'Employment',        icon: 'fas fa-briefcase' },
  { id: 'address',    label: 'Address',           icon: 'fas fa-map-marker-alt' },
  { id: 'emergency',  label: 'Emergency Contact', icon: 'fas fa-phone-volume' },
  { id: 'status',     label: 'Status',            icon: 'fas fa-chart-pie' },
];

const STAFF_COMPLETION_FIELDS: (keyof StaffMember)[] = [
  'employeeId', 'dateOfBirth', 'bloodGroup', 'maritalStatus', 'nationality', 'category', 'religion',
  'fatherName', 'motherName', 'altPhone', 'aadhaarNo', 'panNo', 'identificationMark',
  'employeeType', 'presentAddress', 'permanentAddress', 'pinCode',
  'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
  'designation', 'department', 'qualification', 'joiningDate', 'salaryGroup',
];

function isFilledStaff(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '';
}

function StaffModal({
  staff, editForm, setEditForm, onSubmit, onClose,
}: {
  staff: StaffMember;
  editForm: Partial<StaffMember>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<StaffMember>>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<StaffTabId>('basic');
  const upd = (patch: Partial<StaffMember>) => setEditForm(f => ({ ...f, ...patch }));

  const filled = STAFF_COMPLETION_FIELDS.filter(k => isFilledStaff(editForm[k])).length;
  const pct = Math.round((filled / STAFF_COMPLETION_FIELDS.length) * 100);

  const tabDot = (tid: StaffTabId): 'full' | 'partial' | 'empty' | 'none' => {
    const fieldsByTab: Record<StaffTabId, (keyof StaffMember)[]> = {
      basic:      ['employeeId', 'dateOfBirth', 'bloodGroup', 'maritalStatus', 'nationality', 'category', 'religion'],
      family:     ['fatherName', 'motherName'],
      contact:    ['altPhone'],
      identity:   ['aadhaarNo', 'panNo', 'identificationMark'],
      employment: ['designation', 'department', 'qualification', 'joiningDate', 'salaryGroup', 'employeeType'],
      address:    ['presentAddress', 'permanentAddress', 'pinCode'],
      emergency:  ['emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation'],
      status:     [],
    };
    const fields = fieldsByTab[tid];
    if (!fields.length) return 'none';
    const any = fields.some(k => isFilledStaff(editForm[k]));
    const all = fields.every(k => isFilledStaff(editForm[k]));
    return all ? 'full' : any ? 'partial' : 'empty';
  };

  const dotCls = (d: string, active: boolean) =>
    `w-2.5 h-2.5 rounded-full border transition-all ${active ? 'scale-125 border-sky-400' : 'border-slate-200'} ${
      d === 'full' ? 'bg-emerald-400' : d === 'partial' ? 'bg-amber-400' : d === 'empty' ? 'bg-slate-200' : 'bg-transparent border-transparent'
    }`;

  const handleExport = () => {
    const s = { ...staff, ...editForm };
    exportCsv(`staff-${s.employeeId ?? s.id}`, [{
      'Employee ID': s.employeeId ?? '', 'Staff Name': s.name ?? '',
      Gender: GENDER_LABELS[s.gender] ?? s.gender,
      'Date of Birth': s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString('en-IN') : '',
      "Father's Name": s.fatherName ?? '', "Mother's Name": s.motherName ?? '',
      'Mobile Number': s.phone ?? '', 'Alternate Mobile Number': s.altPhone ?? '', 'Email ID': s.email ?? '',
      'Aadhaar Number': s.aadhaarNo ?? '', 'PAN Number': s.panNo ?? '',
      'Blood Group': s.bloodGroup ?? '', 'Marital Status': s.maritalStatus ?? '',
      Nationality: s.nationality ?? '', Category: s.category ?? '', Religion: s.religion ?? '',
      'Date of Joining': s.joiningDate ? new Date(s.joiningDate).toLocaleDateString('en-IN') : '',
      Designation: s.designation ?? '', Department: s.department ?? '', 'Employee Type': s.employeeType ?? '',
      'Staff Type': STAFF_TYPE_LABELS[s.staffType] ?? s.staffType, Qualification: s.qualification ?? '',
      Subjects: s.subjects ?? '', 'Salary Group': s.salaryGroup ?? '',
      'Class Teacher Of': s.isClassTeacher ? (s.classTeacherOf ?? 'Yes') : '',
      'Present Address': s.presentAddress ?? '', 'Permanent Address': s.permanentAddress ?? '', 'Pin Code': s.pinCode ?? '',
      'Emergency Contact Name': s.emergencyContactName ?? '', 'Emergency Contact Number': s.emergencyContactPhone ?? '',
      'Relationship with Emergency Contact': s.emergencyContactRelation ?? '',
      'Identification Mark': s.identificationMark ?? '', 'Disability Details': s.disabilityDetails ?? '',
      'Staff Status': s.active ? 'Active' : 'Inactive', School: s.school ?? '',
      'Profile Completion %': pct,
    }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{ maxWidth: '1100px', maxHeight: '95vh' }} onClick={e => e.stopPropagation()}>

        {/* Header — navy gradient matching Student / School modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-navy-700 to-sky-700 rounded-t-2xl">
          <div className="flex items-center gap-3">
            {editForm.photoUrl ? (
              <img src={editForm.photoUrl} alt={staff.name} className="w-10 h-10 rounded-xl object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
                <i className={`${TYPE_ICONS[staff.staffType] ?? 'fas fa-user'} text-white text-base`} />
              </div>
            )}
            <div>
              <h2 className="font-heading font-bold text-white text-lg leading-none">{staff.name}</h2>
              <p className="text-xs text-sky-200 mt-0.5 font-mono">
                {STAFF_TYPE_LABELS[staff.staffType] ?? staff.staffType}{staff.employeeId ? ` · ${staff.employeeId}` : ` · ${staff.id.slice(-6)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs text-white/80 font-medium">{pct}%</span>
            </div>
            <button type="button" onClick={handleExport}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-colors">
              <i className="fas fa-download" />Export
            </button>
            <button type="button" onClick={onClose} className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto bg-slate-50/60">
          {STAFF_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} type="button"
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'border-sky-500 text-sky-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
              }`}>
              <i className={`${t.icon} text-[10px]`} />{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
          <div className="p-6 space-y-4 flex-1">

            {/* TAB 1 — Basic Info */}
            {tab === 'basic' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identification</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Employee ID"><input className={inputCls} value={editForm.employeeId ?? ''} onChange={e => upd({ employeeId: e.target.value || null })} /></Field>
                <Field label="Staff Name (required)"><input required className={inputCls} value={editForm.name ?? ''} onChange={e => upd({ name: e.target.value })} /></Field>
                <Field label="Staff Photo">
                  <FileUpload
                    value={editForm.photoUrl}
                    onChange={url => upd({ photoUrl: url })}
                    folder={`staff/${staff.id}/photo`}
                    accept="image/*"
                    imagePreview
                  />
                </Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Personal Details</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Gender">
                  <select className={inputCls} value={editForm.gender} onChange={e => upd({ gender: e.target.value as StaffMember['gender'] })}>
                    {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                  </select>
                </Field>
                <Field label="Date of Birth"><input type="date" className={inputCls} value={editForm.dateOfBirth?.slice(0, 10) ?? ''} onChange={e => upd({ dateOfBirth: e.target.value || null })} /></Field>
                <Field label="Blood Group">
                  <select className={inputCls} value={editForm.bloodGroup ?? ''} onChange={e => upd({ bloodGroup: e.target.value || null })}>
                    <option value="">—</option>
                    {BLOOD_GROUPS.map(b => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Marital Status">
                  <select className={inputCls} value={editForm.maritalStatus ?? ''} onChange={e => upd({ maritalStatus: e.target.value || null })}>
                    <option value="">—</option>
                    {MARITAL_STATUSES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Nationality"><input className={inputCls} value={editForm.nationality ?? ''} onChange={e => upd({ nationality: e.target.value || null })} /></Field>
                <Field label="Category">
                  <select className={inputCls} value={editForm.category ?? ''} onChange={e => upd({ category: e.target.value || null })}>
                    <option value="">—</option>
                    {STAFF_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Religion">
                  <select className={inputCls} value={editForm.religion ?? ''} onChange={e => upd({ religion: e.target.value || null })}>
                    <option value="">—</option>
                    {RELIGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
            </>}

            {/* TAB 2 — Family */}
            {tab === 'family' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Family Details</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Father's Name"><input className={inputCls} value={editForm.fatherName ?? ''} onChange={e => upd({ fatherName: e.target.value || null })} /></Field>
                <Field label="Mother's Name"><input className={inputCls} value={editForm.motherName ?? ''} onChange={e => upd({ motherName: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 3 — Contact */}
            {tab === 'contact' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contact Details</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Mobile Number"><input className={inputCls} value={editForm.phone ?? ''} onChange={e => upd({ phone: e.target.value || null })} /></Field>
                <Field label="Alternate Mobile Number"><input className={inputCls} value={editForm.altPhone ?? ''} onChange={e => upd({ altPhone: e.target.value || null })} /></Field>
                <Field label="Email ID"><input type="email" className={inputCls} value={editForm.email ?? ''} onChange={e => upd({ email: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 4 — Identity */}
            {tab === 'identity' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identity Documents</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Aadhaar Number"><input className={inputCls} maxLength={12} value={editForm.aadhaarNo ?? ''} onChange={e => upd({ aadhaarNo: e.target.value || null })} /></Field>
                <Field label="PAN Number"><input className={inputCls} maxLength={10} value={editForm.panNo ?? ''} onChange={e => upd({ panNo: e.target.value.toUpperCase() || null })} /></Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Additional Details</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Identification Mark (Optional)"><input className={inputCls} value={editForm.identificationMark ?? ''} onChange={e => upd({ identificationMark: e.target.value || null })} /></Field>
                <Field label="Disability Details (If Applicable)"><input className={inputCls} value={editForm.disabilityDetails ?? ''} onChange={e => upd({ disabilityDetails: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 5 — Employment */}
            {tab === 'employment' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Role</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Staff Type">
                  <select className={inputCls} value={editForm.staffType} onChange={e => upd({ staffType: e.target.value as StaffMember['staffType'] })}>
                    {STAFF_TYPES.map(t => <option key={t} value={t}>{STAFF_TYPE_LABELS[t]}</option>)}
                  </select>
                </Field>
                <Field label="Designation"><input className={inputCls} value={editForm.designation ?? ''} onChange={e => upd({ designation: e.target.value || null })} /></Field>
                <Field label="Department"><input className={inputCls} value={editForm.department ?? ''} onChange={e => upd({ department: e.target.value || null })} /></Field>
                <Field label="Employee Type">
                  <select className={inputCls} value={editForm.employeeType ?? ''} onChange={e => upd({ employeeType: e.target.value || null })}>
                    <option value="">—</option>
                    {EMPLOYEE_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Date of Joining"><input type="date" className={inputCls} value={editForm.joiningDate?.slice(0, 10) ?? ''} onChange={e => upd({ joiningDate: e.target.value || null })} /></Field>
                <Field label="Salary Group"><input className={inputCls} placeholder="e.g. Level 8" value={editForm.salaryGroup ?? ''} onChange={e => upd({ salaryGroup: e.target.value || null })} /></Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Teaching</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Qualification"><input className={inputCls} placeholder="e.g. M.Sc, B.Ed" value={editForm.qualification ?? ''} onChange={e => upd({ qualification: e.target.value || null })} /></Field>
                <Field label="Subjects"><input className={inputCls} placeholder="comma separated" value={editForm.subjects ?? ''} onChange={e => upd({ subjects: e.target.value || null })} /></Field>
                <Field label="Class Teacher Of"><input className={inputCls} placeholder="e.g. 8-A" value={editForm.classTeacherOf ?? ''} onChange={e => upd({ classTeacherOf: e.target.value || null, isClassTeacher: !!e.target.value })} /></Field>
              </div>
            </>}

            {/* TAB 6 — Address */}
            {tab === 'address' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Address</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Present Address"><textarea rows={2} className={inputCls} value={editForm.presentAddress ?? ''} onChange={e => upd({ presentAddress: e.target.value || null })} /></Field>
                <Field label="Permanent Address"><textarea rows={2} className={inputCls} value={editForm.permanentAddress ?? ''} onChange={e => upd({ permanentAddress: e.target.value || null })} /></Field>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Pin Code"><input className={inputCls} maxLength={6} value={editForm.pinCode ?? ''} onChange={e => upd({ pinCode: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 7 — Emergency Contact */}
            {tab === 'emergency' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Emergency Contact</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Emergency Contact Name"><input className={inputCls} value={editForm.emergencyContactName ?? ''} onChange={e => upd({ emergencyContactName: e.target.value || null })} /></Field>
                <Field label="Emergency Contact Number"><input className={inputCls} value={editForm.emergencyContactPhone ?? ''} onChange={e => upd({ emergencyContactPhone: e.target.value || null })} /></Field>
                <Field label="Relationship with Emergency Contact"><input className={inputCls} placeholder="e.g. Spouse, Sibling" value={editForm.emergencyContactRelation ?? ''} onChange={e => upd({ emergencyContactRelation: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 8 — Status */}
            {tab === 'status' && <>
              {/* Completion */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-navy-700">Profile Completion</span>
                  <span className={`text-sm font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-sky-600'}`}>{pct}%</span>
                </div>
                <div className="w-full h-2 bg-white rounded-full border border-slate-200 overflow-hidden mb-3">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#0076BC' }} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-semibold text-slate-500 mb-1.5">Missing ({STAFF_COMPLETION_FIELDS.filter(k => !isFilledStaff(editForm[k])).length})</p>
                    <div className="flex flex-wrap gap-1">
                      {STAFF_COMPLETION_FIELDS.filter(k => !isFilledStaff(editForm[k])).map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-red-50 border border-red-100 text-red-600">{k}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 mb-1.5">Filled ({filled})</p>
                    <div className="flex flex-wrap gap-1">
                      {STAFF_COMPLETION_FIELDS.filter(k => isFilledStaff(editForm[k])).map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700">{k}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Status field */}
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Staff Status">
                  <select className={inputCls} value={editForm.active === false ? 'inactive' : 'active'} onChange={e => upd({ active: e.target.value === 'active' })}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </Field>
              </div>
              {/* Audit trail */}
              {(editForm.profileUpdatedBy || editForm.profileUpdatedAt) && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-500 space-y-0.5">
                  <p className="font-semibold text-slate-600 mb-1">Last Updated</p>
                  {editForm.profileUpdatedBy && <p>By: {editForm.profileUpdatedBy}</p>}
                  {editForm.profileUpdatedAt && <p>At: {new Date(editForm.profileUpdatedAt).toLocaleString()}</p>}
                </div>
              )}
            </>}

          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
            <div className="flex gap-1.5 items-center">
              {STAFF_TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)} title={t.label}
                  className={dotCls(tabDot(t.id), tab === t.id)} />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-outline px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="btn-navy px-5 py-2 text-sm"><i className="fas fa-save mr-2" />Save Changes</button>
            </div>
          </div>
        </form>
      </div>
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
