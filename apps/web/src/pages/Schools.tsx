import { useEffect, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
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

type TabId = 'profile' | 'infra' | 'wash' | 'academic' | 'status';

interface Tab { id: TabId; label: string; icon: string }
const TABS: Tab[] = [
  { id: 'profile',  label: 'School Profile',     icon: 'fa-school' },
  { id: 'infra',    label: 'Infrastructure',      icon: 'fa-building' },
  { id: 'wash',     label: 'Water & Sanitation',  icon: 'fa-tint' },
  { id: 'academic', label: 'Academic & Safety',   icon: 'fa-graduation-cap' },
  { id: 'status',   label: 'Completion Status',   icon: 'fa-chart-pie' },
];

// Fields counted for profile completion
const COMPLETION_FIELDS: { key: keyof SchoolFormData | 'principalName' | 'phone' | 'address'; label: string }[] = [
  { key: 'principalName',      label: 'Principal Name' },
  { key: 'phone',              label: 'Contact Number' },
  { key: 'address',            label: 'Address' },
  { key: 'campusArea',         label: 'Campus Area' },
  { key: 'numBuildings',       label: 'Number of Buildings' },
  { key: 'numClassrooms',      label: 'Number of Classrooms' },
  { key: 'hasPlayground',      label: 'Playground' },
  { key: 'hasBoundaryWall',    label: 'Boundary Wall' },
  { key: 'hasLibrary',         label: 'Library' },
  { key: 'hasLaboratory',      label: 'Laboratory' },
  { key: 'hasComputerLab',     label: 'Computer Lab' },
  { key: 'hasSmartClassroom',  label: 'Smart Classroom' },
  { key: 'hasElectricity',     label: 'Electricity' },
  { key: 'hasInternet',        label: 'Internet Connectivity' },
  { key: 'hasCctv',            label: 'CCTV' },
  { key: 'hasDrinkingWater',   label: 'Drinking Water' },
  { key: 'drinkingWaterSource',label: 'Water Source' },
  { key: 'numToilets',         label: 'Total Toilets' },
  { key: 'numBoysToilets',     label: 'Boys Toilets' },
  { key: 'numGirlsToilets',    label: 'Girls Toilets' },
  { key: 'hasCwsnToilet',      label: 'CWSN Toilet' },
  { key: 'hasHandwashing',     label: 'Handwashing Facility' },
  { key: 'classesFrom',        label: 'Classes (From)' },
  { key: 'classesTo',          label: 'Classes (To)' },
  { key: 'streams',            label: 'Streams' },
  { key: 'hasFireSafety',      label: 'Fire Safety Equipment' },
  { key: 'hasDisasterPlan',    label: 'Disaster Management Plan' },
  { key: 'hasFirstAid',        label: 'First Aid Facility' },
  { key: 'hasSecurityGuard',   label: 'Security Guard' },
  { key: 'emergencyContact',   label: 'Emergency Contact' },
];

function isFilled(v: any): boolean {
  if (v === null || v === undefined || v === '') return false;
  return true;
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
}

function SchoolModal({ school, onClose, onSaved }: SchoolModalProps) {
  const isEdit = !!school;
  const [tab, setTab] = useState<TabId>('profile');
  const [districts, setDistricts] = useState<DistrictMeta[]>([]);
  const [districtId, setDistrictId] = useState(school?.districtId ?? '');
  const [form, setForm] = useState<SchoolFormData & { principalName?: string; phone?: string; address?: string }>({
    name: school?.name ?? '',
    udiseCode: school?.udiseCode ?? '',
    siteCode: school?.siteCode ?? '',
    blockId: school?.blockId ?? '',
    type: school?.type ?? '',
    hasVirtualClassroom: school?.hasVirtualClassroom ?? false,
    hasIctLab: school?.hasIctLab ?? false,
    address: school?.address ?? '',
    principalName: school?.principalName ?? '',
    phone: school?.phone ?? '',
    // Infrastructure
    campusArea: school?.campusArea ?? null,
    campusAreaUnit: school?.campusAreaUnit ?? 'acres',
    builtUpArea: school?.builtUpArea ?? null,
    numBuildings: school?.numBuildings ?? null,
    numClassrooms: school?.numClassrooms ?? null,
    hasPlayground: school?.hasPlayground ?? null,
    hasBoundaryWall: school?.hasBoundaryWall ?? null,
    hasLibrary: school?.hasLibrary ?? null,
    hasLaboratory: school?.hasLaboratory ?? null,
    hasComputerLab: school?.hasComputerLab ?? null,
    hasSmartClassroom: school?.hasSmartClassroom ?? null,
    hasElectricity: school?.hasElectricity ?? null,
    hasInternet: school?.hasInternet ?? null,
    hasCctv: school?.hasCctv ?? null,
    // Water & Sanitation
    hasDrinkingWater: school?.hasDrinkingWater ?? null,
    drinkingWaterSource: school?.drinkingWaterSource ?? '',
    numToilets: school?.numToilets ?? null,
    numBoysToilets: school?.numBoysToilets ?? null,
    numGirlsToilets: school?.numGirlsToilets ?? null,
    hasCwsnToilet: school?.hasCwsnToilet ?? null,
    hasHandwashing: school?.hasHandwashing ?? null,
    // Academic
    classesFrom: school?.classesFrom ?? null,
    classesTo: school?.classesTo ?? null,
    streams: school?.streams ?? '',
    // Safety
    hasFireSafety: school?.hasFireSafety ?? null,
    hasDisasterPlan: school?.hasDisasterPlan ?? null,
    hasFirstAid: school?.hasFirstAid ?? null,
    hasSecurityGuard: school?.hasSecurityGuard ?? null,
    emergencyContact: school?.emergencyContact ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.schoolDistricts().then(setDistricts);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, []);

  const blocks = districts.find(d => d.id === districtId)?.blocks ?? [];
  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Compute completion
  const filledFields = COMPLETION_FIELDS.filter(f => isFilled((form as any)[f.key]));
  const pendingFields = COMPLETION_FIELDS.filter(f => !isFilled((form as any)[f.key]));
  const pct = Math.round((filledFields.length / COMPLETION_FIELDS.length) * 100);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.udiseCode.trim() || !form.blockId) {
      setError('Name, UDISE code and Block are required.');
      setTab('profile');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="font-heading font-bold text-navy-700 text-lg">
              {isEdit ? school!.name : 'Add School'}
            </h2>
            {isEdit && <p className="text-xs text-slate-400 mt-0.5 font-mono">{school!.udiseCode}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        {/* Completion bar */}
        {isEdit && (
          <div className="px-6 pt-3 pb-0 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-semibold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                {pct}% complete
              </span>
            </div>
          </div>
        )}

        {/* Tab strip */}
        <div className="flex border-b border-slate-100 px-4 mt-3 shrink-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-sky-500 text-sky-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <i className={`fas ${t.icon} text-[10px]`} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
                <i className="fas fa-exclamation-circle" />{error}
              </div>
            )}

            {/* ── Tab: School Profile ──────────────────────────────── */}
            {tab === 'profile' && (
              <div className="space-y-5">
                <div>
                  <label className="form-label">School Name *</label>
                  <input ref={firstRef} value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="e.g. GGIC ALMORA" className="form-input" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">UDISE Code *</label>
                    <input value={form.udiseCode} onChange={e => set('udiseCode', e.target.value)}
                      placeholder="e.g. 5090615301" className="form-input font-mono" required />
                  </div>
                  <div>
                    <label className="form-label">Site Code</label>
                    <input value={form.siteCode ?? ''} onChange={e => set('siteCode', e.target.value)}
                      placeholder="e.g. VVEAMO376" className="form-input font-mono" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                </div>
                <div className="grid grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="form-label">Type</label>
                    <select value={form.type ?? ''} onChange={e => set('type', e.target.value)} className="form-input">
                      <option value="">— Other —</option>
                      <option value="GIC">GIC</option>
                      <option value="GGIC">GGIC</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input type="checkbox" checked={form.hasVirtualClassroom} onChange={e => set('hasVirtualClassroom', e.target.checked)} className="w-4 h-4 rounded accent-sky-600" />
                    <span className="text-sm font-medium text-slate-700">Virtual Classroom</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer py-2">
                    <input type="checkbox" checked={form.hasIctLab} onChange={e => set('hasIctLab', e.target.checked)} className="w-4 h-4 rounded accent-sky-600" />
                    <span className="text-sm font-medium text-slate-700">ICT Lab</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">Principal / Head Master</label>
                    <input value={form.principalName ?? ''} onChange={e => set('principalName', e.target.value)} placeholder="Name" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Contact Number</label>
                    <input value={form.phone ?? ''} onChange={e => set('phone', e.target.value)} placeholder="Mobile" className="form-input" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Address</label>
                  <textarea value={form.address ?? ''} onChange={e => set('address', e.target.value)} placeholder="Full address" rows={2} className="form-input resize-none" />
                </div>
              </div>
            )}

            {/* ── Tab: Infrastructure ──────────────────────────────── */}
            {tab === 'infra' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Area & Buildings</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <label className="form-label">Total Campus Area</label>
                      <input type="number" min={0} step={0.01} value={form.campusArea ?? ''} onChange={e => set('campusArea', e.target.value ? +e.target.value : null)}
                        placeholder="e.g. 2.5" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Unit</label>
                      <select value={form.campusAreaUnit ?? 'acres'} onChange={e => set('campusAreaUnit', e.target.value)} className="form-input">
                        <option value="acres">Acres</option>
                        <option value="sqm">Sq. Metres</option>
                        <option value="sqft">Sq. Feet</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Built-up Area (sq.m)</label>
                      <input type="number" min={0} value={form.builtUpArea ?? ''} onChange={e => set('builtUpArea', e.target.value ? +e.target.value : null)}
                        placeholder="e.g. 1200" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">No. of Buildings</label>
                      <input type="number" min={0} value={form.numBuildings ?? ''} onChange={e => set('numBuildings', e.target.value ? +e.target.value : null)}
                        placeholder="e.g. 3" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">No. of Classrooms</label>
                      <input type="number" min={0} value={form.numClassrooms ?? ''} onChange={e => set('numClassrooms', e.target.value ? +e.target.value : null)}
                        placeholder="e.g. 12" className="form-input" />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Facilities Available</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TriToggle label="Playground" value={form.hasPlayground} onChange={v => set('hasPlayground', v)} />
                    <TriToggle label="Boundary Wall" value={form.hasBoundaryWall} onChange={v => set('hasBoundaryWall', v)} />
                    <TriToggle label="Library" value={form.hasLibrary} onChange={v => set('hasLibrary', v)} />
                    <TriToggle label="Laboratory" value={form.hasLaboratory} onChange={v => set('hasLaboratory', v)} />
                    <TriToggle label="Computer Lab" value={form.hasComputerLab} onChange={v => set('hasComputerLab', v)} />
                    <TriToggle label="Smart Classroom" value={form.hasSmartClassroom} onChange={v => set('hasSmartClassroom', v)} />
                    <TriToggle label="Electricity" value={form.hasElectricity} onChange={v => set('hasElectricity', v)} />
                    <TriToggle label="Internet Connectivity" value={form.hasInternet} onChange={v => set('hasInternet', v)} />
                    <TriToggle label="CCTV" value={form.hasCctv} onChange={v => set('hasCctv', v)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Water & Sanitation ──────────────────────────── */}
            {tab === 'wash' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Drinking Water</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TriToggle label="Drinking Water Facility Available" value={form.hasDrinkingWater} onChange={v => set('hasDrinkingWater', v)} />
                    <div>
                      <label className="form-label">Source of Drinking Water</label>
                      <select value={form.drinkingWaterSource ?? ''} onChange={e => set('drinkingWaterSource', e.target.value)} className="form-input">
                        <option value="">— Select —</option>
                        <option value="Tap">Tap Water</option>
                        <option value="Hand-pump">Hand-pump</option>
                        <option value="Well">Well</option>
                        <option value="Tank">Tank / Storage</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Toilets</h3>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="form-label">Total Toilets</label>
                      <input type="number" min={0} value={form.numToilets ?? ''} onChange={e => set('numToilets', e.target.value ? +e.target.value : null)} placeholder="0" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Boys Toilets</label>
                      <input type="number" min={0} value={form.numBoysToilets ?? ''} onChange={e => set('numBoysToilets', e.target.value ? +e.target.value : null)} placeholder="0" className="form-input" />
                    </div>
                    <div>
                      <label className="form-label">Girls Toilets</label>
                      <input type="number" min={0} value={form.numGirlsToilets ?? ''} onChange={e => set('numGirlsToilets', e.target.value ? +e.target.value : null)} placeholder="0" className="form-input" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TriToggle label="CWSN / Divyang Friendly Toilet" value={form.hasCwsnToilet} onChange={v => set('hasCwsnToilet', v)} />
                    <TriToggle label="Handwashing Facility Available" value={form.hasHandwashing} onChange={v => set('hasHandwashing', v)} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Academic & Safety ───────────────────────────── */}
            {tab === 'academic' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Academic Information</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="form-label">Classes From (Grade)</label>
                      <select value={form.classesFrom ?? ''} onChange={e => set('classesFrom', e.target.value ? +e.target.value : null)} className="form-input">
                        <option value="">— Select —</option>
                        <option value={0}>Pre-Primary</option>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Class {g}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Classes To (Grade)</label>
                      <select value={form.classesTo ?? ''} onChange={e => set('classesTo', e.target.value ? +e.target.value : null)} className="form-input">
                        <option value="">— Select —</option>
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(g => <option key={g} value={g}>Class {g}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="form-label">Streams Available</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {['Science', 'Arts', 'Commerce', 'Vocational'].map(s => {
                          const list = (form.streams ?? '').split(',').map(x => x.trim()).filter(Boolean);
                          const checked = list.includes(s);
                          return (
                            <label key={s} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer transition-colors ${
                              checked ? 'bg-sky-50 border-sky-300 text-sky-700' : 'border-slate-200 text-slate-600 hover:border-sky-200'
                            }`}>
                              <input type="checkbox" className="hidden" checked={checked} onChange={() => {
                                const next = checked ? list.filter(x => x !== s) : [...list, s];
                                set('streams', next.join(','));
                              }} />
                              <i className={`fas fa-${checked ? 'check-circle' : 'circle'} text-xs ${checked ? 'text-sky-500' : 'text-slate-300'}`} />
                              {s}
                            </label>
                          );
                        })}
                      </div>
                      <input value={form.streams ?? ''} onChange={e => set('streams', e.target.value)} placeholder="Or type custom streams, comma-separated" className="form-input mt-2 text-xs" />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Safety & Security</h3>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <TriToggle label="Fire Safety Equipment" value={form.hasFireSafety} onChange={v => set('hasFireSafety', v)} />
                    <TriToggle label="Disaster Management Plan" value={form.hasDisasterPlan} onChange={v => set('hasDisasterPlan', v)} />
                    <TriToggle label="First Aid Facility" value={form.hasFirstAid} onChange={v => set('hasFirstAid', v)} />
                    <TriToggle label="Security Guard" value={form.hasSecurityGuard} onChange={v => set('hasSecurityGuard', v)} />
                  </div>
                  <div className="mt-4">
                    <label className="form-label">Emergency Contact Number</label>
                    <input value={form.emergencyContact ?? ''} onChange={e => set('emergencyContact', e.target.value)} placeholder="e.g. 9876543210" className="form-input" />
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Completion Status ───────────────────────────── */}
            {tab === 'status' && (
              <div className="space-y-5">
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Total Fields', val: COMPLETION_FIELDS.length, color: 'text-slate-700 bg-slate-50 border-slate-200' },
                    { label: 'Filled',        val: filledFields.length,     color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                    { label: 'Pending',       val: pendingFields.length,    color: 'text-amber-700 bg-amber-50 border-amber-200' },
                    { label: 'Completion',    val: `${pct}%`,               color: pct >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : pct >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200' },
                  ].map(c => (
                    <div key={c.label} className={`rounded-xl border p-4 text-center ${c.color}`}>
                      <div className="text-2xl font-bold">{c.val}</div>
                      <div className="text-xs font-medium mt-0.5">{c.label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-slate-600">Profile Completion</span>
                    <span className={`font-bold ${pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                      {pct >= 80 ? 'Complete' : pct >= 50 ? 'Partially Complete' : 'Incomplete'}
                    </span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {/* Pending fields */}
                {pendingFields.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Pending Information ({pendingFields.length})</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {pendingFields.map(f => (
                        <div key={f.key} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                          <i className="fas fa-exclamation-circle text-amber-400 shrink-0" />
                          {f.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filled fields */}
                {filledFields.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Filled Fields ({filledFields.length})</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      {filledFields.map(f => (
                        <div key={f.key} className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5">
                          <i className="fas fa-check-circle text-emerald-500 shrink-0" />
                          {f.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audit */}
                {isEdit && (school?.profileUpdatedBy || school?.profileUpdatedAt) && (
                  <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 flex items-center gap-4">
                    {school.profileUpdatedBy && <span><i className="fas fa-user mr-1" />Last updated by: <span className="text-slate-600">{school.profileUpdatedBy}</span></span>}
                    {school.profileUpdatedAt && <span><i className="fas fa-clock mr-1" />{new Date(school.profileUpdatedAt).toLocaleString()}</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="flex gap-3 justify-between items-center px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex gap-1">
              {TABS.map((t, i) => (
                <button key={t.id} type="button" onClick={() => setTab(t.id)}
                  className={`w-2 h-2 rounded-full transition-colors ${tab === t.id ? 'bg-sky-500' : 'bg-slate-200 hover:bg-slate-300'}`}
                  title={t.label}
                />
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-outline px-5 py-2.5 text-sm">Cancel</button>
              {tab !== 'status' && (
                <button type="submit" disabled={saving} className="btn-navy px-6 py-2.5 text-sm">
                  {saving
                    ? <><i className="fas fa-circle-notch fa-spin mr-2" />Saving…</>
                    : <><i className={`fas fa-${isEdit ? 'save' : 'plus'} mr-2`} />{isEdit ? 'Save Changes' : 'Add School'}</>
                  }
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
  const isAdmin = user?.role === 'ADMIN';
  const state = user ? stateFor(user) : null;

  const [rows, setRows] = useState<SchoolRow[]>([]);
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
    setLoading(true);
    setPage(1);
    api.schools({ q: q || undefined, districtId: districtId || undefined, blockId: blockId || undefined })
      .then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.schoolDistricts().then(setDistricts);
    api.districts().then(setDistrictSummaries).catch(() => null);
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
            Virtual Classroom &amp; ICT Lab schools · {state ? `${state.name} 2025–26` : 'All States 2025–26'}
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
                  Name: s.name,
                  UDISE: s.udiseCode,
                  Site: s.siteCode ?? '',
                  District: s.district,
                  Block: s.block,
                  Principal: s.principalName ?? '',
                  Phone: s.phone ?? '',
                  Address: s.address ?? '',
                  'Virtual Classroom': s.hasVirtualClassroom ? 'Yes' : 'No',
                  'ICT Lab': s.hasIctLab ? 'Yes' : 'No',
                  Teachers: s.teachers ?? '',
                  Students: s.students ?? '',
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

      {/* ── Filters ───────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* District */}
        <select
          value={districtId}
          onChange={e => { setDistrictId(e.target.value); setBlockId(''); }}
          className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white
                     focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300
                     transition-colors text-slate-700 min-w-[160px]"
        >
          <option value="">All Districts</option>
          {districts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        {/* Block — only shown when a district is selected */}
        {districtId && (
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

        {/* Name search */}
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
      </div>

      {/* ── District analytics charts ────────────────── */}
      {districtSummaries.length > 0 && (() => {
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

      {/* ── Table ─────────────────────────────────────── */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr>
              <th>School</th>
              <th>UDISE</th>
              <th>District / Block</th>
              <th>Principal</th>
              <th>Facilities</th>
              <th className="text-right">Teachers</th>
              <th className="text-right">Students</th>
              {isAdmin && <th className="text-right">Login</th>}
              {isAdmin && <th className="text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-semibold text-navy-700">{s.name}</div>
                  {s.siteCode && (
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{s.siteCode}</div>
                  )}
                  {s.address && (
                    <div className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={s.address}>
                      {s.address}
                    </div>
                  )}
                </td>
                <td className="text-slate-500 font-mono text-xs">{s.udiseCode}</td>
                <td>
                  <div className="font-medium text-slate-700">{s.district}</div>
                  <div className="text-xs text-slate-400">{s.block}</div>
                </td>
                <td>
                  {s.principalName ? (
                    <>
                      <div className="text-slate-700 text-xs font-medium">{s.principalName}</div>
                      {s.phone && <div className="text-xs text-slate-400">{s.phone}</div>}
                    </>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {s.hasVirtualClassroom && (
                      <span className="badge-virtual">
                        <i className="fas fa-video mr-1" />Virtual
                      </span>
                    )}
                    {s.hasIctLab && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                        <i className="fas fa-desktop mr-1" />ICT Lab
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right font-medium">{s.teachers ?? '—'}</td>
                <td className="text-right font-medium">{s.students ?? '—'}</td>
                {isAdmin && (
                  <td className="text-right">
                    <SchoolLoginBtn schoolId={s.id} />
                  </td>
                )}
                {isAdmin && (
                  <td className="text-right">
                    <button
                      onClick={() => setModal(s)}
                      className="text-xs text-sky-600 hover:text-sky-800 font-medium transition-colors px-2 py-1 rounded hover:bg-sky-50"
                    >
                      <i className="fas fa-edit mr-1" />Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

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
            <span className="flex items-center gap-3">
              <span className="badge-virtual"><i className="fas fa-video mr-1" />Virtual Classroom</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                <i className="fas fa-desktop mr-1" />ICT Lab
              </span>
            </span>
          </div>
        )}
      </div>

      {/* ── Modal ─────────────────────────────────────── */}
      {modal && (
        <SchoolModal
          school={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
