import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const NOTICE_TYPES = ['General', 'Academic', 'Event', 'Urgent'] as const;
type NoticeType = typeof NOTICE_TYPES[number];

const TYPE_COLOR: Record<NoticeType, string> = {
  General:  'bg-slate-100 text-slate-700 border-slate-300',
  Academic: 'bg-sky-100 text-sky-700 border-sky-300',
  Event:    'bg-violet-100 text-violet-700 border-violet-300',
  Urgent:   'bg-rose-100 text-rose-700 border-rose-300',
};
const TYPE_BORDER: Record<NoticeType, string> = {
  General:  'border-l-slate-400',
  Academic: 'border-l-sky-500',
  Event:    'border-l-violet-500',
  Urgent:   'border-l-rose-500',
};
const TYPE_ICON: Record<NoticeType, string> = {
  General: 'fa-bullhorn', Academic: 'fa-graduation-cap',
  Event: 'fa-calendar-star', Urgent: 'fa-exclamation-triangle',
};
const SCOPE_BADGE: Record<string, string> = {
  school: 'bg-sky-100 text-sky-700', block: 'bg-violet-100 text-violet-700',
  district: 'bg-amber-100 text-amber-700', all: 'bg-emerald-100 text-emerald-700',
};
const SCOPE_LABEL: Record<string, string> = {
  school: 'School', block: 'Block-wide', district: 'District-wide', all: 'All Schools',
};

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL'];
const today = new Date().toISOString().slice(0, 10);

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

// Role → which publish scopes they can use
function allowedScopes(role: string) {
  if (role === 'ADMIN' || role === 'STATE_OFFICIAL') return ['school', 'block', 'district', 'all'];
  if (role === 'DISTRICT_OFFICIAL') return ['school', 'block', 'district'];
  if (role === 'BLOCK_OFFICIAL') return ['school', 'block'];
  if (role === 'PRINCIPAL') return ['school'];
  return [];
}

