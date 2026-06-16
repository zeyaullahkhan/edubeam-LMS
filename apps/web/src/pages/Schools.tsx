import { useEffect, useRef, useState } from 'react';
import { api, type DistrictMeta, type SchoolFormData, type SchoolRow } from '../api';
import { exportCsv } from '../export';
import { useAuth } from '../auth';

// ── School form modal ─────────────────────────────────────────────────────────

interface SchoolModalProps {
  school?: SchoolRow | null;
  onClose: () => void;
  onSaved: (s: SchoolRow) => void;
}

function SchoolModal({ school, onClose, onSaved }: SchoolModalProps) {
  const isEdit = !!school;
  const [districts, setDistricts] = useState<DistrictMeta[]>([]);
  const [districtId, setDistrictId] = useState(school?.districtId ?? '');
  const [form, setForm] = useState<SchoolFormData>({
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
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.schoolDistricts().then(setDistricts);
    setTimeout(() => firstRef.current?.focus(), 50);
  }, []);

  const blocks = districts.find(d => d.id === districtId)?.blocks ?? [];

  const set = (k: keyof SchoolFormData, v: any) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.udiseCode.trim() || !form.blockId) {
      setError('Name, UDISE code and Block are required.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-heading font-bold text-navy-700 text-lg">
            {isEdit ? 'Edit School' : 'Add School'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-5">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <i className="fas fa-exclamation-circle" />
              {error}
            </div>
          )}

          {/* Row 1: Name */}
          <div>
            <label className="form-label">School Name *</label>
            <input
              ref={firstRef}
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. GGIC ALMORA"
              className="form-input"
              required
            />
          </div>

          {/* Row 2: UDISE + Site Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">UDISE Code *</label>
              <input
                value={form.udiseCode}
                onChange={e => set('udiseCode', e.target.value)}
                placeholder="e.g. 5090615301"
                className="form-input font-mono"
                required
              />
            </div>
            <div>
              <label className="form-label">Site Code</label>
              <input
                value={form.siteCode ?? ''}
                onChange={e => set('siteCode', e.target.value)}
                placeholder="e.g. VVEAMO376"
                className="form-input font-mono"
              />
            </div>
          </div>

          {/* Row 3: District + Block */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">District *</label>
              <select
                value={districtId}
                onChange={e => { setDistrictId(e.target.value); set('blockId', ''); }}
                className="form-input"
                required
              >
                <option value="">— Select district —</option>
                {districts.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Block *</label>
              <select
                value={form.blockId}
                onChange={e => set('blockId', e.target.value)}
                className="form-input"
                required
                disabled={!districtId}
              >
                <option value="">— Select block —</option>
                {blocks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Type + checkboxes */}
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
              <input
                type="checkbox"
                checked={form.hasVirtualClassroom}
                onChange={e => set('hasVirtualClassroom', e.target.checked)}
                className="w-4 h-4 rounded accent-sky-600"
              />
              <span className="text-sm font-medium text-slate-700">Virtual Classroom</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer py-2">
              <input
                type="checkbox"
                checked={form.hasIctLab}
                onChange={e => set('hasIctLab', e.target.checked)}
                className="w-4 h-4 rounded accent-sky-600"
              />
              <span className="text-sm font-medium text-slate-700">ICT Lab</span>
            </label>
          </div>

          {/* Row 5: Principal + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Principal / Head Master</label>
              <input
                value={form.principalName ?? ''}
                onChange={e => set('principalName', e.target.value)}
                placeholder="Name"
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Contact Number</label>
              <input
                value={form.phone ?? ''}
                onChange={e => set('phone', e.target.value)}
                placeholder="Mobile"
                className="form-input"
              />
            </div>
          </div>

          {/* Row 6: Address */}
          <div>
            <label className="form-label">Address</label>
            <textarea
              value={form.address ?? ''}
              onChange={e => set('address', e.target.value)}
              placeholder="Full address"
              rows={2}
              className="form-input resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-outline px-5 py-2.5">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-navy px-6 py-2.5">
              {saving
                ? <><i className="fas fa-circle-notch fa-spin mr-2" />Saving…</>
                : <><i className={`fas fa-${isEdit ? 'save' : 'plus'} mr-2`} />{isEdit ? 'Save Changes' : 'Add School'}</>
              }
            </button>
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

  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'add' | SchoolRow | null>(null);
  const [page, setPage] = useState(1);

  const [districts, setDistricts] = useState<DistrictMeta[]>([]);
  const [districtId, setDistrictId] = useState('');
  const [blockId, setBlockId] = useState('');

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

  useEffect(() => { api.schoolDistricts().then(setDistricts); }, []);
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
            Virtual Classroom &amp; ICT Lab schools · Uttarakhand 2025–26
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
