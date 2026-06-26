import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';
import { ScopeBar, type Scope } from '../components/ScopeBar';

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
  General:  'fa-bullhorn',
  Academic: 'fa-graduation-cap',
  Event:    'fa-calendar-star',
  Urgent:   'fa-exclamation-triangle',
};

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'PRINCIPAL'];

// Roles that can publish beyond a single school
const BROAD_SCOPE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL'];

const today = new Date().toISOString().slice(0, 10);

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

const PUBLISH_SCOPES = [
  { value: 'school',   label: 'Single School',    icon: 'fa-school',   color: 'border-sky-400 bg-sky-50',      active: 'border-sky-500 bg-sky-100 text-sky-700'      },
  { value: 'block',    label: 'Block Schools',     icon: 'fa-city',     color: 'border-violet-400 bg-violet-50', active: 'border-violet-500 bg-violet-100 text-violet-700' },
  { value: 'district', label: 'District Schools',  icon: 'fa-map',      color: 'border-amber-400 bg-amber-50',  active: 'border-amber-500 bg-amber-100 text-amber-700'   },
  { value: 'all',      label: 'All 500 Schools',   icon: 'fa-globe',    color: 'border-emerald-400 bg-emerald-50', active: 'border-emerald-500 bg-emerald-100 text-emerald-700' },
];

const SCOPE_BADGE: Record<string, string> = {
  school:   'bg-sky-100 text-sky-700',
  block:    'bg-violet-100 text-violet-700',
  district: 'bg-amber-100 text-amber-700',
  all:      'bg-emerald-100 text-emerald-700',
};
const SCOPE_LABEL: Record<string, string> = {
  school: 'Single School', block: 'Block-wide', district: 'District-wide', all: 'All Schools',
};

