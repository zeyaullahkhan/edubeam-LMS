import { useEffect, useState } from 'react';
import { ROLES, type DistrictSummary, type Role } from '@edubeam/shared';
import { api, type BlockSummary, type ManagedUser, type SchoolRow } from '../api';

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrator',
  STATE_OFFICIAL: 'State Official',
  DISTRICT_OFFICIAL: 'District Official',
  BLOCK_OFFICIAL: 'Block Official',
  PRINCIPAL: 'Principal',
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent',
};

const ROLE_ICONS: Record<string, string> = {
  ADMIN: 'fas fa-shield-alt',
  STATE_OFFICIAL: 'fas fa-landmark',
  DISTRICT_OFFICIAL: 'fas fa-map-marker-alt',
  BLOCK_OFFICIAL: 'fas fa-map',
  PRINCIPAL: 'fas fa-user-tie',
  TEACHER: 'fas fa-chalkboard-teacher',
  STUDENT: 'fas fa-user-graduate',
  PARENT: 'fas fa-user-friends',
};

const needsDistrict = (r: Role) => r === 'DISTRICT_OFFICIAL' || r === 'BLOCK_OFFICIAL';
const needsBlock    = (r: Role) => r === 'BLOCK_OFFICIAL';
const needsSchool   = (r: Role) => ['PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'].includes(r);

const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

export function AdminUsers() {
  const [users, setUsers]       = useState<ManagedUser[]>([]);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [blocks, setBlocks]     = useState<BlockSummary[]>([]);
  const [schools, setSchools]   = useState<SchoolRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');

  const empty = { email: '', name: '', password: '', role: 'TEACHER' as Role, districtId: '', blockId: '', schoolId: '' };
  const [form, setForm] = useState(empty);

  const load = () => api.users.list().then(setUsers).catch((e) => setErr((e as Error).message));
  useEffect(() => { load(); api.districts().then(setDistricts); }, []);

  useEffect(() => {
    if (form.districtId) {
      api.blocks(form.districtId).then(setBlocks);
      if (!needsBlock(form.role)) api.schools({ districtId: form.districtId }).then(setSchools);
    } else {
      setBlocks([]);
      setSchools([]);
    }
  }, [form.districtId, form.role]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setMsg('');
    try {
      await api.users.create({
        email:      form.email,
        name:       form.name,
        password:   form.password,
        role:       form.role,
        districtId: needsDistrict(form.role) || needsSchool(form.role) ? form.districtId || null : null,
        blockId:    needsBlock(form.role) ? form.blockId || null : null,
        schoolId:   needsSchool(form.role) ? form.schoolId || null : null,
      });
      setMsg(`User ${form.email} created successfully.`);
      setForm(empty);
      setShowForm(false);
      load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const toggleActive = async (u: ManagedUser) => {
    await api.users.update(u.id, { active: !u.active });
    load();
  };
  const resetPassword = async (u: ManagedUser) => {
    const pw = window.prompt(`New password for ${u.email}:`);
    if (!pw) return;
    await api.users.update(u.id, { password: pw });
    setMsg(`Password reset for ${u.email}`);
  };
  const remove = async (u: ManagedUser) => {
    if (!window.confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    try { await api.users.remove(u.id); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div className="space-y-5">
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2">
            <i className="fas fa-users-cog" />
            Administrator Console
          </div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">{users.length} users registered</p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className={showForm ? 'btn-outline' : 'btn-navy'}
        >
          {showForm ? (
            <><i className="fas fa-times" />Cancel</>
          ) : (
            <><i className="fas fa-user-plus" />New user</>
          )}
        </button>
      </div>

      {/* ── Alerts ────────────────────────────────────────────── */}
      {msg && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm">
          <i className="fas fa-check-circle" /> {msg}
        </div>
      )}
      {err && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <i className="fas fa-exclamation-circle" /> {err}
        </div>
      )}

      {/* ── Create user form ──────────────────────────────────── */}
      {showForm && (
        <form onSubmit={submit} className="panel p-5">
          <h2 className="font-heading font-semibold text-navy-700 mb-4">
            <i className="fas fa-user-plus text-sky-500 mr-2" />
            Create new user
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full name</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@edubeam.in" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Temporary password</label>
              <input required className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, blockId: '', schoolId: '' })}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            {(needsDistrict(form.role) || needsSchool(form.role)) && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">District</label>
                <select required className={inputCls} value={form.districtId} onChange={(e) => setForm({ ...form, districtId: e.target.value, blockId: '', schoolId: '' })}>
                  <option value="">Select district…</option>
                  {districts.map((d) => <option key={d.districtId} value={d.districtId}>{d.district}</option>)}
                </select>
              </div>
            )}
            {needsBlock(form.role) && form.districtId && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Block</label>
                <select required className={inputCls} value={form.blockId} onChange={(e) => setForm({ ...form, blockId: e.target.value })}>
                  <option value="">Select block…</option>
                  {blocks.map((b) => <option key={b.blockId} value={b.blockId}>{b.block}</option>)}
                </select>
              </div>
            )}
            {needsSchool(form.role) && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">School</label>
                <select required disabled={!form.districtId} className={inputCls + ' disabled:opacity-40 disabled:cursor-not-allowed'} value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                  <option value="">Select school…</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="md:col-span-3 pt-2 border-t border-slate-100">
              <button type="submit" className="btn-primary">
                <i className="fas fa-user-plus" />
                Create user
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ── Users table ───────────────────────────────────────── */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Scope</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-navy-600/10 flex items-center justify-center flex-shrink-0">
                      <i className={`${ROLE_ICONS[u.role] ?? 'fas fa-user'} text-navy-600 text-xs`} />
                    </div>
                    <span className="font-semibold text-navy-700">{u.name}</span>
                  </div>
                </td>
                <td className="text-slate-500">{u.email}</td>
                <td>
                  <span className="text-xs font-semibold text-navy-600 bg-navy-50 border border-navy-100 rounded px-2 py-0.5">
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                </td>
                <td className="text-slate-500">{u.school ?? u.block ?? u.district ?? 'Statewide'}</td>
                <td>
                  <span className={`text-xs font-semibold rounded px-2 py-0.5 border ${
                    u.active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {u.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="text-right whitespace-nowrap">
                  <button
                    onClick={() => toggleActive(u)}
                    className="text-xs text-slate-600 hover:text-sky-600 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors"
                  >
                    {u.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => resetPassword(u)}
                    className="text-xs text-slate-600 hover:text-navy-600 font-medium px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                  >
                    Reset PW
                  </button>
                  <button
                    onClick={() => remove(u)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">
            <i className="fas fa-users text-2xl mb-2 block" />
            No users yet
          </div>
        )}
      </div>
    </div>
  );
}