const PUBLISH_SCOPE_CONFIG = [
  { value: 'school',   label: 'Single School',   icon: 'fa-school',    active: 'border-sky-500 bg-sky-50 text-sky-700' },
  { value: 'block',    label: 'Block Schools',    icon: 'fa-city',      active: 'border-violet-500 bg-violet-50 text-violet-700' },
  { value: 'district', label: 'District Schools', icon: 'fa-map',       active: 'border-amber-500 bg-amber-50 text-amber-700' },
  { value: 'all',      label: 'All Schools',      icon: 'fa-globe',     active: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
];

export function NoticeBoard() {
  const { user } = useAuth();
  const role = user?.role ?? '';
  const canWrite = WRITE_ROLES.includes(role);
  const isPlatformAdmin = role === 'ADMIN' && !user?.tenantId;
  const isPrincipal = role === 'PRINCIPAL';
  const scopes = allowedScopes(role);

  // ── State ──────────────────────────────────────────────────────────────
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [districts, setDistricts] = useState<{ id: string; name: string; blocks?: { id: string; name: string }[] }[]>([]);
  const [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]);

  const [viewDistrictId, setViewDistrictId] = useState('');
  const [viewBlockId, setViewBlockId] = useState('');
  const [viewSchoolId, setViewSchoolId] = useState('');

  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const [showForm, setShowForm] = useState(false);
  const [editNotice, setEditNotice] = useState<any | null>(null);
  const [publishScope, setPublishScope] = useState<string>(isPrincipal ? 'school' : 'all');
  const [publishTenant, setPublishTenant] = useState('');
  const [publishDistrictId, setPublishDistrictId] = useState('');
  const [publishBlockId, setPublishBlockId] = useState('');
  const [publishSchoolId, setPublishSchoolId] = useState('');
  const [form, setForm] = useState({ title: '', description: '', type: 'General', publishDate: today, expiryDate: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  // ── Load tenant list for Platform Admin ─────────────────────────────────
  useEffect(() => {
    if (isPlatformAdmin) {
      api.tenants().then(t => {
        setTenants(t);
        if (t[0]) { setSelectedTenant(t[0].id); setPublishTenant(t[0].id); }
      }).catch(() => {});
    }
  }, [isPlatformAdmin]);

  // ── Load districts for non-principal roles ────────────────────────────────
  useEffect(() => {
    if (isPrincipal) return;
    api.schoolDistricts()
      .then((list) => setDistricts(list as any[]))
      .catch(() => {});
  }, [isPrincipal]);

  // ── Update blocks when view district changes ──────────────────────────────
  useEffect(() => {
    if (!viewDistrictId) { setBlocks([]); setViewBlockId(''); return; }
    const found = districts.find(d => d.id === viewDistrictId);
    if (found) setBlocks(found.blocks ?? []);
  }, [viewDistrictId, districts]);

  // ── Load schools for principal scope or school-level view ───────────────
  useEffect(() => {
    if (isPrincipal && user?.schoolId) {
      setPublishSchoolId(user.schoolId);
      setViewSchoolId(user.schoolId);
    }
  }, [isPrincipal, user?.schoolId]);

  // ── Build load params ────────────────────────────────────────────────────
  const loadParams = useMemo(() => {
    if (isPrincipal) return { schoolId: user?.schoolId ?? '' };
    if (viewSchoolId) return { schoolId: viewSchoolId };
    if (viewBlockId)  return { blockId: viewBlockId, tenantId: selectedTenant || user?.tenantId };
    if (viewDistrictId) return { districtId: viewDistrictId, tenantId: selectedTenant || user?.tenantId };
    // Default: load by tenant
    const tid = selectedTenant || user?.tenantId;
    return tid ? { tenantId: tid } : {};
  }, [isPrincipal, user?.schoolId, user?.tenantId, viewSchoolId, viewBlockId, viewDistrictId, selectedTenant]);

  const load = useCallback(async () => {
    if (!Object.keys(loadParams).length && role !== 'ADMIN') return;
    setLoading(true); setErr('');
    try { setNotices(await api.notices(loadParams as any)); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [loadParams, role]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() =>
    filter === 'all' ? notices : notices.filter(n => n.type === filter),
    [notices, filter]);

  const urgentCount = notices.filter(n => n.type === 'Urgent').length;

  // ── Form helpers ─────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm({ title: '', description: '', type: 'General', publishDate: today, expiryDate: '' });
    setPublishScope(isPrincipal ? 'school' : 'all');
    setPublishDistrictId(''); setPublishBlockId(''); setPublishSchoolId(isPrincipal ? (user?.schoolId ?? '') : '');
    setEditNotice(null); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (publishScope === 'school' && !publishSchoolId) { setErr('Select a school.'); return; }
    if (publishScope === 'block' && !publishBlockId) { setErr('Select a block or district first.'); return; }
    if (publishScope === 'district' && !publishDistrictId) { setErr('Select a district.'); return; }
    if (publishScope === 'all' && !publishTenant && isPlatformAdmin) { setErr('Select a state.'); return; }
    setSaving(true);
    try {
      if (editNotice) {
        await api.updateNotice(editNotice.id, form);
        setMsg('Notice updated.');
      } else {
        await api.createNotice({
          ...form,
          scope: publishScope,
          tenantId: publishScope === 'all' ? (publishTenant || user?.tenantId || undefined) : undefined,
          schoolId: publishScope === 'school' ? (publishSchoolId || undefined) : undefined,
          blockId: publishScope === 'block' ? (publishBlockId || undefined) : undefined,
          districtId: (publishScope === 'district' || publishScope === 'block') ? (publishDistrictId || undefined) : undefined,
        });
        setMsg(`Notice posted to ${SCOPE_LABEL[publishScope]}.`);
      }
      resetForm(); load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const startEdit = (n: any) => {
    setEditNotice(n);
    setForm({ title: n.title, description: n.description ?? '', type: n.type, publishDate: n.publishDate, expiryDate: n.expiryDate ?? '' });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    try { await api.deleteNotice(id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const canEditDelete = (n: any) => role === 'ADMIN' || n.createdById === user?.id;

  // ── Scope pills for publish ───────────────────────────────────────────────
  const visiblePublishScopes = PUBLISH_SCOPE_CONFIG.filter(s => scopes.includes(s.value));

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-bullhorn" />Announcements</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Notice Board</h1>
          <p className="text-sm text-slate-500 mt-1">School announcements, academic notices &amp; urgent alerts</p>
        </div>
        {canWrite && (
          <button onClick={() => { resetForm(); setShowForm(s => !s); setErr(''); setMsg(''); }}
            className={showForm && !editNotice ? 'btn-outline' : 'btn-navy'}>
            {showForm && !editNotice ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Post Notice</>}
          </button>
        )}
      </div>

      {/* ── Platform Admin state selector ── */}
      {isPlatformAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">State:</span>
          {tenants.map(t => (
            <button key={t.id} onClick={() => { setSelectedTenant(t.id); setPublishTenant(t.id); setViewDistrictId(''); setViewBlockId(''); setViewSchoolId(''); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${selectedTenant === t.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* ── View scope bar (Admin/State/District roles) ── */}
      {!isPrincipal && (
        <div className="flex items-center gap-2 flex-wrap panel px-4 py-3">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wide mr-1">View:</span>
          <button onClick={() => { setViewDistrictId(''); setViewBlockId(''); setViewSchoolId(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!viewDistrictId && !viewSchoolId ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
            All State
          </button>
          {districts.slice(0, 13).map(d => (
            <button key={d.id} onClick={() => { setViewDistrictId(d.id); setViewBlockId(''); setViewSchoolId(''); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${viewDistrictId === d.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>
              {d.name}
            </button>
          ))}
        </div>
      )}

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* ── Create / Edit form ── */}
      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="panel p-5 space-y-5 border-l-4 border-l-sky-500">
          <h2 className="font-semibold text-slate-700">
            <i className={`fas ${editNotice ? 'fa-edit' : 'fa-plus-circle'} text-sky-500 mr-1.5`} />
            {editNotice ? 'Edit Notice' : 'New Notice'}
          </h2>

          {/* Publish scope buttons */}
          {!editNotice && visiblePublishScopes.length > 1 && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Publish To *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {visiblePublishScopes.map(s => (
                  <button key={s.value} type="button" onClick={() => setPublishScope(s.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all text-sm font-semibold ${
                      publishScope === s.value ? s.active + ' border-current' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}>
                    <i className={`fas ${s.icon} text-lg`} />
                    <span className="text-xs leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>

              {/* Scope-specific selectors */}
              {publishScope === 'all' && isPlatformAdmin && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-2">State *</label>
                  <div className="flex flex-wrap gap-2">
                    {tenants.map(t => (
                      <button key={t.id} type="button" onClick={() => setPublishTenant(t.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 transition-all ${publishTenant === t.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
                        {t.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 mt-2">
                    <i className="fas fa-globe mr-1" />This notice will be visible to all schools in {tenants.find(t => t.id === publishTenant)?.name ?? 'selected state'}.
                  </p>
                </div>
              )}

              {(publishScope === 'district' || publishScope === 'block') && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">District *</label>
                  <div className="flex flex-wrap gap-2">
                    {districts.map(d => (
                      <button key={d.id} type="button" onClick={() => setPublishDistrictId(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${publishDistrictId === d.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-500 border-slate-200 hover:border-amber-300'}`}>
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {publishScope === 'school' && !isPrincipal && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">School ID</label>
                  <input className={inputCls + ' max-w-sm'} value={publishSchoolId} onChange={e => setPublishSchoolId(e.target.value)} placeholder="Paste school ID" />
                  <p className="text-xs text-slate-400 mt-1">Or select a school from the view panel, then post.</p>
                </div>
              )}

              {publishScope !== 'school' && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                  <i className="fas fa-info-circle mr-1" />
                  Visible to all schools in the selected {publishScope === 'all' ? 'state' : publishScope}.
                </p>
              )}
            </div>
          )}

          {/* Notice fields */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
              <input required className={inputCls} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Notice title" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
              <select className={inputCls} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {NOTICE_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Publish Date *</label>
              <input required type="date" className={inputCls} value={form.publishDate} onChange={e => setForm({ ...form, publishDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date (optional)</label>
              <input type="date" className={inputCls} value={form.expiryDate} min={form.publishDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
              <textarea className={inputCls + ' resize-none'} rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Notice details (optional)" />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
              {editNotice ? 'Update Notice' : 'Post Notice'}
            </button>
            <button type="button" onClick={resetForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...NOTICE_TYPES] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            {f === 'all' ? 'All Notices' : f}
            {f === 'Urgent' && urgentCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] rounded-full px-1.5">{urgentCount}</span>
            )}
          </button>
        ))}
        {loading && <i className="fas fa-circle-notch fa-spin text-slate-400" />}
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} notice{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Empty state ── */}
      {!loading && filtered.length === 0 && (
        <div className="py-12 text-center panel text-slate-400">
          <i className="fas fa-bullhorn text-3xl mb-2 block text-slate-200" />
          <p className="font-semibold text-slate-500">No notices found</p>
          {canWrite && <p className="text-xs mt-1">Click "Post Notice" to create one.</p>}
        </div>
      )}

      {/* ── Notice cards ── */}
      <div className="space-y-3">
        {filtered.map(n => {
          const type = (n.type ?? 'General') as NoticeType;
          const isExpired = n.expiryDate && n.expiryDate < today;
          return (
            <div key={n.id} className={`rounded-xl border-l-4 border border-slate-200 bg-white p-5 ${TYPE_BORDER[type] ?? 'border-l-slate-400'} ${isExpired ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm ${TYPE_COLOR[type] ?? TYPE_COLOR.General}`}>
                  <i className={`fas ${TYPE_ICON[type] ?? 'fa-bullhorn'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{n.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${TYPE_COLOR[type] ?? TYPE_COLOR.General}`}>{type}</span>
                    {n.scope && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SCOPE_BADGE[n.scope] ?? 'bg-slate-100 text-slate-600'}`}>
                        <i className={`fas ${n.scope === 'all' ? 'fa-globe' : n.scope === 'district' ? 'fa-map' : n.scope === 'block' ? 'fa-city' : 'fa-school'} mr-0.5`} />
                        {SCOPE_LABEL[n.scope] ?? n.scope}
                      </span>
                    )}
                    {isExpired && <span className="text-[10px] text-slate-400 font-medium">Expired</span>}
                    {type === 'Urgent' && !isExpired && <span className="text-[10px] font-bold text-rose-600 animate-pulse">⚠ URGENT</span>}
                  </div>
                  {n.description && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span><i className="fas fa-calendar mr-1" />{fmtDate(n.publishDate)}</span>
                    {n.expiryDate && <span><i className="fas fa-clock mr-1" />Expires {fmtDate(n.expiryDate)}</span>}
                    {n.createdByName && <span><i className="fas fa-user mr-1" />{n.createdByName}</span>}
                  </div>
                </div>
                {canEditDelete(n) && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(n)} className="text-slate-300 hover:text-sky-500 transition-colors p-1.5 rounded hover:bg-sky-50">
                      <i className="fas fa-edit text-xs" />
                    </button>
                    <button onClick={() => handleDelete(n.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 rounded hover:bg-rose-50">
                      <i className="fas fa-trash text-xs" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
