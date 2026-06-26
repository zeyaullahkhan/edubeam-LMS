import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';
const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'PRINCIPAL'];

function fmtRange(start: string, end: string) {
  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function AcademicYears() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');
  const [years, setYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setYears(await api.academicYears()); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    setSaving(true);
    try {
      await api.createAcademicYear(form);
      setMsg('Academic year created.');
      setShowForm(false);
      setForm({ label: '', startDate: '', endDate: '' });
      load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleSetCurrent = async (id: string) => {
    try { await api.setCurrentAcademicYear(id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this academic year?')) return;
    try { await api.deleteAcademicYear(id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const current = years.find(y => y.isCurrent);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-calendar-alt" />Academic Calendar</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Academic Years</h1>
          <p className="text-sm text-slate-500 mt-1">Manage academic sessions and set the active year</p>
        </div>
        {canWrite && (
          <button onClick={() => setShowForm(s => !s)} className={showForm ? 'btn-outline' : 'btn-navy'}>
            {showForm ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Add Year</>}
          </button>
        )}
      </div>

      {msg &&<div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* Current year banner */}
      {current && (
        <div className="panel p-5 border-l-4 border-l-emerald-500 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
            <i className="fas fa-check-circle text-lg" />
          </div>
          <div>
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide">Current Active Year</p>
            <p className="font-bold text-slate-800 text-lg">{current.label}</p>
            <p className="text-xs text-slate-500">{fmtRange(current.startDate, current.endDate)}</p>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="panel p-5 space-y-4 border-l-4 border-l-sky-500">
          <h2 className="font-semibold text-slate-700"><i className="fas fa-plus-circle text-sky-500 mr-1.5" />New Academic Year</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Label *</label>
              <input required className={inputCls} value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="e.g. 2025-26" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date *</label>
              <input required type="date" className={inputCls} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">End Date *</label>
              <input required type="date" className={inputCls} value={form.endDate} min={form.startDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      {!loading && years.length === 0 && (
        <div className="py-12 text-center panel text-slate-400">
          <i className="fas fa-calendar-alt text-3xl mb-2 block text-slate-300" />
          <p className="font-semibold text-slate-500">No academic years defined yet</p>
          {canWrite && <p className="text-xs mt-1">Click "Add Year" to create one.</p>}
        </div>
      )}

      {years.length > 0 && (
        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['Year', 'Period', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-xs text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {years.map(y => (
                <tr key={y.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-bold text-slate-800">{y.label}</td>
                  <td className="px-4 py-3 text-slate-500">{fmtRange(y.startDate, y.endDate)}</td>
                  <td className="px-4 py-3">
                    {y.isCurrent ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">
                        <i className="fas fa-check-circle" />Active
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canWrite && (
                      <div className="flex items-center gap-2 justify-end">
                        {!y.isCurrent && (
                          <button onClick={() => handleSetCurrent(y.id)}
                            className="text-xs text-sky-600 hover:text-sky-800 font-medium transition-colors">
                            Set Active
                          </button>
                        )}
                        <button onClick={() => handleDelete(y.id)}
                          className="text-slate-300 hover:text-rose-500 transition-colors">
                          <i className="fas fa-trash text-xs" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
