import { useEffect, useRef, useState } from 'react';
import { useAcademicYear } from '../contexts/AcademicYearContext';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { api, type DistrictMeta, type SchoolFormData, type SchoolRow } from '../api';
import type { DistrictSummary } from '@edubeam/shared';
import { exportCsv } from '../export';
import { useAuth } from '../auth';
import { stateFor } from '../config/states';

// ── Login credential popover ──────────────────────────────────────────────────

function LoginPopover({ onClose, email, password }: { onClose: () => void; email: string; password: string }) {
  const [copied, setCopied] = useState(false);
  const copy = (text: string) => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="absolute right-0 top-8 z-50 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-4 text-sm" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-navy-700 text-xs uppercase tracking-wide">Login Credentials</span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times" /></button>
      </div>
      <div className="space-y-2">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-xs text-slate-500 mb-0.5">Username (Email)</div>
          <div className="font-mono text-xs text-navy-700 break-all">{email}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <div className="text-xs text-slate-500 mb-0.5">Password</div>
          <div className="font-mono text-xs text-navy-700">{password}</div>
        </div>
      </div>
      <button
        onClick={() => copy(`Email: ${email}\nPassword: ${password}`)}
        className="mt-3 w-full text-xs py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
      >
        <i className={`fas ${copied ? 'fa-check text-emerald-500' : 'fa-copy'} mr-1.5`} />
        {copied ? 'Copied!' : 'Copy credentials'}
      </button>
    </div>
  );
}

interface SchoolLoginBtnProps { schoolId: string }

function SchoolLoginBtn({ schoolId }: SchoolLoginBtnProps) {
  const [open, setOpen] = useState(false);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy(true);
    try {
      const c = await api.users.upsertSchoolLogin(schoolId);
      setCreds(c);
      setOpen(true);
    } finally { setBusy(false); }
  };

  useEffect(() => {
    const close = () => setOpen(false);
    if (open) document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [open]);

  return (
    <div className="relative inline-block">
      {creds && open
        ? <LoginPopover email={creds.email} password={creds.password} onClose={() => setOpen(false)} />
        : null}
      {creds
        ? (
          <button
            onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
            className="text-xs text-emerald-600 hover:text-emerald-800 font-medium px-2 py-1 rounded hover:bg-emerald-50 transition-colors"
          >
            <i className="fas fa-key mr-1" />Login
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={busy}
            className="text-xs text-sky-600 hover:text-sky-800 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors disabled:opacity-50"
          >
            {busy ? <i className="fas fa-circle-notch fa-spin mr-1" /> : <i className="fas fa-user-plus mr-1" />}
            Set Login
          </button>
        )}
      {creds && (
        <button
          onClick={handleCreate}
          disabled={busy}
          className="text-xs text-orange-500 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50 transition-colors disabled:opacity-50"
          title="Reset password to username"
        >
          <i className="fas fa-redo mr-1" />Reset
        </button>
      )}
    </div>
  );
}

// ── School form modal (tabbed) ────────────────────────────────────────────────

type TabId = 'general' | 'land' | 'building' | 'furniture' | 'wash' | 'electric' | 'hostel' | 'academic' | 'status';

interface Tab { id: TabId; label: string; icon: string }
const TABS: Tab[] = [
  { id: 'general',   label: 'General Info',        icon: 'fa-info-circle' },
  { id: 'land',      label: 'Land Record',          icon: 'fa-map' },
  { id: 'building',  label: 'Building',             icon: 'fa-building' },
  { id: 'furniture', label: 'Furniture',            icon: 'fa-chair' },
  { id: 'wash',      label: 'Water & Sanitation',   icon: 'fa-tint' },
  { id: 'electric',  label: 'Electricity & Lab',    icon: 'fa-bolt' },
  { id: 'hostel',    label: 'Hostel',               icon: 'fa-bed' },
  { id: 'academic',  label: 'Academic & Safety',    icon: 'fa-graduation-cap' },
  { id: 'status',    label: 'Completion Status',    icon: 'fa-chart-pie' },
];

// Fields counted for profile completion
const COMPLETION_FIELDS: { key: string; label: string }[] = [
  { key: 'principalName',         label: 'Principal Name' },
  { key: 'phone',                 label: 'Contact Number' },
  { key: 'phone2',                label: 'Contact Number 2' },
  { key: 'email',                 label: 'Email' },
  { key: 'address',               label: 'Address' },
  { key: 'registrationNumber',    label: 'Registration Number' },
  { key: 'yearEstablished',       label: 'Year of Establishment' },
  { key: 'assemblyConstituency',  label: 'Assembly Constituency' },
  { key: 'gramPanchayat',         label: 'Gram Panchayat' },
  { key: 'managedBy',             label: 'Managed By' },
  { key: 'mediumOfInstruction',   label: 'Medium of Instruction' },
  { key: 'totalLand',             label: 'Total Land' },
  { key: 'hasGarden',             label: 'Garden' },
  { key: 'landInSchoolName',      label: 'Land in School Name' },
  { key: 'buildingType',          label: 'Building Type' },
  { key: 'numClassrooms',         label: 'Number of Classrooms' },
  { key: 'hasPlayground',         label: 'Playground' },
  { key: 'hasBoundaryWall',       label: 'Boundary Wall' },
  { key: 'hasLibrary',            label: 'Library' },
  { key: 'hasComputerLab',        label: 'Computer Lab' },
  { key: 'hasDrinkingWater',      label: 'Drinking Water' },
  { key: 'drinkingWaterSource',   label: 'Water Source' },
  { key: 'numUsableToilets',      label: 'Usable Toilets' },
  { key: 'numGirlsToilets',       label: 'Girls Toilets' },
  { key: 'numBoysToilets',        label: 'Boys Toilets' },
  { key: 'electricityAvailability', label: 'Electricity' },
  { key: 'numDesktopPCs',         label: 'Desktop PCs' },
  { key: 'classesFrom',           label: 'Classes (From)' },
  { key: 'classesTo',             label: 'Classes (To)' },
  { key: 'streams',               label: 'Streams' },
  { key: 'hasFireSafety',         label: 'Fire Safety Equipment' },
  { key: 'emergencyContact',      label: 'Emergency Contact' },
];

function isFilled(v: any): boolean {
  if (v === null || v === undefined || v === '') return false;
  return true;
}

// Profile completion % for a school row (used in the Schools list table).
function schoolCompletionPct(s: any): number {
  const filled = COMPLETION_FIELDS.filter(f => isFilled(s[f.key])).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
}

// Three-state toggle: null = unknown, true = Yes, false = No
function TriToggle({ label, value, onChange }: { label: string; value: boolean | null | undefined; onChange: (v: boolean | null) => void }) {
  const base = 'px-3 py-1.5 text-xs font-medium rounded transition-colors border';
  return (
    <div>
      <div className="form-label mb-1.5">{label}</div>
      <div className="flex gap-1">
        <button type="button" onClick={() => onChange(true)}
          className={`${base} ${value === true ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200 text-slate-500 hover:border-emerald-300'}`}>
          Yes
        </button>
        <button type="button" onClick={() => onChange(false)}
          className={`${base} ${value === false ? 'bg-red-400 border-red-400 text-white' : 'border-slate-200 text-slate-500 hover:border-red-300'}`}>
          No
        </button>
        <button type="button" onClick={() => onChange(null)}
          className={`${base} ${value == null ? 'bg-slate-200 border-slate-200 text-slate-600' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`}>
          —
        </button>
      </div>
    </div>
  );
}

