import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CATEGORIES, GENDERS, GENDER_LABELS,
  type EnrollmentDemographics, type Student, type StudentDemographics,
} from '@edubeam/shared';
import { api } from '../api';
import { useAuth } from '../auth';
import { FileUpload } from '../components/FileUpload';
import { exportCsv } from '../export';
import { parseCsv, readFileText } from '../csv';
import { downloadStudentTemplate, parseUploadFile } from '../excel';
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

// ── Indian states list ────────────────────────────────────────────────────────
const INDIA_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand',
  'West Bengal','Andaman & Nicobar Islands','Chandigarh','Dadra & Nagar Haveli','Daman & Diu',
  'Delhi','Jammu & Kashmir','Ladakh','Lakshadweep','Puducherry',
];

// ── Uttarakhand districts → blocks (from DB — fetched at runtime) ─────────────
function AddressTab({ form, upd, inputCls }: {
  form: Partial<Student>;
  upd: (patch: Partial<Student>) => void;
  inputCls: string;
}) {
  const [districts, setDistricts] = useState<{ id: string; name: string; blocks: { id: string; name: string }[] }[]>([]);
  const [sameAsPermAddr, setSameAsPermAddr] = useState(false);

  useEffect(() => {
    import('../api').then(m => m.api.schoolDistricts().then(setDistricts).catch(() => null));
  }, []);

  const isUK = (form.stateAddr ?? '').toLowerCase().includes('uttarakhand');
  const selDist = districts.find(d => d.name.toLowerCase() === (form.districtAddr ?? '').toLowerCase());
  const blocks = selDist?.blocks ?? [];

  const buildAddress = (patch: Partial<Student>) => {
    const f = { ...form, ...patch };
    const parts = [f.village, f.blockAddr, f.districtAddr, f.stateAddr, f.pinCode].filter(Boolean);
    return parts.join(', ');
  };

  const handleState = (val: string) => {
    const patch: Partial<Student> = { stateAddr: val || null, districtAddr: null, blockAddr: null };
    upd({ ...patch, permanentAddress: (buildAddress(patch) || form.permanentAddress) ?? null });
  };

  const handleDistrict = (val: string) => {
    const patch: Partial<Student> = { districtAddr: val || null, blockAddr: null };
    upd({ ...patch, permanentAddress: (buildAddress(patch) || form.permanentAddress) ?? null });
  };

  const handleBlock = (val: string) => {
    const patch: Partial<Student> = { blockAddr: val || null };
    upd({ ...patch, permanentAddress: (buildAddress(patch) || form.permanentAddress) ?? null });
  };

  const handleVillage = (val: string) => {
    const patch: Partial<Student> = { village: val || null };
    upd({ ...patch, permanentAddress: (buildAddress(patch) || form.permanentAddress) ?? null });
  };

  const handleSameAs = (checked: boolean) => {
    setSameAsPermAddr(checked);
    if (checked) upd({ correspondenceAddress: form.permanentAddress ?? null });
  };

  return (
    <>
      <div className="grid md:grid-cols-3 gap-4">
        {/* State */}
        <Field label="State">
          <select className={inputCls} value={form.stateAddr ?? ''} onChange={e => handleState(e.target.value)}>
            <option value="">— Select State —</option>
            {INDIA_STATES.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>

        {/* District — dropdown for UK, free-text otherwise */}
        <Field label="District">
          {isUK && districts.length > 0 ? (
            <select className={inputCls} value={form.districtAddr ?? ''} onChange={e => handleDistrict(e.target.value)}>
              <option value="">— Select District —</option>
              {districts.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={form.districtAddr ?? ''} onChange={e => handleDistrict(e.target.value)} placeholder="District" />
          )}
        </Field>

        {/* Block — dropdown when UK district selected, free-text otherwise */}
        <Field label="Block">
          {blocks.length > 0 ? (
            <select className={inputCls} value={form.blockAddr ?? ''} onChange={e => handleBlock(e.target.value)}>
              <option value="">— Select Block —</option>
              {blocks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
          ) : (
            <input className={inputCls} value={form.blockAddr ?? ''} onChange={e => handleBlock(e.target.value)} placeholder="Block / Tehsil" />
          )}
        </Field>

        <Field label="Village / Town">
          <input className={inputCls} value={form.village ?? ''} onChange={e => handleVillage(e.target.value)} placeholder="Village or town name" />
        </Field>
        <Field label="PIN Code">
          <input className={inputCls} maxLength={6} value={form.pinCode ?? ''} onChange={e => upd({ pinCode: e.target.value || null })} placeholder="6-digit PIN" />
        </Field>
      </div>

      <Field label="Permanent Address">
        <textarea
          rows={3} className={inputCls}
          value={form.permanentAddress ?? ''}
          onChange={e => { upd({ permanentAddress: e.target.value || null }); if (sameAsPermAddr) upd({ correspondenceAddress: e.target.value || null }); }}
          placeholder="Full permanent address (auto-filled from above selections)"
        />
      </Field>

      <div className="flex items-center gap-2 -mt-1">
        <input
          type="checkbox" id="sameAddr" checked={sameAsPermAddr}
          onChange={e => handleSameAs(e.target.checked)}
          className="w-4 h-4 rounded accent-sky-600"
        />
        <label htmlFor="sameAddr" className="text-sm text-slate-600 cursor-pointer select-none">
          Same as Permanent Address
        </label>
      </div>

      <Field label="Correspondence Address">
        <textarea
          rows={3} className={inputCls}
          value={form.correspondenceAddress ?? ''}
          onChange={e => { setSameAsPermAddr(false); upd({ correspondenceAddress: e.target.value || null }); }}
          placeholder="Leave blank if same as permanent address"
          disabled={sameAsPermAddr}
        />
      </Field>
    </>
  );
}

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
  const [promoteGrade, setPromoteGrade] = useState<string>('');
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
      const rows = file.name.endsWith('.csv')
        ? parseCsv(await readFileText(file)).map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase().replace(/[^a-z0-9]/g, ''), String(v)])))
        : await parseUploadFile(file);
      // Validate required fields before mapping
      const validationErrors: string[] = [];
      rows.forEach((r, i) => {
        const rowNum = i + 3;
        if (!r.fullname && !r.name) validationErrors.push(`Row ${rowNum}: Name is required`);
        const g = Number(r.gradeclass || r.grade || r.class);
        if (!g || g < 6 || g > 12) validationErrors.push(`Row ${rowNum}: Grade (6–12) is required`);
        const gv = (r.gender || '').toUpperCase().charAt(0);
        if (gv !== 'M' && gv !== 'F') validationErrors.push(`Row ${rowNum}: Gender must be M or F`);
        if (!r.rollno && !r.roll) validationErrors.push(`Row ${rowNum}: Roll No is required`);
        if (!r.section) validationErrors.push(`Row ${rowNum}: Section is required`);
        if (!r.category) validationErrors.push(`Row ${rowNum}: Category is required`);
        if (!r.fathersname && !r.fathername) validationErrors.push(`Row ${rowNum}: Father's Name is required`);
        if (!r.guardianname && !r.fathersname && !r.fathername) validationErrors.push(`Row ${rowNum}: Guardian/Father name is required`);
        if (!r.phone && !r.fathersphone && !r.fatherphone && !r.guardianphone) validationErrors.push(`Row ${rowNum}: Phone is required`);
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
        grade: Number(r.gradeclass || r.grade || r.class),
        section: r.section,
        rollNo: r.rollno || r.roll,
        admissionNo: r.admissionno,
        dateOfBirth: r.dateofbirth || null,
        aadhaarNo: r.aadhaarno || null,
        bloodGroup: r.bloodgroup || null,
        nationality: r.nationality || null,
        motherTongue: r.mothertongue || null,
        category: (r.category || 'GEN').toUpperCase(),
        religion: r.religion || null,
        isRte: /^(y|yes|true|1)$/i.test(r.rteyesno || r.isrte || r.rte || ''),
        admissionDate: r.admissiondate || null,
        house: r.house || null,
        fatherName: r.fathersname || r.fathername || null,
        fatherPhone: r.fathersphone || r.fatherphone || null,
        fatherOccupation: r.fathersoccupation || r.fatheroccupation || null,
        fatherEducation: r.fatherseducation || r.fathereducation || null,
        motherName: r.mothersname || r.mothername || null,
        motherPhone: r.mothersphone || r.motherphone || null,
        motherOccupation: r.mothersoccupation || r.motheroccupation || null,
        motherEducation: r.motherseducation || r.mothereducation || null,
        guardianName: r.guardianname || null,
        guardianPhone: r.guardianphone || null,
        guardianRelation: r.guardianrelation || 'Father',
        stateAddr: r.state || null,
        districtAddr: r.district || null,
        blockAddr: r.block || null,
        village: r.villageetown || r.village || null,
        pinCode: r.pincode || null,
        permanentAddress: r.permanentaddress || null,
        correspondenceAddress: r.correspondenceaddress || null,
        previousSchool: r.previousschool || null,
        medium: r.mediumofinstruction || r.medium || null,
        subjectsOpted: r.subjectsopted || null,
        height: r.heightcm ? Number(r.heightcm) : null,
        weight: r.weightkg ? Number(r.weightkg) : null,
        vaccinationStatus: r.vaccinationstatus || null,
        hostelRequired: /^(y|yes|true|1)$/i.test(r.hostelrequiredyesno || r.hostelrequired || ''),
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
      const gradeNum = promoteGrade ? Number(promoteGrade) : undefined;
      const res = await api.students.promote(scope.schoolId, gradeNum);
      const scope_label = promoteGrade ? `Class ${promoteGrade}` : 'all grades';
      setMsg(`Promoted ${res.promoted} students (${scope_label}), ${res.graduated} graduated.`);
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
              <button onClick={downloadStudentTemplate} className="btn-outline" title="Download Excel template">
                <i className="fas fa-file-excel text-emerald-600" />Template
              </button>
              <label className="btn-outline cursor-pointer" title="Upload filled Excel template">
                <i className="fas fa-file-import" />Bulk Upload
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && onBulk(e.target.files[0])} />
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

      {/* Students by Grade — boys vs girls grouped, Class 6–12 */}
      {enrollment && enrollment.byGrade.length > 0 && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-heading font-semibold text-navy-700">Students by Grade</h2>
              <p className="text-xs text-slate-400 mt-0.5">Class-wise boys &amp; girls enrolment</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#0076BC' }} />Boys
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#EC4899' }} />Girls
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={enrollment.byGrade.filter((g) => g.grade >= 6).map((g) => ({
                grade: g.grade, Boys: g.boys, Girls: g.girls,
              }))}
              margin={{ top: 4, right: 8, bottom: 4, left: -16 }}
              barCategoryGap="30%"
              barGap={2}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="grade" fontSize={12} tickFormatter={(g) => `Class ${g}`} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip
                labelFormatter={(g) => `Class ${g}`}
                formatter={(v: number, n: string) => [v.toLocaleString(), n]}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.08)' }}
              />
              <Bar dataKey="Boys" fill="#0076BC" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Girls" fill="#EC4899" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category / Religion / RTE breakdown — from live student summary */}
      {summary && (summary.byCategory.length > 0 || summary.byReligion.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Category donut */}
          {summary.byCategory.length > 0 && (
            <div className="panel p-5">
              <h2 className="font-heading font-semibold text-navy-700 mb-3 text-sm">By Category</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={summary.byCategory} dataKey="count" nameKey="category" cx="50%" cy="50%" innerRadius={42} outerRadius={68} isAnimationActive={false}>
                    {summary.byCategory.map((_, i) => (
                      <Cell key={i} fill={['#0076BC','#3AAAC5','#F59E0B','#EF4444'][i % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(), name]} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* Religion donut */}
          {summary.byReligion.length > 0 && (
            <div className="panel p-5">
              <h2 className="font-heading font-semibold text-navy-700 mb-3 text-sm">By Religion</h2>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={summary.byReligion} dataKey="count" nameKey="religion" cx="50%" cy="50%" innerRadius={42} outerRadius={68} isAnimationActive={false}>
                    {summary.byReligion.map((_, i) => (
                      <Cell key={i} fill={['#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899','#6B7280'][i % 6]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number, name: string) => [v.toLocaleString(), name]} contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v) => v} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {/* RTE KPI chip */}
          <div className="panel p-5 flex flex-col justify-center items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
              <i className="fas fa-graduation-cap text-emerald-600 text-xl" />
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-navy-700">{summary.rte.toLocaleString()}</div>
              <div className="text-sm text-slate-500 mt-1">RTE Students</div>
              <div className="text-xs text-emerald-600 mt-1 font-medium">
                Right to Education Act admissions
              </div>
            </div>
            {summary.total > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div
                  className="bg-emerald-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, (summary.rte / summary.total) * 100).toFixed(1)}%` }}
                />
              </div>
            )}
            <div className="text-xs text-slate-400">
              {summary.total > 0 ? `${((summary.rte / summary.total) * 100).toFixed(1)}% of total students` : '—'}
            </div>
          </div>
        </div>
      )}

      <ScopeBar value={scope} onChange={setScope} />

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle mt-0.5 shrink-0" /><span className="whitespace-pre-line">{err}</span></div>}

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

      {/* ── Edit student modal (7-tab) ─────────────────────── */}
      {editStudent && (
        <StudentModal
          student={editStudent}
          editForm={editForm}
          setEditForm={setEditForm}
          onSubmit={submitEdit}
          onClose={() => setEditStudent(null)}
        />
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
      {confirmPromote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                <i className="fas fa-level-up-alt text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-navy-700">Promote Students</p>
                <p className="text-xs text-slate-500">Move students one grade up</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Grade to promote (optional)</label>
              <select
                className={inputCls}
                value={promoteGrade}
                onChange={(e) => setPromoteGrade(e.target.value)}
              >
                <option value="">All grades</option>
                {GRADES_6_12.map((g) => <option key={g} value={g}>Class {g} only</option>)}
              </select>
              <p className="text-xs text-slate-400 mt-1.5">
                {promoteGrade
                  ? `Only Class ${promoteGrade} students will be promoted. Class 12 → graduated.`
                  : 'All non-dropout students will be promoted one grade. Class 12 → graduated.'}
              </p>
            </div>
            <div className="flex gap-2 justify-end pt-2 border-t border-slate-100">
              <button onClick={() => { setConfirmPromote(false); setPromoteGrade(''); }} className="btn-outline text-sm">Cancel</button>
              <button onClick={() => { promote(); setConfirmPromote(false); setPromoteGrade(''); }} className="btn-primary text-sm">
                <i className="fas fa-level-up-alt" />Promote
              </button>
            </div>
          </div>
        </div>
      )}
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

// ── Document field: text note OR uploaded file ────────────────────────────────

function DocField({ label, value, onChange, folder, accept }: {
  label: string;
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  folder: string;
  accept: string;
}) {
  const [uploadMode, setUploadMode] = useState(value?.startsWith('http') ?? false);

  if (uploadMode || value?.startsWith('http')) {
    return (
      <Field label={label}>
        <FileUpload
          value={value?.startsWith('http') ? value : null}
          onChange={url => { onChange(url); if (!url) setUploadMode(false); }}
          folder={folder}
          accept={accept}
          imagePreview={accept.startsWith('image') && !accept.includes('pdf')}
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <div className="flex gap-1.5">
        <input
          className={inputCls + ' flex-1'}
          placeholder="Reference note (file no., date…)"
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
        />
        <button
          type="button"
          onClick={() => setUploadMode(true)}
          title="Upload file"
          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-600 transition-colors flex-shrink-0"
        >
          <i className="fas fa-upload text-xs" />
        </button>
      </div>
    </Field>
  );
}

// ── Student Profile Modal (7 tabs) ────────────────────────────────────────────

type StudentTabId = 'basic' | 'family' | 'address' | 'academic' | 'health' | 'hostel' | 'documents' | 'status';

const STUDENT_TABS: { id: StudentTabId; label: string; icon: string }[] = [
  { id: 'basic',     label: 'Basic Info',  icon: 'fas fa-id-card' },
  { id: 'family',    label: 'Family',      icon: 'fas fa-users' },
  { id: 'address',   label: 'Address',     icon: 'fas fa-map-marker-alt' },
  { id: 'academic',  label: 'Academic',    icon: 'fas fa-graduation-cap' },
  { id: 'health',    label: 'Health',      icon: 'fas fa-heartbeat' },
  { id: 'hostel',    label: 'Hostel',      icon: 'fas fa-building' },
  { id: 'documents', label: 'Documents',   icon: 'fas fa-file-alt' },
  { id: 'status',    label: 'Status',      icon: 'fas fa-chart-pie' },
];

const STUDENT_COMPLETION_FIELDS: (keyof Student)[] = [
  'firstName', 'lastName', 'gender', 'dateOfBirth', 'bloodGroup', 'aadhaarNo',
  'category', 'nationality', 'motherTongue', 'admissionDate', 'house',
  'fatherName', 'fatherPhone', 'fatherOccupation',
  'motherName', 'motherPhone', 'motherOccupation',
  'guardianName', 'guardianPhone',
  'stateAddr', 'village', 'permanentAddress', 'pinCode',
  'previousSchool', 'medium', 'subjectsOpted',
  'height', 'weight', 'vaccinationStatus',
  'hostelRequired', 'docAadhaar', 'docBirthCert',
];

function isFilledS(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '';
}

function TriToggle({ value, onChange }: { value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const opts: { v: boolean | null; label: string; active: string }[] = [
    { v: true,  label: 'Yes', active: 'bg-emerald-500 text-white' },
    { v: null,  label: '—',   active: 'bg-slate-300 text-slate-600' },
    { v: false, label: 'No',  active: 'bg-red-400 text-white' },
  ];
  const cur = value === undefined ? null : (value ?? null);
  return (
    <div className="flex rounded-lg overflow-hidden border border-slate-200">
      {opts.map(o => (
        <button key={String(o.v)} type="button"
          onClick={() => onChange(o.v)}
          className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${cur === o.v ? o.active : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StudentModal({
  student, editForm, setEditForm, onSubmit, onClose,
}: {
  student: Student;
  editForm: Partial<Student>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<Student>>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<StudentTabId>('basic');
  const upd = (patch: Partial<Student>) => setEditForm(f => ({ ...f, ...patch }));

  const filled = STUDENT_COMPLETION_FIELDS.filter(k => isFilledS(editForm[k])).length;
  const pct = Math.round((filled / STUDENT_COMPLETION_FIELDS.length) * 100);

  const tabDot = (tid: StudentTabId): 'full' | 'partial' | 'empty' | 'none' => {
    const fieldsByTab: Record<StudentTabId, (keyof Student)[]> = {
      basic:     ['firstName', 'lastName', 'dateOfBirth', 'bloodGroup', 'aadhaarNo', 'nationality', 'motherTongue', 'admissionDate', 'house'],
      family:    ['fatherName', 'fatherPhone', 'fatherOccupation', 'motherName', 'motherPhone', 'motherOccupation', 'guardianName', 'guardianPhone'],
      address:   ['stateAddr', 'village', 'permanentAddress', 'pinCode'],
      academic:  ['previousSchool', 'medium', 'subjectsOpted'],
      health:    ['height', 'weight', 'vaccinationStatus'],
      hostel:    ['hostelRequired'],
      documents: ['docAadhaar', 'docBirthCert'],
      status:    [],
    };
    const fields = fieldsByTab[tid];
    if (!fields.length) return 'none';
    const any = fields.some(k => isFilledS(editForm[k]));
    const all = fields.every(k => isFilledS(editForm[k]));
    return all ? 'full' : any ? 'partial' : 'empty';
  };

  const dotCls = (d: string, active: boolean) =>
    `w-2.5 h-2.5 rounded-full border transition-all ${active ? 'scale-125 border-sky-400' : 'border-slate-200'} ${
      d === 'full' ? 'bg-emerald-400' : d === 'partial' ? 'bg-amber-400' : d === 'empty' ? 'bg-slate-200' : 'bg-transparent border-transparent'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center">
              <i className="fas fa-user-graduate text-sky-600" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-navy-700 text-lg leading-none">{student.name}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Class {student.grade} · {student.admissionNo ?? student.rollNo ?? student.id.slice(-6)}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-slate-400 mb-0.5">Profile {pct}%</div>
              <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#0076BC' }} />
              </div>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-lg" /></button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-slate-100 flex-shrink-0 overflow-x-auto">
          {STUDENT_TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} type="button"
              className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                tab === t.id ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              <i className={t.icon} />{t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-6 space-y-4 flex-1">

            {/* TAB 1 — Basic Info */}
            {tab === 'basic' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identification</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Admission No"><input className={inputCls} value={editForm.admissionNo ?? ''} onChange={e => upd({ admissionNo: e.target.value })} /></Field>
                <Field label="Roll No"><input className={inputCls} value={editForm.rollNo ?? ''} onChange={e => upd({ rollNo: e.target.value })} /></Field>
                <Field label="Display Name (required)"><input required className={inputCls} value={editForm.name ?? ''} onChange={e => upd({ name: e.target.value })} /></Field>
                <Field label="First Name"><input className={inputCls} value={editForm.firstName ?? ''} onChange={e => upd({ firstName: e.target.value || null })} /></Field>
                <Field label="Middle Name"><input className={inputCls} value={editForm.middleName ?? ''} onChange={e => upd({ middleName: e.target.value || null })} /></Field>
                <Field label="Last Name"><input className={inputCls} value={editForm.lastName ?? ''} onChange={e => upd({ lastName: e.target.value || null })} /></Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Personal Details</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Gender">
                  <select className={inputCls} value={editForm.gender} onChange={e => upd({ gender: e.target.value as Student['gender'] })}>
                    {GENDERS.map(g => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                  </select>
                </Field>
                <Field label="Date of Birth"><input type="date" className={inputCls} value={editForm.dateOfBirth?.slice(0, 10) ?? ''} onChange={e => upd({ dateOfBirth: e.target.value || null })} /></Field>
                <Field label="Blood Group">
                  <select className={inputCls} value={editForm.bloodGroup ?? ''} onChange={e => upd({ bloodGroup: e.target.value || null })}>
                    <option value="">—</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </Field>
                <Field label="Aadhaar No"><input className={inputCls} value={editForm.aadhaarNo ?? ''} onChange={e => upd({ aadhaarNo: e.target.value || null })} /></Field>
                <Field label="Category">
                  <select className={inputCls} value={editForm.category} onChange={e => upd({ category: e.target.value as Student['category'] })}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Religion">
                  <select className={inputCls} value={editForm.religion ?? ''} onChange={e => upd({ religion: e.target.value || null })}>
                    <option value="">—</option>
                    {['Hindu','Muslim','Sikh','Christian','Buddhist','Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Nationality"><input className={inputCls} value={editForm.nationality ?? ''} onChange={e => upd({ nationality: e.target.value || null })} /></Field>
                <Field label="Mother Tongue"><input className={inputCls} value={editForm.motherTongue ?? ''} onChange={e => upd({ motherTongue: e.target.value || null })} /></Field>
                <Field label="Photo">
                  <FileUpload
                    value={editForm.photoUrl}
                    onChange={url => upd({ photoUrl: url })}
                    folder={`students/${student.id}/photo`}
                    accept="image/*"
                    imagePreview
                  />
                </Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Enrolment</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Admission Date"><input type="date" className={inputCls} value={editForm.admissionDate?.slice(0, 10) ?? ''} onChange={e => upd({ admissionDate: e.target.value || null })} /></Field>
                <Field label="Admission Class">
                  <select className={inputCls} value={editForm.admissionClass ?? ''} onChange={e => upd({ admissionClass: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {GRADES_6_12.map(g => <option key={g} value={g}>Class {g}</option>)}
                  </select>
                </Field>
                <Field label="Admission Type">
                  <select className={inputCls} value={editForm.admissionType ?? ''} onChange={e => upd({ admissionType: e.target.value || null })}>
                    <option value="">—</option>
                    <option>New</option>
                    <option>Transfer</option>
                  </select>
                </Field>
                <Field label="Current Grade">
                  <select className={inputCls} value={editForm.grade} onChange={e => upd({ grade: Number(e.target.value) })}>
                    {GRADES_6_12.map(g => <option key={g} value={g}>Class {g}</option>)}
                  </select>
                </Field>
                <Field label="Section"><input className={inputCls} value={editForm.section ?? ''} onChange={e => upd({ section: e.target.value || null })} /></Field>
                <Field label="House / Group"><input className={inputCls} value={editForm.house ?? ''} onChange={e => upd({ house: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 2 — Family */}
            {tab === 'family' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Father's Details</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Father Name"><input className={inputCls} value={editForm.fatherName ?? ''} onChange={e => upd({ fatherName: e.target.value || null })} /></Field>
                <Field label="Father Phone"><input className={inputCls} value={editForm.fatherPhone ?? ''} onChange={e => upd({ fatherPhone: e.target.value || null })} /></Field>
                <Field label="Occupation"><input className={inputCls} value={editForm.fatherOccupation ?? ''} onChange={e => upd({ fatherOccupation: e.target.value || null })} /></Field>
                <Field label="Education"><input className={inputCls} value={editForm.fatherEducation ?? ''} onChange={e => upd({ fatherEducation: e.target.value || null })} /></Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Mother's Details</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Mother Name"><input className={inputCls} value={editForm.motherName ?? ''} onChange={e => upd({ motherName: e.target.value || null })} /></Field>
                <Field label="Mother Phone"><input className={inputCls} value={editForm.motherPhone ?? ''} onChange={e => upd({ motherPhone: e.target.value || null })} /></Field>
                <Field label="Occupation"><input className={inputCls} value={editForm.motherOccupation ?? ''} onChange={e => upd({ motherOccupation: e.target.value || null })} /></Field>
                <Field label="Education"><input className={inputCls} value={editForm.motherEducation ?? ''} onChange={e => upd({ motherEducation: e.target.value || null })} /></Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Guardian / Emergency Contact</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Guardian Name"><input className={inputCls} value={editForm.guardianName ?? ''} onChange={e => upd({ guardianName: e.target.value || null })} /></Field>
                <Field label="Phone"><input className={inputCls} value={editForm.guardianPhone ?? ''} onChange={e => upd({ guardianPhone: e.target.value || null })} /></Field>
                <Field label="Relation">
                  <select className={inputCls} value={editForm.guardianRelation ?? ''} onChange={e => upd({ guardianRelation: e.target.value || null })}>
                    <option value="">—</option>
                    {['Father','Mother','Guardian','Uncle','Aunt','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
            </>}

            {/* TAB 3 — Address */}
            {tab === 'address' && <AddressTab form={editForm} upd={upd} inputCls={inputCls} />}

            {/* TAB 4 — Academic */}
            {tab === 'academic' && <>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Previous School</p>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Previous School"><input className={inputCls} value={editForm.previousSchool ?? ''} onChange={e => upd({ previousSchool: e.target.value || null })} /></Field>
                <Field label="Previous Class">
                  <select className={inputCls} value={editForm.previousClass ?? ''} onChange={e => upd({ previousClass: e.target.value ? Number(e.target.value) : null })}>
                    <option value="">—</option>
                    {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>Class {i+1}</option>)}
                  </select>
                </Field>
                <Field label="TC Number"><input className={inputCls} value={editForm.tcNumber ?? ''} onChange={e => upd({ tcNumber: e.target.value || null })} /></Field>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest pt-2">Current Academic</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Medium of Instruction">
                  <select className={inputCls} value={editForm.medium ?? ''} onChange={e => upd({ medium: e.target.value || null })}>
                    <option value="">—</option>
                    {['Hindi','English','Urdu','Sanskrit','Other'].map(m => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Subjects Opted (comma-separated)"><input className={inputCls} value={editForm.subjectsOpted ?? ''} onChange={e => upd({ subjectsOpted: e.target.value || null })} /></Field>
                <Field label="Promotion Status">
                  <select className={inputCls} value={editForm.promotionStatus ?? ''} onChange={e => upd({ promotionStatus: e.target.value || null })}>
                    <option value="">—</option>
                    <option>Promoted</option>
                    <option>Detained</option>
                    <option>Passed Out</option>
                  </select>
                </Field>
                <Field label="CGPA"><input type="number" min="0" max="10" step="0.1" className={inputCls} value={editForm.cgpa ?? ''} onChange={e => upd({ cgpa: e.target.value ? parseFloat(e.target.value) : null })} /></Field>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="RTE (Right to Education)">
                  <select className={inputCls} value={editForm.isRte ? 'yes' : 'no'} onChange={e => upd({ isRte: e.target.value === 'yes' })}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="Bank Account No"><input className={inputCls} value={editForm.bankAccount ?? ''} onChange={e => upd({ bankAccount: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 5 — Health */}
            {tab === 'health' && <>
              <div className="grid md:grid-cols-3 gap-4">
                <Field label="Height (cm)"><input type="number" min="0" max="300" step="0.1" className={inputCls} value={editForm.height ?? ''} onChange={e => upd({ height: e.target.value ? parseFloat(e.target.value) : null })} /></Field>
                <Field label="Weight (kg)"><input type="number" min="0" max="200" step="0.1" className={inputCls} value={editForm.weight ?? ''} onChange={e => upd({ weight: e.target.value ? parseFloat(e.target.value) : null })} /></Field>
                <Field label="Blood Group">
                  <select className={inputCls} value={editForm.bloodGroup ?? ''} onChange={e => upd({ bloodGroup: e.target.value || null })}>
                    <option value="">—</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="CWSN / Disability Status"><TriToggle value={editForm.cwsnStatus} onChange={v => upd({ cwsnStatus: v })} /></Field>
                <Field label="Vaccination Status">
                  <select className={inputCls} value={editForm.vaccinationStatus ?? ''} onChange={e => upd({ vaccinationStatus: e.target.value || null })}>
                    <option value="">—</option>
                    <option>Complete</option>
                    <option>Partial</option>
                    <option>Not Done</option>
                  </select>
                </Field>
              </div>
              <Field label="Medical Conditions / Health Notes">
                <textarea rows={3} className={inputCls} value={editForm.healthNotes ?? ''} onChange={e => upd({ healthNotes: e.target.value || null })} />
              </Field>
              <Field label="Last Health Checkup Date"><input type="date" className={inputCls} value={editForm.healthCheckupDate?.slice(0, 10) ?? ''} onChange={e => upd({ healthCheckupDate: e.target.value || null })} /></Field>
            </>}

            {/* TAB 6 — Hostel */}
            {tab === 'hostel' && <>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Hostel Required"><TriToggle value={editForm.hostelRequired} onChange={v => upd({ hostelRequired: v })} /></Field>
                <Field label="Hostel Fee Status">
                  <select className={inputCls} value={editForm.hostelFeeStatus ?? ''} onChange={e => upd({ hostelFeeStatus: e.target.value || null })}>
                    <option value="">—</option>
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Waived</option>
                  </select>
                </Field>
                <Field label="Hostel Name"><input className={inputCls} value={editForm.hostelName ?? ''} onChange={e => upd({ hostelName: e.target.value || null })} /></Field>
                <Field label="Room Number"><input className={inputCls} value={editForm.roomNumber ?? ''} onChange={e => upd({ roomNumber: e.target.value || null })} /></Field>
              </div>
            </>}

            {/* TAB 7 — Documents */}
            {tab === 'documents' && <>
              <p className="text-xs text-slate-400">Upload files directly or type a reference note. Uploaded files are stored securely in S3.</p>
              <div className="grid md:grid-cols-2 gap-5">
                {([
                  ['docAadhaar',   'Aadhaar Card',              'image/*,application/pdf'],
                  ['docBirthCert', 'Birth Certificate',         'image/*,application/pdf'],
                  ['docTc',        'Transfer Certificate (TC)', 'image/*,application/pdf'],
                  ['docCaste',     'Caste Certificate',         'image/*,application/pdf'],
                  ['docIncome',    'Income Certificate',        'image/*,application/pdf'],
                  ['docResidence', 'Residence Certificate',     'image/*,application/pdf'],
                  ['docPhoto',     'Passport Photo',            'image/*'],
                  ['docMedical',   'Medical Certificate',       'image/*,application/pdf'],
                  ['docOther',     'Other Document',            '*/*'],
                ] as [keyof Student, string, string][]).map(([key, label, accept]) => (
                  <DocField
                    key={key}
                    label={label}
                    value={editForm[key] as string | null | undefined}
                    onChange={val => upd({ [key]: val } as Partial<Student>)}
                    folder={`students/${student.id}/docs`}
                    accept={accept}
                  />
                ))}
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
                    <p className="font-semibold text-slate-500 mb-1.5">Missing ({STUDENT_COMPLETION_FIELDS.filter(k => !isFilledS(editForm[k])).length})</p>
                    <div className="flex flex-wrap gap-1">
                      {STUDENT_COMPLETION_FIELDS.filter(k => !isFilledS(editForm[k])).map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-red-50 border border-red-100 text-red-600">{k}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-500 mb-1.5">Filled ({filled})</p>
                    <div className="flex flex-wrap gap-1">
                      {STUDENT_COMPLETION_FIELDS.filter(k => isFilledS(editForm[k])).map(k => (
                        <span key={k} className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-100 text-emerald-700">{k}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              {/* Status fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Student Status">
                  <select className={inputCls} value={editForm.isDropout ? 'dropout' : 'active'} onChange={e => upd({ isDropout: e.target.value === 'dropout' })}>
                    <option value="active">Active</option>
                    <option value="dropout">Dropout</option>
                  </select>
                </Field>
                <Field label="Dropout Reason">
                  <input className={inputCls} disabled={!editForm.isDropout} value={editForm.dropoutReason ?? ''}
                    onChange={e => upd({ dropoutReason: e.target.value || null })} />
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
              {STUDENT_TABS.map(t => (
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