export function NoticeBoard() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');
  const canBroadcast = BROAD_SCOPE_ROLES.includes(user?.role ?? '');

  const [scope, setScope] = useState<Scope>({});
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editNotice, setEditNotice] = useState<any | null>(null);
  const [publishScope, setPublishScope] = useState<string>('school');
  const [form, setForm] = useState({ title: '', description: '', type: 'General', publishDate: today, expiryDate: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const schoolId = scope.schoolId ?? user?.schoolId ?? '';

  const load = useCallback(async () => {
    if (!schoolId) { setNotices([]); return; }
    setLoading(true);
    try { setNotices(await api.notices(schoolId)); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [schoolId]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return notices;
    return notices.filter(n => n.type === filter);
  }, [notices, filter]);

  const urgentCount = notices.filter(n => n.type === 'Urgent').length;

  const resetForm = () => {
    setForm({ title: '', description: '', type: 'General', publishDate: today, expiryDate: '' });
    setPublishScope('school');
    setEditNotice(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    // School scope requires a school to be selected; broader scopes don't
    if (publishScope === 'school' && !schoolId) { setErr('Select a school first.'); return; }
    setSaving(true);
    try {
      if (editNotice) {
        await api.updateNotice(editNotice.id, form);
        setMsg('Notice updated.');
      } else {
        await api.createNotice({
          ...form,
          scope: publishScope,
          schoolId: publishScope === 'school' ? schoolId : undefined,
          blockId: publishScope === 'block' ? scope.blockId : undefined,
          districtId: publishScope === 'district' ? scope.districtId : undefined,
        });
        setMsg(`Notice posted to ${SCOPE_LABEL[publishScope]}.`);
      }
      resetForm();
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this notice?')) return;
    try { await api.deleteNotice(id); load(); }
    catch (e: any) { setErr((e as any).message); }
  };

  const startEdit = (n: any) => {
    setEditNotice(n);
    setForm({ title: n.title, description: n.description ?? '', type: n.type, publishDate: n.publishDate, expiryDate: n.expiryDate ?? '' });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-bullhorn" />Notice Board</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Notice Board</h1>
          <p className="text-sm text-slate-500 mt-1">School announcements, academic notices &amp; urgent alerts</p>
        </div>
        {canWrite && (
          <button onClick={() => { resetForm(); setShowForm(s => !s); }} className={showForm && !editNotice ? 'btn-outline' : 'btn-navy'}>
            {showForm && !editNotice ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Post Notice</>}
          </button>
        )}
      </div>

      <ScopeBar value={scope} onChange={setScope} />

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* Create / Edit form */}
      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="panel p-5 space-y-4 border-l-4 border-l-sky-500">
          <h2 className="font-semibold text-slate-700"><i className="fas fa-edit text-sky-500 mr-1.5" />{editNotice ? 'Edit Notice' : 'New Notice'}</h2>

          {/* Publish scope — only for broad-scope roles, only on new notices */}
          {!editNotice && canBroadcast && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-2">Publish To *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PUBLISH_SCOPES.map(s => (
                  <button key={s.value} type="button"
                    onClick={() => setPublishScope(s.value)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                      publishScope === s.value ? s.active + ' border-current' : 'border-slate-200 hover:border-slate-300 bg-white text-slate-600'
                    }`}>
                    <i className={`fas ${s.icon} text-lg`} />
                    <span className="text-xs font-semibold leading-tight">{s.label}</span>
                  </button>
                ))}
              </div>
              {publishScope !== 'school' && (
                <p className="text-xs text-amber-600 mt-2 bg-amber-50 rounded-lg px-3 py-2">
                  <i className="fas fa-info-circle mr-1" />
                  This notice will be visible to all schools in the selected {publishScope === 'all' ? 'state' : publishScope}.
                </p>
              )}
            </div>
          )}

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
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
              {editNotice ? 'Update' : 'Post Notice'}
            </button>
            <button type="button" onClick={resetForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', ...NOTICE_TYPES] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}>
            {f === 'all' ? 'All Notices' : f}
            {f === 'Urgent' && urgentCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] rounded-full px-1 min-w-[16px] text-center">{urgentCount}</span>
            )}
          </button>
        ))}
        {loading && <i className="fas fa-circle-notch fa-spin text-slate-400" />}
      </div>

      {/* Notice cards */}
      {!schoolId && (
        <div className="py-12 text-center text-slate-400 panel">
          <i className="fas fa-school text-3xl mb-2 block text-slate-300" />
          <p className="font-semibold text-slate-500">Select a school to view notices</p>
        </div>
      )}

      {schoolId && !loading && filtered.length === 0 && (
        <div className="py-12 text-center text-slate-400 panel">
          <i className="fas fa-bullhorn text-3xl mb-2 block text-slate-300" />
          <p className="font-semibold text-slate-500">No notices found</p>
          {canWrite && <p className="text-xs mt-1">Click "Post Notice" to create one.</p>}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map(n => {
          const type = (n.type ?? 'General') as NoticeType;
          const colorCls = TYPE_COLOR[type] ?? TYPE_COLOR.General;
          const borderCls = TYPE_BORDER[type] ?? TYPE_BORDER.General;
          const icon = TYPE_ICON[type] ?? 'fa-bullhorn';
          const isExpired = n.expiryDate && n.expiryDate < today;
          return (
            <div key={n.id} className={`rounded-xl border-l-4 border border-slate-200 bg-white p-5 ${borderCls} ${isExpired ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm ${colorCls}`}>
                  <i className={`fas ${icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800">{n.title}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${colorCls}`}>{type}</span>
                    {n.scope && n.scope !== 'school' && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SCOPE_BADGE[n.scope] ?? 'bg-slate-100 text-slate-600'}`}>
                        <i className="fas fa-globe mr-0.5" />{SCOPE_LABEL[n.scope] ?? n.scope}
                      </span>
                    )}
                    {isExpired && <span className="text-[10px] text-slate-400 font-medium">Expired</span>}
                    {n.type === 'Urgent' && !isExpired && (
                      <span className="text-[10px] font-bold text-rose-600 animate-pulse">⚠ URGENT</span>
                    )}
                  </div>
                  {n.description && <p className="text-sm text-slate-600 mt-1 leading-relaxed">{n.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    <span><i className="fas fa-calendar mr-1" />{fmtDate(n.publishDate)}</span>
                    {n.expiryDate && <span><i className="fas fa-clock mr-1" />Expires {fmtDate(n.expiryDate)}</span>}
                    {n.createdByName && <span><i className="fas fa-user mr-1" />{n.createdByName}</span>}
                  </div>
                </div>
                {canWrite && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => startEdit(n)} className="text-slate-300 hover:text-sky-500 transition-colors p-1 text-xs">
                      <i className="fas fa-edit" />
                    </button>
                    <button onClick={() => handleDelete(n.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1 text-xs">
                      <i className="fas fa-trash" />
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