interface SchoolModalProps {
  school?: SchoolRow | null;
  onClose: () => void;
  onSaved: (s: SchoolRow) => void;
  readonlyIdentity?: boolean;
}

function SchoolModal({ school, onClose, onSaved, readonlyIdentity }: SchoolModalProps) {
  const isEdit = !!school;
  const [tab, setTab] = useState<TabId>('general');
  const [districts, setDistricts] = useState<DistrictMeta[]>([]);
  const [districtId, setDistrictId] = useState(school?.districtId ?? '');
  const s = school as any;
  const [form, setForm] = useState<any>({
    // Identity
    name: s?.name ?? '',
    udiseCode: s?.udiseCode ?? '',
    siteCode: s?.siteCode ?? '',
    blockId: s?.blockId ?? '',
    type: s?.type ?? '',
    hasVirtualClassroom: s?.hasVirtualClassroom ?? false,
    hasIctLab: s?.hasIctLab ?? false,
    // General
    principalName: s?.principalName ?? '',
    phone: s?.phone ?? '',
    phone2: s?.phone2 ?? '',
    email: s?.email ?? '',
    address: s?.address ?? '',
    registrationNumber: s?.registrationNumber ?? '',
    yearEstablished: s?.yearEstablished ?? '',
    assemblyConstituency: s?.assemblyConstituency ?? '',
    gramPanchayat: s?.gramPanchayat ?? '',
    managedBy: s?.managedBy ?? '',
    mediumOfInstruction: s?.mediumOfInstruction ?? '',
    classesFrom: s?.classesFrom ?? null,
    classesTo: s?.classesTo ?? null,
    streams: s?.streams ?? '',
    // Land
    totalLand: s?.totalLand ?? null,
    totalLandUnit: s?.totalLandUnit ?? 'acres',
    hasPlayground: s?.hasPlayground ?? null,
    hasBoundaryWall: s?.hasBoundaryWall ?? null,
    hasGarden: s?.hasGarden ?? null,
    landInSchoolName: s?.landInSchoolName ?? null,
    // Building
    buildingType: s?.buildingType ?? '',
    hasHmRoom: s?.hasHmRoom ?? null,
    hasOfficeRoom: s?.hasOfficeRoom ?? null,
    hasCommonRoom: s?.hasCommonRoom ?? null,
    numClassrooms: s?.numClassrooms ?? null,
    hasComputerRoom: s?.hasComputerRoom ?? null,
    hasLibrary: s?.hasLibrary ?? null,
    hasArtCraftRoom: s?.hasArtCraftRoom ?? null,
    hasSmartClassroom: s?.hasSmartClassroom ?? null,
    numBuildings: s?.numBuildings ?? null,
    campusArea: s?.campusArea ?? null,
    campusAreaUnit: s?.campusAreaUnit ?? 'acres',
    builtUpArea: s?.builtUpArea ?? null,
    // Furniture
    hmChairs: s?.hmChairs ?? null, hmTables: s?.hmTables ?? null, hmCupboards: s?.hmCupboards ?? null,
    officeChairs: s?.officeChairs ?? null, officeTables: s?.officeTables ?? null, officeCupboards: s?.officeCupboards ?? null,
    commonChairs: s?.commonChairs ?? null, commonTables: s?.commonTables ?? null, commonCupboards: s?.commonCupboards ?? null,
    classChairs: s?.classChairs ?? null, classTables: s?.classTables ?? null, classCupboards: s?.classCupboards ?? null,
    computerChairs: s?.computerChairs ?? null, computerTables: s?.computerTables ?? null, computerCupboards: s?.computerCupboards ?? null,
    libraryChairs: s?.libraryChairs ?? null, libraryTables: s?.libraryTables ?? null, libraryCupboards: s?.libraryCupboards ?? null,
    artChairs: s?.artChairs ?? null, artTables: s?.artTables ?? null, artCupboards: s?.artCupboards ?? null,
    vcChairs: s?.vcChairs ?? null, vcTables: s?.vcTables ?? null, vcCupboards: s?.vcCupboards ?? null,
    // Water
    hasDrinkingWater: s?.hasDrinkingWater ?? null,
    drinkingWaterSource: s?.drinkingWaterSource ?? '',
    hasOverheadTank: s?.hasOverheadTank ?? null,
    waterQuantity: s?.waterQuantity ?? null,
    hasWaterPurifier: s?.hasWaterPurifier ?? null,
    purifierInstallDate: s?.purifierInstallDate ?? '',
    hasHandwashing: s?.hasHandwashing ?? null,
    // Toilets
    numUsableToilets: s?.numUsableToilets ?? null,
    numUnusableToilets: s?.numUnusableToilets ?? null,
    numGirlsToilets: s?.numGirlsToilets ?? null,
    numBoysToilets: s?.numBoysToilets ?? null,
    numStaffToilets: s?.numStaffToilets ?? null,
    numCwsnToilets: s?.numCwsnToilets ?? null,
    numOtherToilets: s?.numOtherToilets ?? null,
    hasCwsnToilet: s?.hasCwsnToilet ?? null,
    // Electricity & Lab
    hasElectricity: s?.hasElectricity ?? null,
    electricityAvailability: s?.electricityAvailability ?? '',
    numDesktopPCs: s?.numDesktopPCs ?? null,
    hasUPS: s?.hasUPS ?? null,
    hasInternet: s?.hasInternet ?? null,
    hasInternetConnectivity: s?.hasInternetConnectivity ?? null,
    hasComputerLab: s?.hasComputerLab ?? null,
    hasCctv: s?.hasCctv ?? null,
    // Hostel
    numHostelStudentRooms: s?.numHostelStudentRooms ?? null,
    hostelStudentCapacity: s?.hostelStudentCapacity ?? null,
    numHostelStudents: s?.numHostelStudents ?? null,
    numHostelStaffRooms: s?.numHostelStaffRooms ?? null,
    hostelStaffCapacity: s?.hostelStaffCapacity ?? null,
    // Safety
    hasLaboratory: s?.hasLaboratory ?? null,
    hasFireSafety: s?.hasFireSafety ?? null,
    hasDisasterPlan: s?.hasDisasterPlan ?? null,
    hasFirstAid: s?.hasFirstAid ?? null,
    hasSecurityGuard: s?.hasSecurityGuard ?? null,
    emergencyContact: s?.emergencyContact ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.schoolDistricts().then(setDistricts);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, []);

  const blocks = districts.find(d => d.id === districtId)?.blocks ?? [];
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const numInput = (k: string) => (
    <input type="number" min={0} value={form[k] ?? ''} onChange={e => set(k, e.target.value ? +e.target.value : null)} placeholder="0" className="form-input" />
  );

  const filledFields = COMPLETION_FIELDS.filter(f => isFilled(form[f.key]));
  const pendingFields = COMPLETION_FIELDS.filter(f => !isFilled(form[f.key]));
  const pct = Math.round((filledFields.length / COMPLETION_FIELDS.length) * 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!readonlyIdentity && (!form.name.trim() || !form.udiseCode.trim() || !form.blockId)) {
      setError('Name, UDISE code and Block are required.');
      setTab('general');
      return;
    }
    setSaving(true);
    try {
      const saved = isEdit
        ? await api.updateSchool(school!.id, form)
        : await api.createSchool(form);
      onSaved(saved as SchoolRow);
    } catch (e: any) {
      setError(e.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const SectionHead = ({ title }: { title: string }) => (
    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 pb-1 border-b border-slate-100">{title}</h3>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full flex flex-col" style={{ maxWidth: '1100px', maxHeight: '95vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0 bg-gradient-to-r from-navy-700 to-sky-700 rounded-t-2xl">
          <div>
            <h2 className="font-heading font-bold text-white text-lg">
              {isEdit ? school!.name : 'Add New School'}
            </h2>
            {isEdit && <p className="text-xs text-sky-200 mt-0.5 font-mono">{school!.udiseCode}</p>}
          </div>
          <div className="flex items-center gap-4">
            {isEdit && (
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-white/80 font-medium">{pct}%</span>
              </div>
            )}
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10">
              <i className="fas fa-times" />
            </button>
          </div>
        </div>

        {/* Tab strip */}
        <div className="flex border-b border-slate-100 shrink-0 overflow-x-auto bg-slate-50/60">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id ? 'border-sky-500 text-sky-600 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/60'
              }`}>
              <i className={`fas ${t.icon} text-[10px]`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <i className="fas fa-exclamation-circle" />{error}
              </div>
            )}

            {/* ── General Information ── */}
            {tab === 'general' && (
              <div className="space-y-6">
                <SectionHead title="Identity" />
                {!readonlyIdentity && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="form-label">School Name *</label>
                      <input ref={firstRef} value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. GGIC ALMORA" className="form-input" required />
                    </div>
                    <div>
                      <label className="form-label">UDISE Code *</label>
                      <input value={form.udiseCode} onChange={e => set('udiseCode', e.target.value)} placeholder="e.g. 5090615301" className="form-input font-mono" required />
                    </div>
                    <div>
                      <label className="form-label">Registration Number</label>
                      <input value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} placeholder="e.g. REG/2024/001" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">District *</label>
                      <select value={districtId} onChange={e => { setDistrictId(e.target.value); set('blockId', ''); }} className="form-input" required>
                        <option value="">— Select district —</option>
                        {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Block *</label>
                      <select value={form.blockId} onChange={e => set('blockId', e.target.value)} className="form-input" required disabled={!districtId}>
                        <option value="">— Select block —</option>
                        {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Assembly Constituency</label>
                      <input value={form.assemblyConstituency} onChange={e => set('assemblyConstituency', e.target.value)} placeholder="e.g. Almora" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Gram Panchayat</label>
                      <input value={form.gramPanchayat} onChange={e => set('gramPanchayat', e.target.value)} placeholder="e.g. Dharandev" className="form-input" />
                    </div>
                  </div>
                )}
                {readonlyIdentity && <div className="text-sm text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3"><i className="fas fa-lock mr-2 text-amber-500" />School identity fields (name, UDISE, location) can only be changed by an administrator.</div>}

                <SectionHead title="School Details" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Type of School</label>
                    <select value={form.type ?? ''} onChange={e => set('type', e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      <option value="GIC">GIC</option>
                      <option value="GGIC">GGIC</option>
                      <option value="GPS">GPS</option>
                      <option value="GGPS">GGPS</option>
                      <option value="KGBV">KGBV</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Managed By</label>
                    <select value={form.managedBy} onChange={e => set('managedBy', e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      <option value="Govt">Government</option>
                      <option value="Aided">Govt Aided</option>
                      <option value="Private">Private Unaided</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Medium of Instruction</label>
                    <select value={form.mediumOfInstruction} onChange={e => set('mediumOfInstruction', e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      <option value="Hindi">Hindi</option>
                      <option value="English">English</option>
                      <option value="Bilingual">Hindi & English</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Year of Establishment</label>
                    <input type="number" min={1800} max={2030} value={form.yearEstablished ?? ''} onChange={e => set('yearEstablished', e.target.value ? +e.target.value : null)} placeholder="e.g. 1985" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Site Code (Virtual Classroom)</label>
                    <input value={form.siteCode ?? ''} onChange={e => set('siteCode', e.target.value)} placeholder="e.g. VVEAMO376" className="form-input font-mono" />
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input type="checkbox" checked={form.hasVirtualClassroom} onChange={e => set('hasVirtualClassroom', e.target.checked)} className="w-4 h-4 rounded accent-sky-600" />
                      <span className="text-sm font-medium text-slate-700">Virtual Classroom</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer pb-2">
                      <input type="checkbox" checked={form.hasIctLab} onChange={e => set('hasIctLab', e.target.checked)} className="w-4 h-4 rounded accent-sky-600" />
                      <span className="text-sm font-medium text-slate-700">ICT Lab</span>
                    </label>
                  </div>
                </div>

                <SectionHead title="Contact Information" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Principal / Head Master</label>
                    <input value={form.principalName} onChange={e => set('principalName', e.target.value)} placeholder="Full Name" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Contact Number</label>
                    <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Mobile Number" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Contact Number 2</label>
                    <input value={form.phone2} onChange={e => set('phone2', e.target.value)} placeholder="Second mobile (optional)" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Email</label>
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="school@example.com" className="form-input" />
                  </div>
                  <div className="col-span-3">
                    <label className="form-label">School Address</label>
                    <textarea value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full postal address" rows={2} className="form-input resize-none" />
                  </div>
                </div>

                <SectionHead title="Academic Range" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Classes From</label>
                    <select value={form.classesFrom ?? ''} onChange={e => set('classesFrom', e.target.value ? +e.target.value : null)} className="form-input">
                      <option value="">— Select —</option>
                      <option value={0}>Pre-Primary</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Class {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Classes To</label>
                    <select value={form.classesTo ?? ''} onChange={e => set('classesTo', e.target.value ? +e.target.value : null)} className="form-input">
                      <option value="">— Select —</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Class {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Streams Available</label>
                    <input value={form.streams} onChange={e => set('streams', e.target.value)} placeholder="Science, Arts, Commerce" className="form-input" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Land Record ── */}
            {tab === 'land' && (
              <div className="space-y-6">
                <SectionHead title="Land Details" />
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="form-label">Total Land Area</label>
                    <input type="number" min={0} step={0.01} value={form.totalLand ?? ''} onChange={e => set('totalLand', e.target.value ? +e.target.value : null)} placeholder="e.g. 2.5" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Unit</label>
                    <select value={form.totalLandUnit} onChange={e => set('totalLandUnit', e.target.value)} className="form-input">
                      <option value="acres">Acres</option>
                      <option value="sqm">Sq. Metres</option>
                      <option value="sqft">Sq. Feet</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="form-label">Built-up Area (sq.m)</label>
                    <input type="number" min={0} value={form.builtUpArea ?? ''} onChange={e => set('builtUpArea', e.target.value ? +e.target.value : null)} placeholder="e.g. 1200" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Campus Area Unit</label>
                    <select value={form.campusAreaUnit} onChange={e => set('campusAreaUnit', e.target.value)} className="form-input">
                      <option value="acres">Acres</option>
                      <option value="sqm">Sq. Metres</option>
                      <option value="sqft">Sq. Feet</option>
                    </select>
                  </div>
                </div>
                <SectionHead title="Facilities on Land" />
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  <TriToggle label="Playground Available" value={form.hasPlayground} onChange={v => set('hasPlayground', v)} />
                  <TriToggle label="Boundary Wall" value={form.hasBoundaryWall} onChange={v => set('hasBoundaryWall', v)} />
                  <TriToggle label="Garden / Green Space" value={form.hasGarden} onChange={v => set('hasGarden', v)} />
                  <TriToggle label="Land Records in the Name of School" value={form.landInSchoolName} onChange={v => set('landInSchoolName', v)} />
                </div>
              </div>
            )}

            {/* ── Building ── */}
            {tab === 'building' && (
              <div className="space-y-6">
                <SectionHead title="Building Type" />
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="form-label">Type of Building</label>
                    <select value={form.buildingType} onChange={e => set('buildingType', e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      <option value="Pucca">Pucca (Permanent)</option>
                      <option value="Semi-Pucca">Semi-Pucca</option>
                      <option value="Kuchcha">Kuchcha (Temporary)</option>
                      <option value="Rented">Rented Building</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">No. of Buildings</label>
                    {numInput('numBuildings')}
                  </div>
                  <div>
                    <label className="form-label">Total Classrooms</label>
                    {numInput('numClassrooms')}
                  </div>
                </div>

                <SectionHead title="Rooms Available" />
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  <TriToggle label="Head Master Room" value={form.hasHmRoom} onChange={v => set('hasHmRoom', v)} />
                  <TriToggle label="Office Room" value={form.hasOfficeRoom} onChange={v => set('hasOfficeRoom', v)} />
                  <TriToggle label="Common Room" value={form.hasCommonRoom} onChange={v => set('hasCommonRoom', v)} />
                  <TriToggle label="Computer Room" value={form.hasComputerRoom} onChange={v => set('hasComputerRoom', v)} />
                  <TriToggle label="Library Room" value={form.hasLibrary} onChange={v => set('hasLibrary', v)} />
                  <TriToggle label="Art & Craft Room" value={form.hasArtCraftRoom} onChange={v => set('hasArtCraftRoom', v)} />
                  <TriToggle label="Virtual Classroom" value={form.hasVirtualClassroom === true ? true : form.hasVirtualClassroom === false ? false : null} onChange={v => set('hasVirtualClassroom', v ?? false)} />
                  <TriToggle label="Laboratory" value={form.hasLaboratory} onChange={v => set('hasLaboratory', v)} />
                  <TriToggle label="Smart Classroom" value={form.hasSmartClassroom} onChange={v => set('hasSmartClassroom', v)} />
                  <TriToggle label="CCTV" value={form.hasCctv} onChange={v => set('hasCctv', v)} />
                </div>
              </div>
            )}

            {/* ── Furniture ── */}
            {tab === 'furniture' && (
              <div className="space-y-5">
                {([
                  { label: 'Head Master Room',   chairs: 'hmChairs',       tables: 'hmTables',       cups: 'hmCupboards' },
                  { label: 'Office Room',         chairs: 'officeChairs',   tables: 'officeTables',   cups: 'officeCupboards' },
                  { label: 'Common Room',         chairs: 'commonChairs',   tables: 'commonTables',   cups: 'commonCupboards' },
                  { label: 'All Classrooms',      chairs: 'classChairs',    tables: 'classTables',    cups: 'classCupboards' },
                  { label: 'Computer Room',       chairs: 'computerChairs', tables: 'computerTables', cups: 'computerCupboards' },
                  { label: 'Library',             chairs: 'libraryChairs',  tables: 'libraryTables',  cups: 'libraryCupboards' },
                  { label: 'Art & Craft Room',    chairs: 'artChairs',      tables: 'artTables',      cups: 'artCupboards' },
                  { label: 'Virtual Classroom',   chairs: 'vcChairs',       tables: 'vcTables',       cups: 'vcCupboards' },
                ] as { label: string; chairs: string; tables: string; cups: string }[]).map(row => (
                  <div key={row.label}>
                    <SectionHead title={row.label} />
                    <div className="grid grid-cols-3 gap-4">
                      <div><label className="form-label">Chairs</label>{numInput(row.chairs)}</div>
                      <div><label className="form-label">Tables</label>{numInput(row.tables)}</div>
                      <div><label className="form-label">Cupboards</label>{numInput(row.cups)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Water & Sanitation ── */}
            {tab === 'wash' && (
              <div className="space-y-6">
                <SectionHead title="Drinking Water" />
                <div className="grid grid-cols-2 gap-x-12 gap-y-5">
                  <TriToggle label="Drinking Water Facility Available" value={form.hasDrinkingWater} onChange={v => set('hasDrinkingWater', v)} />
                  <div>
                    <label className="form-label">Source of Drinking Water</label>
                    <select value={form.drinkingWaterSource} onChange={e => set('drinkingWaterSource', e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      <option value="Tap">Tap Water</option>
                      <option value="Hand-pump">Hand-pump</option>
                      <option value="Well">Well</option>
                      <option value="Tank">Tank / Storage</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <TriToggle label="Overhead Tank Available" value={form.hasOverheadTank} onChange={v => set('hasOverheadTank', v)} />
                  <div>
                    <label className="form-label">Daily Quantity (litres)</label>
                    <input type="number" min={0} value={form.waterQuantity ?? ''} onChange={e => set('waterQuantity', e.target.value ? +e.target.value : null)} placeholder="e.g. 2000" className="form-input" />
                  </div>
                  <TriToggle label="Water Purifier Available" value={form.hasWaterPurifier} onChange={v => set('hasWaterPurifier', v)} />
                  <div>
                    <label className="form-label">Date of Installation</label>
                    <input type="date" value={form.purifierInstallDate} onChange={e => set('purifierInstallDate', e.target.value)} className="form-input" />
                  </div>
                  <TriToggle label="Handwashing Facility Available" value={form.hasHandwashing} onChange={v => set('hasHandwashing', v)} />
                </div>

                <SectionHead title="Toilets" />
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div><label className="form-label">Usable Toilets</label>{numInput('numUsableToilets')}</div>
                  <div><label className="form-label">Unusable Toilets</label>{numInput('numUnusableToilets')}</div>
                  <div><label className="form-label">Girls Toilets</label>{numInput('numGirlsToilets')}</div>
                  <div><label className="form-label">Boys Toilets</label>{numInput('numBoysToilets')}</div>
                  <div><label className="form-label">Staff Toilets</label>{numInput('numStaffToilets')}</div>
                  <div><label className="form-label">CWSN Toilets</label>{numInput('numCwsnToilets')}</div>
                  <div><label className="form-label">Other Toilets</label>{numInput('numOtherToilets')}</div>
                </div>
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  <TriToggle label="CWSN / Divyang Friendly Toilet" value={form.hasCwsnToilet} onChange={v => set('hasCwsnToilet', v)} />
                </div>
              </div>
            )}

            {/* ── Electricity & Computer Lab ── */}
            {tab === 'electric' && (
              <div className="space-y-6">
                <SectionHead title="Electricity" />
                <div className="grid grid-cols-2 gap-x-12 gap-y-5">
                  <TriToggle label="Electricity Available" value={form.hasElectricity} onChange={v => set('hasElectricity', v)} />
                  <div>
                    <label className="form-label">Availability</label>
                    <select value={form.electricityAvailability} onChange={e => set('electricityAvailability', e.target.value)} className="form-input">
                      <option value="">— Select —</option>
                      <option value="24hrs">24 Hours</option>
                      <option value="Partial">Partial / Scheduled</option>
                      <option value="Solar">Solar Only</option>
                      <option value="None">None</option>
                    </select>
                  </div>
                </div>

                <SectionHead title="Computer Lab" />
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="form-label">Number of Desktop PCs</label>{numInput('numDesktopPCs')}</div>
                  <div className="flex flex-col justify-end gap-4">
                    <TriToggle label="UPS Available" value={form.hasUPS} onChange={v => set('hasUPS', v)} />
                  </div>
                  <div className="flex flex-col justify-end gap-4">
                    <TriToggle label="Internet Connectivity" value={form.hasInternetConnectivity ?? form.hasInternet} onChange={v => { set('hasInternetConnectivity', v); set('hasInternet', v); }} />
                  </div>
                  <TriToggle label="Computer Lab Available" value={form.hasComputerLab} onChange={v => set('hasComputerLab', v)} />
                </div>
              </div>
            )}

            {/* ── Hostel ── */}
            {tab === 'hostel' && (
              <div className="space-y-6">
                <SectionHead title="Student Hostel" />
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="form-label">Number of Rooms</label>{numInput('numHostelStudentRooms')}</div>
                  <div><label className="form-label">Accommodation Capacity</label>{numInput('hostelStudentCapacity')}</div>
                  <div><label className="form-label">Students Currently Residing</label>{numInput('numHostelStudents')}</div>
                </div>
                <SectionHead title="Staff Hostel" />
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="form-label">Number of Rooms</label>{numInput('numHostelStaffRooms')}</div>
                  <div><label className="form-label">Accommodation Capacity</label>{numInput('hostelStaffCapacity')}</div>
                </div>
              </div>
            )}

            {/* ── Academic & Safety ── */}
            {tab === 'academic' && (
              <div className="space-y-6">
                <SectionHead title="Safety & Security" />
                <div className="grid grid-cols-2 gap-x-12 gap-y-4">
                  <TriToggle label="Fire Safety Equipment" value={form.hasFireSafety} onChange={v => set('hasFireSafety', v)} />
                  <TriToggle label="Disaster Management Plan" value={form.hasDisasterPlan} onChange={v => set('hasDisasterPlan', v)} />
                  <TriToggle label="First Aid Facility" value={form.hasFirstAid} onChange={v => set('hasFirstAid', v)} />
                  <TriToggle label="Security Guard" value={form.hasSecurityGuard} onChange={v => set('hasSecurityGuard', v)} />
                </div>
                <div>
                  <label className="form-label">Emergency Contact Number</label>
                  <input value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} placeholder="e.g. 9876543210" className="form-input max-w-xs" />
                </div>
              </div>
            )}

            {/* ── Completion Status ── */}
            {tab === 'status' && (
              <div className="space-y-5">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total Fields', val: COMPLETION_FIELDS.length, color: 'text-slate-700 bg-slate-50 border-slate-200' },
                    { label: 'Filled',       val: filledFields.length,      color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'Pending',      val: pendingFields.length,     color: 'text-amber-700 bg-amber-50 border-amber-200' },
                    { label: 'Completion',   val: `${pct}%`,                color: pct >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : pct >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-xl border p-4 text-center ${c.color}`}>
                      <div className="text-2xl font-bold">{c.val}</div>
                      <div className="text-xs font-medium mt-0.5">{c.label}</div>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-600">Profile Completion</span>
                    <span className={`font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {pct >= 80 ? 'Complete' : pct >= 50 ? 'Partially Complete' : 'Incomplete'}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                {pendingFields.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pending ({pendingFields.length})</h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {pendingFields.map(f => (
                        <div key={f.key} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                          <i className="fas fa-exclamation-circle text-amber-400 shrink-0" />{f.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {filledFields.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filled ({filledFields.length})</h3>
                    <div className="grid grid-cols-3 gap-1.5">
                      {filledFields.map(f => (
                        <div key={f.key} className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5">
                          <i className="fas fa-check-circle text-emerald-500 shrink-0" />{f.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isEdit && (school?.profileUpdatedBy || school?.profileUpdatedAt) && (
                  <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 flex items-center gap-4">
                    {school.profileUpdatedBy && <span><i className="fas fa-user mr-1" />Updated by: <span className="text-slate-600">{school.profileUpdatedBy}</span></span>}
                    {school.profileUpdatedAt && <span><i className="fas fa-clock mr-1" />{new Date(school.profileUpdatedAt).toLocaleString()}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-between items-center px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50 rounded-b-2xl">
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`w-2 h-2 rounded-full transition-colors ${tab === t.id ? 'bg-sky-500' : 'bg-slate-200 hover:bg-slate-300'}`}
                  title={t.label} />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-outline px-5 py-2.5 text-sm">Cancel</button>
              {tab !== 'status' && (
                <button type="submit" disabled={saving} className="btn-navy px-6 py-2.5 text-sm">
                  {saving ? <><i className="fas fa-circle-notch fa-spin mr-2" />Saving…</> : <><i className={`fas fa-${isEdit ? 'save' : 'plus'} mr-2`} />{isEdit ? 'Save Changes' : 'Add School'}</>}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Schools page ─────────────────────────────────────────────────────────

export function Schools() {
  const { user } = useAuth();
  const { academicYear } = useAcademicYear();
  const isAdmin = user?.role === 'ADMIN';
  const isPrincipal = user?.role === 'PRINCIPAL';
  const isScopedOfficial = ['STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL'].includes(user?.role ?? '');
  const canEditSchools = isAdmin || isPrincipal || isScopedOfficial;
  const isSchoolScoped = ['PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'].includes(user?.role ?? '');
  const state = user ? stateFor(user) : null;

  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [mySchool, setMySchool] = useState<SchoolRow | null>(null);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | SchoolRow | null>(null);
  const [page, setPage] = useState(1);

  const [districts, setDistricts] = useState<DistrictMeta[]>([]);
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [districtSummaries, setDistrictSummaries] = useState<DistrictSummary[]>([]);

  const PAGE_SIZE = 50;
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const blocks = districts.find(d => d.id === districtId)?.blocks ?? [];

  const load = () => {
    if (isPrincipal && user?.schoolId) {
      setLoading(true);
      api.school(user.schoolId)
        .then(s => { setMySchool(s); setRows([s]); })
        .catch(() => api.schools({}).then(setRows).catch(() => null))
        .finally(() => setLoading(false));
      return;
    }
    setLoading(true);
    setPage(1);
    api.schools({ q: q || undefined, districtId: districtId || undefined, blockId: blockId || undefined })
      .then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.schoolDistricts().then(setDistricts);
    if (!isPrincipal) api.districts().then(setDistrictSummaries).catch(() => null);
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [districtId, blockId]);

  function onSaved(saved: SchoolRow) {
    setModal(null);
    // Optimistic update or reload
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...prev[idx], ...saved };
        return next;
      }
      return [saved, ...prev];
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Page header ───────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2">
            <i className="fas fa-school" />
            School Directory
          </div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Schools</h1>
          <p className="text-sm text-slate-500 mt-1">
            Virtual Classroom &amp; ICT Lab schools · {state ? `${state.name} ${academicYear}` : `All States ${academicYear}`}
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setModal('add')} className="btn-navy px-4 py-2.5">
              <i className="fas fa-plus" />
              Add School
            </button>
          )}
          <button
            onClick={() =>
              exportCsv(
                'schools',
                rows.map((s) => ({
                  // Identity
                  Name: s.name,
                  UDISE: s.udiseCode,
                  'Site Code': s.siteCode ?? '',
                  Type: s.type ?? '',
                  District: s.district,
                  Block: s.block,
                  // Contact
                  Principal: s.principalName ?? '',
                  Phone: s.phone ?? '',
                  'Phone 2': s.phone2 ?? '',
                  Email: s.email ?? '',
                  Address: s.address ?? '',
                  // General
                  'Registration No.': s.registrationNumber ?? '',
                  'Year Established': s.yearEstablished ?? '',
                  'Assembly Constituency': s.assemblyConstituency ?? '',
                  'Gram Panchayat': s.gramPanchayat ?? '',
                  'Managed By': s.managedBy ?? '',
                  'Medium of Instruction': s.mediumOfInstruction ?? '',
                  'Classes From': s.classesFrom ?? '',
                  'Classes To': s.classesTo ?? '',
                  Streams: s.streams ?? '',
                  // ICT / Facilities
                  'Virtual Classroom': s.hasVirtualClassroom ? 'Yes' : 'No',
                  'ICT Lab': s.hasIctLab ? 'Yes' : 'No',
                  'Smart Classroom': s.hasSmartClassroom ? 'Yes' : 'No',
                  Electricity: s.hasElectricity ? 'Yes' : 'No',
                  Internet: s.hasInternet ? 'Yes' : 'No',
                  CCTV: s.hasCctv ? 'Yes' : 'No',
                  // Infrastructure
                  'Campus Area': s.campusArea ?? '',
                  'Campus Area Unit': s.campusAreaUnit ?? '',
                  'Built-Up Area': s.builtUpArea ?? '',
                  Buildings: s.numBuildings ?? '',
                  Classrooms: s.numClassrooms ?? '',
                  Playground: s.hasPlayground ? 'Yes' : 'No',
                  'Boundary Wall': s.hasBoundaryWall ? 'Yes' : 'No',
                  Library: s.hasLibrary ? 'Yes' : 'No',
                  Laboratory: s.hasLaboratory ? 'Yes' : 'No',
                  'Computer Lab': s.hasComputerLab ? 'Yes' : 'No',
                  // Water & Sanitation
                  'Drinking Water': s.hasDrinkingWater ? 'Yes' : 'No',
                  'Water Source': s.drinkingWaterSource ?? '',
                  Toilets: s.numToilets ?? '',
                  'Boys Toilets': s.numBoysToilets ?? '',
                  'Girls Toilets': s.numGirlsToilets ?? '',
                  'CWSN Toilet': s.hasCwsnToilet ? 'Yes' : 'No',
                  Handwashing: s.hasHandwashing ? 'Yes' : 'No',
                  // Safety
                  'Fire Safety': s.hasFireSafety ? 'Yes' : 'No',
                  'Disaster Plan': s.hasDisasterPlan ? 'Yes' : 'No',
                  'First Aid': s.hasFirstAid ? 'Yes' : 'No',
                  'Security Guard': s.hasSecurityGuard ? 'Yes' : 'No',
                  'Emergency Contact': s.emergencyContact ?? '',
                  // Computer Lab
                  'Desktop PCs': s.numDesktopPCs ?? '',
                  UPS: s.hasUPS ? 'Yes' : 'No',
                  'Internet Connectivity': s.hasInternetConnectivity ? 'Yes' : 'No',
                  // Hostel
                  'Hostel Student Rooms': s.numHostelStudentRooms ?? '',
                  'Hostel Capacity': s.hostelStudentCapacity ?? '',
                  'Hostel Students': s.numHostelStudents ?? '',
                  // Stats
                  Teachers: s.teachers ?? '',
                  Students: s.students ?? '',
                  'Avg Pass 10th': s.avgPass10th ?? '',
                  'Avg Pass 12th': s.avgPass12th ?? '',
                })),
              )
            }
            className="btn-outline"
          >
            <i className="fas fa-download" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Principal: School analytics charts ──────────── */}
      {isPrincipal && mySchool && (() => {
        const BOYS_C = '#0076BC';
        const GIRLS_C = '#EC4899';
        const tip = { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.08)' };

        // Enrollment chart data
        const enrollData = (mySchool.enrollments ?? []).map(e => ({
          grade: `Cls ${e.grade}`,
          Boys: e.boys,
          Girls: e.girls,
          Total: e.total,
        }));
        const totalEnrolled = (mySchool.enrollments ?? []).reduce((s, e) => s + e.total, 0);

        // Board results — group by subject, separate 10th and 12th
        const results10 = (mySchool.boardResults ?? []).filter(r => r.examType === '10TH')
          .map(r => ({ subject: r.subject.replace('Social Science', 'Soc. Sci').replace('Science', 'Sci'), pct: Math.round(r.passPct * 100) }))
          .sort((a, b) => b.pct - a.pct);
        const results12 = (mySchool.boardResults ?? []).filter(r => r.examType === '12TH')
          .map(r => ({ subject: r.subject.replace('Social Science', 'Soc. Sci').replace('Science', 'Sci'), pct: Math.round(r.passPct * 100) }))
          .sort((a, b) => b.pct - a.pct);
        const showResults = results10.length > 0 || results12.length > 0;

        // Facilities checklist
        const facilities = [
          { label: 'Virtual Classroom', ok: mySchool.hasVirtualClassroom, icon: 'fa-desktop' },
          { label: 'ICT Lab',           ok: mySchool.hasIctLab,           icon: 'fa-laptop' },
          { label: 'Smart Classroom',   ok: mySchool.hasSmartClassroom,   icon: 'fa-chalkboard' },
          { label: 'Library',           ok: mySchool.hasLibrary,          icon: 'fa-book' },
          { label: 'Laboratory',        ok: mySchool.hasLaboratory,       icon: 'fa-flask' },
          { label: 'Internet',          ok: mySchool.hasInternet,         icon: 'fa-wifi' },
          { label: 'Electricity',       ok: mySchool.hasElectricity,      icon: 'fa-bolt' },
          { label: 'CCTV',              ok: mySchool.hasCctv,             icon: 'fa-video' },
          { label: 'Playground',        ok: mySchool.hasPlayground,       icon: 'fa-running' },
          { label: 'Drinking Water',    ok: mySchool.hasDrinkingWater,    icon: 'fa-tint' },
          { label: 'Boundary Wall',     ok: mySchool.hasBoundaryWall,     icon: 'fa-border-all' },
          { label: 'Fire Safety',       ok: mySchool.hasFireSafety,       icon: 'fa-fire-extinguisher' },
        ];
        const facOk = facilities.filter(f => f.ok).length;

        return (
          <>
            {/* KPI stat row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total Enrolled',  val: totalEnrolled > 0 ? totalEnrolled.toLocaleString() : (mySchool.students ?? 0).toLocaleString(), icon: 'fa-user-graduate', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Teaching Staff',  val: (mySchool.teachers ?? 0).toLocaleString(),   icon: 'fa-chalkboard-teacher', color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Pass Rate (10th)', val: mySchool.avgPass10th != null ? `${(mySchool.avgPass10th * 100).toFixed(1)}%` : '—', icon: 'fa-award', color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Pass Rate (12th)', val: mySchool.avgPass12th != null ? `${(mySchool.avgPass12th * 100).toFixed(1)}%` : '—', icon: 'fa-graduation-cap', color: 'text-sky-600', bg: 'bg-sky-50' },
              ].map(k => (
                <div key={k.label} className={`panel flex items-center gap-4 px-5 py-4 ${k.bg}`}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm shrink-0`}>
                    <i className={`fas ${k.icon} ${k.color} text-lg`} />
                  </div>
                  <div>
                    <div className="font-heading font-bold text-navy-700 text-xl leading-none">{k.val}</div>
                    <div className="text-xs text-slate-500 mt-1">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className={`grid gap-4 ${showResults ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>

              {/* Enrollment by Grade */}
              <div className="panel overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-heading font-semibold text-navy-700 text-sm">Enrollment by Grade</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Boys · Girls · Current year</p>
                </div>
                <div className="p-4">
                  {enrollData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                      <i className="fas fa-database mr-2" />No enrollment data
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: BOYS_C }} />Boys</span>
                        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GIRLS_C }} />Girls</span>
                      </div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={enrollData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="grade" fontSize={11} tick={{ fill: '#64748b' }} />
                          <YAxis fontSize={11} allowDecimals={false} />
                          <Tooltip contentStyle={tip} />
                          <Bar dataKey="Boys"  fill={BOYS_C}  radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                          <Bar dataKey="Girls" fill={GIRLS_C} radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </div>
              </div>

              {/* Board Results — 10th */}
              {showResults && (
                <div className="panel overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-semibold text-navy-700 text-sm">Board Pass Rates</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Subject-wise · 10th class</p>
                    </div>
                    {results12.length > 0 && (
                      <span className="text-xs text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">+12th available</span>
                    )}
                  </div>
                  <div className="p-4">
                    {results10.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                        <i className="fas fa-database mr-2" />No 10th result data
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={results10} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} tick={{ fill: '#64748b' }} />
                          <YAxis type="category" dataKey="subject" fontSize={11} tick={{ fill: '#64748b' }} width={60} />
                          <Tooltip contentStyle={tip} formatter={(v: number) => [`${v}%`, 'Pass Rate']} />
                          <Bar dataKey="pct" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={18}>
                            {results10.map((r, i) => (
                              <Cell key={i} fill={r.pct >= 75 ? '#10b981' : r.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                            ))}
                            <LabelList dataKey="pct" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 11, fill: '#475569' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}

              {/* Facilities */}
              <div className="panel overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-heading font-semibold text-navy-700 text-sm">Facilities Status</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{facOk} of {facilities.length} available</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 rounded-full bg-slate-100 w-24 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(facOk / facilities.length) * 100}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-emerald-600">{Math.round((facOk / facilities.length) * 100)}%</span>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-2 gap-2">
                  {facilities.map(f => (
                    <div key={f.label} className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium ${f.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-400'}`}>
                      <i className={`fas ${f.icon} w-4 text-center ${f.ok ? 'text-emerald-500' : 'text-slate-300'}`} />
                      <span className="truncate">{f.label}</span>
                      <i className={`fas ${f.ok ? 'fa-check-circle text-emerald-500' : 'fa-times-circle text-slate-300'} ml-auto`} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── Principal: My School profile card ─────────── */}
      {isPrincipal && (
        <div className="panel overflow-hidden">
          <div className="px-6 py-5 bg-gradient-to-r from-navy-700 to-sky-700 flex items-center justify-between">
            <div>
              <p className="text-sky-200 text-xs font-semibold uppercase tracking-wider mb-1">My School Profile</p>
              <h2 className="text-white font-heading font-bold text-xl">
                {loading ? 'Loading…' : (mySchool?.name ?? 'School not found')}
              </h2>
              {mySchool && (
                <p className="text-sky-200 text-sm mt-1">
                  <span className="font-mono">{mySchool.udiseCode}</span>
                  {mySchool.district && <> · {mySchool.district}{mySchool.block ? `, ${mySchool.block}` : ''}</>}
                </p>
              )}
            </div>
            {mySchool && (
              <button
                onClick={() => setModal(mySchool)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors border border-white/20"
              >
                <i className="fas fa-edit" /> Edit Profile
              </button>
            )}
          </div>
          {mySchool && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
              {[
                { label: 'Principal / HM',    val: mySchool.principalName ?? '—',              icon: 'fa-user-tie',      color: 'text-navy-600' },
                { label: 'Total Students',    val: (mySchool.students ?? 0).toLocaleString(),   icon: 'fa-user-graduate', color: 'text-emerald-600' },
                { label: 'Teachers',          val: (mySchool.teachers ?? 0).toLocaleString(),   icon: 'fa-chalkboard-teacher', color: 'text-violet-600' },
                { label: 'Contact',           val: mySchool.phone ?? '—',                      icon: 'fa-phone',         color: 'text-sky-600' },
              ].map(k => (
                <div key={k.label} className="bg-white px-5 py-4 flex items-center gap-3">
                  <i className={`fas ${k.icon} ${k.color} text-lg w-5 text-center shrink-0`} />
                  <div>
                    <div className="font-heading font-bold text-navy-700 text-base leading-none">{k.val}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {mySchool && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
              {[
                { label: 'Type',                 val: mySchool.type ?? '—',                           icon: 'fa-tag' },
                { label: 'Virtual Classroom',    val: mySchool.hasVirtualClassroom ? 'Yes' : 'No',    icon: 'fa-desktop' },
                { label: 'ICT Lab',              val: mySchool.hasIctLab ? 'Yes' : 'No',              icon: 'fa-laptop' },
                { label: 'Address',              val: mySchool.address ?? '—',                        icon: 'fa-map-marker-alt' },
              ].map(k => (
                <div key={k.label} className="bg-white px-5 py-4 flex items-start gap-3">
                  <i className={`fas ${k.icon} text-slate-400 text-sm w-5 text-center shrink-0 mt-0.5`} />
                  <div>
                    <div className="text-slate-700 text-sm font-medium leading-snug">{k.val}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              <i className="fas fa-circle-notch fa-spin mr-2" />Loading school profile…
            </div>
          )}
          {!loading && !mySchool && (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">
              <i className="fas fa-exclamation-circle mr-2 text-amber-400" />
              School profile not linked to your account. Please contact the administrator.
            </div>
          )}
        </div>
      )}

      {/* ── District analytics charts ────────────────── */}
      {!isPrincipal && districtSummaries.length > 0 && (() => {
        const sorted = [...districtSummaries].sort((a, b) => b.schools - a.schools);
        const chartData = sorted.map(d => ({
          name: d.district.replace(' Garhwal', ' G.').replace('Udham Singh Nagar', 'USN'),
          Schools: d.schools,
          Teachers: d.teachers,
          Boys: d.boys,
          Girls: d.girls,
          Students: d.totalStudents,
        }));
        const BOYS_C = '#0076BC';
        const GIRLS_C = '#EC4899';
        const tip = { borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.08)' };
        return (
          <div className="panel overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-navy-700">District Overview</h2>
                <p className="text-xs text-slate-400 mt-0.5">Schools · Teachers · Students by district</p>
              </div>
              <span className="text-xs text-slate-400">{districtSummaries.length} districts</span>
            </div>

            {/* Summary KPI chips */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100">
              {[
                { label: 'Total Schools',   val: districtSummaries.reduce((s, d) => s + d.schools, 0).toLocaleString(),       icon: 'fa-school',               color: 'text-sky-600' },
                { label: 'Total Teachers',  val: districtSummaries.reduce((s, d) => s + d.teachers, 0).toLocaleString(),      icon: 'fa-chalkboard-teacher',   color: 'text-violet-600' },
                { label: 'Total Students',  val: districtSummaries.reduce((s, d) => s + d.totalStudents, 0).toLocaleString(), icon: 'fa-user-graduate',        color: 'text-emerald-600' },
                { label: 'Avg Pass (10th)', val: (() => { const v = districtSummaries.reduce((s, d) => s + (d.avgPass10th ?? 0), 0) / districtSummaries.length; return `${(v * 100).toFixed(1)}%`; })(), icon: 'fa-award', color: 'text-amber-600' },
              ].map(k => (
                <div key={k.label} className="bg-white px-5 py-3 flex items-center gap-3">
                  <i className={`fas ${k.icon} ${k.color} text-lg w-5 text-center`} />
                  <div>
                    <div className="font-heading font-bold text-navy-700 text-lg leading-none">{k.val}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">{k.label}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
              {/* Schools per district */}
              <div className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <i className="fas fa-school text-sky-400" />Schools per District
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 40, left: -20 }} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={10} angle={-40} textAnchor="end" interval={0} tick={{ fill: '#64748b' }} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tip} formatter={(v: number) => [v.toLocaleString(), 'Schools']} />
                    <Bar dataKey="Schools" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {chartData.map((_, i) => <Cell key={i} fill={`hsl(${210 + i * 12},70%,${52 - i * 1}%)`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Teachers per district */}
              <div className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <i className="fas fa-chalkboard-teacher text-violet-400" />Teachers per District
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 40, left: -16 }} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={10} angle={-40} textAnchor="end" interval={0} tick={{ fill: '#64748b' }} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip contentStyle={tip} formatter={(v: number) => [v.toLocaleString(), 'Teachers']} />
                    <Bar dataKey="Teachers" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {chartData.map((_, i) => <Cell key={i} fill={`hsl(${270 + i * 8},60%,${55 - i * 1}%)`} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Students per district — boys vs girls stacked */}
              <div className="p-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <i className="fas fa-user-graduate text-emerald-400" />Students per District
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-2">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: BOYS_C }} />Boys</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: GIRLS_C }} />Girls</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 40, left: -16 }} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" fontSize={10} angle={-40} textAnchor="end" interval={0} tick={{ fill: '#64748b' }} />
                    <YAxis fontSize={11} allowDecimals={false} />
                    <Tooltip
                      contentStyle={tip}
                      formatter={(v: number, n: string) => [v.toLocaleString(), n]}
                    />
                    <Bar dataKey="Boys" stackId="s" fill={BOYS_C} isAnimationActive={false} />
                    <Bar dataKey="Girls" stackId="s" fill={GIRLS_C} radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Filters ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* District — hidden for school-scoped roles */}
        {!isSchoolScoped && <select
          value={districtId}
          onChange={e => { setDistrictId(e.target.value); setBlockId(''); }}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300
                     transition-colors text-slate-700 min-w-[160px]"
        >
          <option value="">All Districts</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>}

        {/* Block — only shown when a district is selected and not school-scoped */}
        {!isSchoolScoped && districtId && (
          <select
            value={blockId}
            onChange={e => setBlockId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300
                       transition-colors text-slate-700 min-w-[160px]"
          >
            <option value="">All Blocks</option>
            {blocks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}

        {/* Name search — hidden for school-scoped roles */}
        {!isSchoolScoped && (
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-2 items-center flex-1">
            <div className="relative flex-1 max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <i className="fas fa-search text-xs" />
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by school name…"
                className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm bg-white
                           focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors"
              />
            </div>
            <button type="submit" className="btn-navy px-5 py-2.5">
              <i className="fas fa-search" /> Search
            </button>
            {(q || districtId || blockId) && (
              <button
                type="button"
                onClick={() => { setQ(''); setDistrictId(''); setBlockId(''); }}
                className="btn-outline px-3 py-2.5 text-xs"
                title="Clear all filters"
              >
                <i className="fas fa-times mr-1" />Clear
              </button>
            )}
          </form>
        )}
      </div>

      {/* ── Table — hidden for PRINCIPAL (they see My School card above) ── */}
      {!isPrincipal && <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm data-table schools-table">
          <thead>
            <tr>
              <th>School</th>
              <th>UDISE</th>
              <th>District / Block</th>
              <th>Principal</th>
              <th className="whitespace-nowrap">Progress</th>
              <th className="text-right">Teachers</th>
              <th className="text-right">Students</th>
              {isAdmin && <th className="text-right">Login</th>}
              {canEditSchools && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s) => (
              <tr key={s.id}>
                <td className="max-w-[150px]">
                  <div className="font-semibold text-navy-700 truncate" title={s.name}>{s.name}</div>
                  {s.siteCode && (
                    <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">{s.siteCode}</div>
                  )}
                  {s.address && (
                    <div className="text-xs text-slate-400 mt-0.5 truncate" title={s.address}>
                      {s.address}
                    </div>
                  )}
                </td>
                <td className="text-slate-500 font-mono text-xs whitespace-nowrap">{s.udiseCode}</td>
                <td className="max-w-[120px]">
                  <div className="font-medium text-slate-700 truncate">{s.district}</div>
                  <div className="text-xs text-slate-400 truncate">{s.block}</div>
                </td>
                <td className="max-w-[150px]">
                  {s.principalName ? (
                    <>
                      <div className="text-slate-700 text-xs font-medium truncate" title={s.principalName}>{s.principalName}</div>
                      {s.phone && <div className="text-xs text-slate-400 truncate">{s.phone}</div>}
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td>
                  {(() => {
                    const pct = schoolCompletionPct(s);
                    const color = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';
                    const textColor = pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-600';
                    return (
                      <div className="flex items-center gap-1.5 whitespace-nowrap">
                        <div className="h-1.5 w-10 rounded-full bg-slate-100 overflow-hidden shrink-0">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className={`text-xs font-semibold ${textColor}`}>{pct}%</span>
                      </div>
                    );
                  })()}
                </td>
                <td className="text-right font-medium">{s.teachers ?? '—'}</td>
                <td className="text-right font-medium">{s.students ?? '—'}</td>
                {isAdmin && (
                  <td className="text-right">
                    <SchoolLoginBtn schoolId={s.id} />
                  </td>
                )}
                {canEditSchools && (
                  <td className="text-right">
                    {(isAdmin || isScopedOfficial || (isPrincipal && s.id === user?.schoolId)) && (
                      <button
                        onClick={() => setModal(s)}
                        className="text-xs text-sky-600 hover:text-sky-800 font-medium transition-colors px-2 py-1 rounded hover:bg-sky-50"
                      >
                        <i className="fas fa-edit mr-1" />Edit
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {loading && (
          <div className="flex items-center gap-2 p-5 text-slate-400 text-sm">
            <i className="fas fa-circle-notch fa-spin" /> Loading schools…
          </div>
        )}
        {!loading && (
          <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between flex-wrap gap-2">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} schools</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-chevron-left" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-sky-500 border-sky-500 text-white'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <i className="fas fa-chevron-right" />
                </button>
              </div>
            )}
            <span />
          </div>
        )}
      </div>}

      {/* ── Modal ─────────────────────────────────────── */}
      {modal && (
        <SchoolModal
          school={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
          readonlyIdentity={isPrincipal || isScopedOfficial}
        />
      )}
    </div>
  );
}
