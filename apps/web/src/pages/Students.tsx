import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CATEGORIES, GENDERS, GENDER_LABELS,
  type EnrollmentDemographics, type Student, type StudentDemographics,
} from '@edubeam/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { exportCsv } from '../export';
import { parseCsv, readFileText } from '../csv';
import { ScopeBar, type Scope } from '../components/ScopeBar';
import { Attendance } from './Attendance';
import { ReportCard } from './ReportCard';
import { ConfirmDialog } from '../components/ConfirmDialog';

// ── Login credential popover ──────────────────────────────────────────────────

function CredPopover({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(`Email: ${email}\nPassword: ${password}`); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="absolute right-0 top-8 z-50 w-68 bg-white rounded-xl shadow-xl border border-slate-200 p-3 text-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-semibold text-navy-700 text-xs uppercase tracking-wide">Credentials</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs"><i className="fas fa-times" /></button>
      </div>
      <div className="space-y-1.5 text-xs font-mono">
        <div className="bg-slate-50 rounded px-2 py-1.5 break-all">{email}</div>
        <div className="bg-slate-50 rounded px-2 py-1.5">{password}</div>
      </div>
      <button onClick={copy} className="mt-2 w-full text-xs py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
        <i className={`fas ${copied ? 'fa-check text-emerald-500' : 'fa-copy'} mr-1`} />{copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

function StudentLoginBtn({ studentId, type }: { studentId: string; type: 'student' | 'parent' }) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const fn = type === 'student' ? api.users.upsertStudentLogin : api.users.upsertParentLogin;
      const c = await fn(studentId);
      setCreds(c); setOpen(true);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const close = () => setOpen(false);
    if (open) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  const label = type === 'student' ? 'Student' : 'Parent';
  const icon  = type === 'student' ? 'fas fa-user-graduate' : 'fas fa-user-friends';
  const color = type === 'student' ? 'text-sky-600 hover:text-sky-800 hover:bg-sky-50' : 'text-purple-600 hover:text-purple-800 hover:bg-purple-50';
  const resetColor = type === 'student' ? 'text-orange-500 hover:text-orange-700 hover:bg-orange-50' : 'text-orange-500 hover:text-orange-700 hover:bg-orange-50';

  return (
    <span className="relative inline-block">
      {creds && open && <CredPopover email={creds.email} password={creds.password} onClose={() => setOpen(false)} />}
      <button
        onClick={creds ? (e => { e.stopPropagation(); setOpen(o => !o); }) : handle}
        disabled={busy}
        className={`text-xs font-medium px-2 py-1 rounded transition-colors disabled:opacity-50 ${creds ? `text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50` : color}`}
      >
        {busy ? <i className="fas fa-circle-notch fa-spin mr-1" /> : <i className={`${icon} mr-1`} />}
        {creds ? `${label} ✓` : label}
      </button>
      {creds && (
        <button onClick={handle} disabled={busy} title={`Reset ${label} password`}
          className={`text-xs font-medium px-1 py-1 rounded transition-colors disabled:opacity-50 ${resetColor}`}>
          <i className="fas fa-redo" />
        </button>
      )}
    </span>
  );
}

type SubPage = 'list' | 'attendance' | 'report-card';
const SUB_TABS: { id: SubPage; label: string; icon: string }[] = [
  { id: 'list',        label: 'Students List', icon: 'fas fa-list' },
  { id: 'attendance',  label: 'Attendance',    icon: 'fas fa-user-check' },
  { id: 'report-card', label: 'Report Card',   icon: 'fas fa-file-alt' },
];

const GRADES_6_12 = [6, 7, 8, 9, 10, 11, 12];

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'PRINCIPAL'];
const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

const emptyStudent: Partial<Student> = {
  name: '', gender: 'M', grade: 6, section: '', rollNo: '', admissionNo: '',
  guardianName: '', guardianPhone: '', guardianRelation: 'Father', category: 'GEN',
  religion: 'Hindu', isRte: false,
};

export function Students() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');
  const needsSchool = user?.role === 'ADMIN' || user?.role === 'STATE_OFFICIAL' || user?.role === 'DISTRICT_OFFICIAL';

  const [subPage, setSubPage] = useState<SubPage>('list');
  const [scope, setScope] = useState<Scope>({});
  const [rows, setRows] = useState<Student[]>([]);
  const [summary, setSummary] = useState<StudentDemographics | null>(null);
  const [enrollment, setEnrollment] = useState<EnrollmentDemographics | null>(null);
  const [grade, setGrade] = useState<string>('');
  const [gender, setGender] = useState<string>('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Student>>(emptyStudent);
  const [editStudent, setEditStudent] = useState<Student | null>(null);
  const [editForm, setEditForm] = useState<Partial<Student>>(emptyStudent);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirmStudent, setConfirmStudent] = useState<Student | null>(null);
  const [confirmPromote, setConfirmPromote] = useState(false);
  const [newCreds, setNewCreds] = useState<{ name: string; studentLogin: { email: string; password: string }; parentLogin: { email: string; password: string } } | null>(null);

  const filter = useMemo(
    () => ({
      ...scope,
      grade: grade ? Number(grade) : undefined,
      gender: gender || undefined,
      q: q || undefined,
    }),
    [scope, grade, gender, q],
  );

  // Only load list when a scope is actively selected OR the user has a fixed scope (principal/district)
  const hasScope = !!(scope.districtId || scope.blockId || scope.schoolId || user?.schoolId || user?.districtId);

  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const load = () => {
    if (!hasScope) { setRows([]); setSummary(null); setLoading(false); return; }
    setLoading(true);
    setPage(1);
    Promise.all([api.students.list(filter), api.students.summary(scope)])
      .then(([r, s]) => { setRows(r); setSummary(s); })
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { api.enrollment().then(setEnrollment).catch(() => {}); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [JSON.stringify(filter), hasScope]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      const res = await api.students.create({ ...form, schoolId: scope.schoolId });
      setNewCreds({ name: form.name ?? '', studentLogin: res.studentLogin, parentLogin: res.parentLogin });
      setForm(emptyStudent);
      setShowForm(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const onBulk = async (file: File) => {
    setErr(''); setMsg('');
    try {
      const text = await readFileText(file);
      const parsed = parseCsv(text).map((r) => ({
        name: r.name,
        gender: (r.gender || 'M').toUpperCase().startsWith('F') ? 'F' : 'M',
        grade: Number(r.grade || r.class),
        section: r.section,
        rollNo: r.rollno || r['roll no'] || r.roll,
        admissionNo: r.admissionno || r['admission no'],
        guardianName: r.guardianname || r['guardian name'] || r.father || r.parent,
        guardianPhone: r.guardianphone || r['guardian phone'] || r.phone || r.mobile,
        guardianRelation: r.guardianrelation || r['guardian relation'],
        category: (r.category || 'GEN').toUpperCase(),
        religion: r.religion,
        isRte: /^(y|yes|true|1)$/i.test(r.isrte || r.rte || ''),
      }));
      const res = await api.students.bulk(scope.schoolId, parsed as Partial<Student>[]);
      setMsg(`Imported ${res.inserted} students${res.skipped ? `, skipped ${res.skipped}` : ''}.`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const promote = async () => {
    try {
      const res = await api.students.promote(scope.schoolId);
      setMsg(`Promoted ${res.promoted} students, ${res.graduated} graduated.`);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const remove = async (s: Student) => {
    try { await api.students.remove(s.id); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const openEdit = (s: Student) => {
    setEditStudent(s);
    setEditForm({ ...s });
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editStudent) return;
    setErr(''); setMsg('');
    try {
      await api.students.update(editStudent.id, editForm);
      setMsg(`${editForm.name} updated.`);
      setEditStudent(null);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Auto-generated credentials modal shown immediately after adding a student */}
      {newCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <i className="fas fa-check text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-navy-700">Student Added</p>
                <p className="text-xs text-slate-500">{newCreds.name} — credentials auto-generated</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide"><i className="fas fa-user-graduate mr-1" />Student Login</p>
                <p className="font-mono text-xs break-all text-slate-700">{newCreds.studentLogin.email}</p>
                <p className="font-mono text-xs text-slate-700">{newCreds.studentLogin.password}</p>
              </div>
              <div className="rounded-xl border border-purple-100 bg-purple-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide"><i className="fas fa-user-friends mr-1" />Parent Login</p>
                <p className="font-mono text-xs break-all text-slate-700">{newCreds.parentLogin.email}</p>
                <p className="font-mono text-xs text-slate-700">{newCreds.parentLogin.password}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { navigator.clipboard.writeText(`Student: ${newCreds.studentLogin.email} / ${newCreds.studentLogin.password}\nParent: ${newCreds.parentLogin.email} / ${newCreds.parentLogin.password}`); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                <i className="fas fa-copy mr-1" />Copy All
              </button>
              <button onClick={() => setNewCreds(null)} className="text-xs px-4 py-1.5 rounded-lg bg-navy-700 text-white hover:bg-navy-800">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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

      {subPage === 'attendance' && <Attendance mode="student" />}
      {subPage === 'report-card' && <ReportCard />}

      {subPage === 'list' && <>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-user-graduate" />Student Registry</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Students</h1>
          <p className="text-sm text-slate-500 mt-1">Enrolment, demographics, RTE &amp; dropout tracking · 2025–26</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canWrite && (
            <>
              <label className="btn-outline cursor-pointer">
                <i className="fas fa-file-import" />
                Bulk Upload
                <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onBulk(e.target.files[0])} />
              </label>
              <button onClick={() => setConfirmPromote(true)} className="btn-outline"><i className="fas fa-level-up-alt" />Promote</button>
              <button onClick={() => setShowForm((s) => !s)} className={showForm ? 'btn-outline' : 'btn-navy'}>
                {showForm ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-user-plus" />Add Student</>}
              </button>
            </>
          )}
          <button
            onClick={() => exportCsv('students', rows.map((s) => ({
              Name: s.name, Roll: s.rollNo ?? '', Grade: s.grade, Section: s.section ?? '',
              Gender: GENDER_LABELS[s.gender], Category: s.category, Religion: s.religion ?? '',
              RTE: s.isRte ? 'Yes' : 'No', Guardian: s.guardianName ?? '', Phone: s.guardianPhone ?? '',
              Status: s.isDropout ? 'Dropout' : 'Active', School: s.school ?? '',
            })))}
            className="btn-outline"
          >
            <i className="fas fa-download" />Export
          </button>
        </div>
      </div>

      {/* Demographics cards — use real enrollment data for gender */}
      {enrollment && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <DemoCard label="Total Students" value={enrollment.total} icon="fas fa-users" accent="linear-gradient(135deg,#003087,#0076BC)" />
          <DemoCard label="Boys" value={enrollment.boys} sub={pctOf(enrollment.boys, enrollment.total)} icon="fas fa-male" accent="linear-gradient(135deg,#0076BC,#3AAAC5)" />
          <DemoCard label="Girls" value={enrollment.girls} sub={pctOf(enrollment.girls, enrollment.total)} icon="fas fa-female" accent="linear-gradient(135deg,#be185d,#ec4899)" />
        </div>
      )}

      {/* Students by Grade — from real enrollment data, Class 6–12 only */}
      {enrollment && enrollment.byGrade.length > 0 && (
        <div className="panel p-5">
          <h2 className="font-heading font-semibold text-navy-700 mb-3">Students by Grade</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={enrollment.byGrade.filter((g) => g.grade >= 6).map((g) => ({ grade: g.grade, count: g.boys + g.girls }))}
              margin={{ top: 4, right: 8, bottom: 4, left: -20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="grade" fontSize={12} tickFormatter={(g) => `Class ${g}`} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip labelFormatter={(g) => `Class ${g}`} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0' }} />
              <Bar dataKey="count" name="Students" radius={[6, 6, 0, 0]} isAnimationActive={false}>
                {enrollment.byGrade.filter((g) => g.grade >= 6).map((_, i) => <Cell key={i} fill="#0076BC" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <ScopeBar value={scope} onChange={setScope} />

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* Add form */}
      {showForm && canWrite && (
        <form onSubmit={submit} className="panel p-5">
          <h2 className="font-heading font-semibold text-navy-700 mb-4"><i className="fas fa-user-plus text-sky-500 mr-2" />Add new student</h2>
          {needsSchool && !scope.schoolId && (
            <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Select a specific <strong>school</strong> in the scope bar above before adding a student.
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Full name"><input required className={inputCls} value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Gender">
              <select className={inputCls} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Student['gender'] })}>
                {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
              </select>
            </Field>
            <Field label="Grade / Class">
              <select className={inputCls} value={form.grade} onChange={(e) => setForm({ ...form, grade: Number(e.target.value) })}>
                {GRADES_6_12.map((g) => <option key={g} value={g}>Class {g}</option>)}
              </select>
            </Field>
            <Field label="Section"><input className={inputCls} value={form.section ?? ''} onChange={(e) => setForm({ ...form, section: e.target.value })} /></Field>
            <Field label="Roll No"><input className={inputCls} value={form.rollNo ?? ''} onChange={(e) => setForm({ ...form, rollNo: e.target.value })} /></Field>
            <Field label="Admission No"><input className={inputCls} value={form.admissionNo ?? ''} onChange={(e) => setForm({ ...form, admissionNo: e.target.value })} /></Field>
            <Field label="Guardian name"><input className={inputCls} value={form.guardianName ?? ''} onChange={(e) => setForm({ ...form, guardianName: e.target.value })} /></Field>
            <Field label="Guardian phone"><input className={inputCls} value={form.guardianPhone ?? ''} onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })} /></Field>
            <Field label="Relation">
              <select className={inputCls} value={form.guardianRelation ?? 'Father'} onChange={(e) => setForm({ ...form, guardianRelation: e.target.value })}>
                {['Father', 'Mother', 'Guardian'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Category">
              <select className={inputCls} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Student['category'] })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="pt-4 mt-4 border-t border-slate-100">
            <button type="submit" className="btn-primary"><i className="fas fa-user-plus" />Add student</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="no-print panel px-4 py-3 flex flex-wrap gap-2 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><i className="fas fa-search text-xs" /></span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…" className={inputCls + ' pl-9 w-56'} />
        </div>
        <select className={inputCls + ' w-auto'} value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">All grades</option>
          {GRADES_6_12.map((g) => <option key={g} value={g}>Class {g}</option>)}
        </select>
        <select className={inputCls + ' w-auto'} value={gender} onChange={(e) => setGender(e.target.value)}>
          <option value="">All genders</option>
          {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr>
              <th>Student</th><th>Class</th><th>Gender</th><th>Category</th>
              <th>Guardian</th><th>Status</th>
              {canWrite && <th className="text-right">Logins</th>}
              {canWrite && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-semibold text-navy-700">{s.name}</div>
                  <div className="text-xs text-slate-400">Roll {s.rollNo ?? '—'}{s.school ? ` · ${s.school}` : ''}</div>
                </td>
                <td>Class {s.grade}{s.section ? `-${s.section}` : ''}</td>
                <td>{GENDER_LABELS[s.gender]}</td>
                <td>
                  <span className="text-xs font-semibold text-navy-600 bg-navy-50 border border-navy-100 rounded px-2 py-0.5">{s.category}</span>
                  {s.isRte && <span className="badge-virtual ml-1">RTE</span>}
                </td>
                <td>
                  <div className="text-slate-600">{s.guardianName ?? '—'}</div>
                  <div className="text-xs text-slate-400">{s.guardianPhone ?? ''}</div>
                </td>
                <td>
                  {s.isDropout
                    ? <span className="text-xs font-semibold rounded px-2 py-0.5 border bg-red-50 text-red-600 border-red-200">Dropout</span>
                    : <span className="text-xs font-semibold rounded px-2 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200">Active</span>}
                </td>
                {canWrite && (
                  <td className="text-right whitespace-nowrap">
                    <StudentLoginBtn studentId={s.id} type="student" />
                    <StudentLoginBtn studentId={s.id} type="parent" />
                  </td>
                )}
                {canWrite && (
                  <td className="text-right whitespace-nowrap">
                    <button onClick={() => openEdit(s)} className="text-xs text-sky-600 hover:text-sky-800 font-medium px-2 py-1 rounded hover:bg-sky-50 mr-1">
                      <i className="fas fa-edit mr-1" />Edit
                    </button>
                    <button onClick={() => setConfirmStudent(s)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50">Remove</button>
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
            <p className="font-medium text-slate-500 mb-1">Select a scope to view students</p>
            <p className="text-xs">Use the District / Block / School filter above to load student data.</p>
          </div>
        )}
        {!loading && hasScope && rows.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm"><i className="fas fa-user-graduate text-2xl mb-2 block" />No students match the current filters.</div>
        )}
        {!loading && rows.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} students
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-2 py-1 rounded text-xs border border-slate-200 hover:bg-slate-100 disabled:opacity-40">‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
                  .reduce<(number | '…')[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) => n === '…'
                    ? <span key={`e${i}`} className="px-1 text-xs text-slate-400">…</span>
                    : <button key={n} onClick={() => setPage(n as number)}
                        className={`px-2.5 py-1 rounded text-xs border transition-colors ${page === n ? 'bg-sky-500 text-white border-sky-500' : 'border-slate-200 hover:bg-slate-100'}`}>{n}</button>
                  )}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-2 py-1 rounded text-xs border border-slate-200 hover:bg-slate-100 disabled:opacity-40">›</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit student modal ─────────────────────────────── */}
      {editStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-heading font-bold text-navy-700 text-lg">Edit Student</h2>
              <button onClick={() => setEditStudent(null)} className="text-slate-400 hover:text-slate-600">
                <i className="fas fa-times text-lg" />
              </button>
            </div>
            <form onSubmit={submitEdit} className="p-6 space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Full name"><input required className={inputCls} value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></Field>
                <Field label="Gender">
                  <select className={inputCls} value={editForm.gender} onChange={e => setEditForm(f => ({ ...f, gender: e.target.value as Student['gender'] }))}>
                    {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                  </select>
                </Field>
                <Field label="Grade / Class">
                  <select className={inputCls} value={editForm.grade} onChange={e => setEditForm(f => ({ ...f, grade: Number(e.target.value) }))}>
                    {GRADES_6_12.map(g => <option key={g} value={g}>Class {g}</option>)}
                  </select>
                </Field>
                <Field label="Section"><input className={inputCls} value={editForm.section ?? ''} onChange={e => setEditForm(f => ({ ...f, section: e.target.value }))} /></Field>
                <Field label="Roll No"><input className={inputCls} value={editForm.rollNo ?? ''} onChange={e => setEditForm(f => ({ ...f, rollNo: e.target.value }))} /></Field>
                <Field label="Admission No"><input className={inputCls} value={editForm.admissionNo ?? ''} onChange={e => setEditForm(f => ({ ...f, admissionNo: e.target.value }))} /></Field>
                <Field label="Guardian name"><input className={inputCls} value={editForm.guardianName ?? ''} onChange={e => setEditForm(f => ({ ...f, guardianName: e.target.value }))} /></Field>
                <Field label="Guardian phone"><input className={inputCls} value={editForm.guardianPhone ?? ''} onChange={e => setEditForm(f => ({ ...f, guardianPhone: e.target.value }))} /></Field>
                <Field label="Relation">
                  <select className={inputCls} value={editForm.guardianRelation ?? 'Father'} onChange={e => setEditForm(f => ({ ...f, guardianRelation: e.target.value }))}>
                    {['Father', 'Mother', 'Guardian'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Category">
                  <select className={inputCls} value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value as Student['category'] }))}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputCls} value={editForm.isDropout ? 'dropout' : 'active'} onChange={e => setEditForm(f => ({ ...f, isDropout: e.target.value === 'dropout' }))}>
                    <option value="active">Active</option>
                    <option value="dropout">Dropout</option>
                  </select>
                </Field>
              </div>
              <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
                <button type="button" onClick={() => setEditStudent(null)} className="btn-outline px-5 py-2.5">Cancel</button>
                <button type="submit" className="btn-navy px-6 py-2.5"><i className="fas fa-save mr-2" />Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>}

      <ConfirmDialog
        open={!!confirmStudent}
        title="Remove student"
        message={confirmStudent ? `Remove ${confirmStudent.name}? This cannot be undone.` : ''}
        confirmLabel="Remove"
        onCancel={() => setConfirmStudent(null)}
        onConfirm={() => { remove(confirmStudent!); setConfirmStudent(null); }}
      />
      <ConfirmDialog
        open={confirmPromote}
        title="Promote all students"
        message="Move all students one grade up? Class 12 students will be marked as graduated."
        confirmLabel="Promote"
        onCancel={() => setConfirmPromote(false)}
        onConfirm={() => { promote(); setConfirmPromote(false); }}
      />
    </div>
  );
}

function pctOf(n: number, total: number) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : '—';
}

function DemoCard({ label, value, sub, icon, accent }: { label: string; value: number; sub?: string; icon: string; accent: string }) {
  return (
    <div className="stat-card flex items-start gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ background: accent }}>
        <i className={icon} />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-widest font-semibold text-slate-500 leading-none mb-1">{label}</div>
        <div className="font-heading font-bold text-navy-700 text-xl leading-none">{value.toLocaleString()}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
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
