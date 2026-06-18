import { useEffect, useState } from 'react';
import { ROLES, type DistrictSummary, type Role } from '@edubeam/shared';
import { api, type BlockSummary, type ManagedUser, type SchoolRow } from '../api';
import { ConfirmDialog } from '../components/ConfirmDialog';

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
  // reference data
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [filterBlocks, setFilterBlocks] = useState<BlockSummary[]>([]);
  const [filterSchools, setFilterSchools] = useState<SchoolRow[]>([]);
  const [formBlocks, setFormBlocks] = useState<BlockSummary[]>([]);
  const [formSchools, setFormSchools] = useState<SchoolRow[]>([]);

  // list result
  const [users, setUsers]   = useState<ManagedUser[]>([]);
  const [total, setTotal]   = useState(0);
  const [pages, setPages]   = useState(1);

  // filters
  const [q, setQ]                   = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDist, setFilterDist] = useState('');
  const [filterBlock, setFilterBlock] = useState('');
  const [filterSchool, setFilterSchool] = useState('');
  const [page, setPage]             = useState(1);

  // form
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg]           = useState('');
  const [err, setErr]           = useState('');
  const [confirmUser, setConfirmUser] = useState<ManagedUser | null>(null);
  const empty = { email: '', name: '', password: '', role: 'TEACHER' as Role, districtId: '', blockId: '', schoolId: '' };
  const [form, setForm] = useState(empty);

  const load = (p = page) => {
    api.users
      .list({ q: q || undefined, role: filterRole || undefined, districtId: filterDist || undefined, blockId: filterBlock || undefined, schoolId: filterSchool || undefined, page: p })
      .then(({ users: u, total: t, pages: pg }) => { setUsers(u); setTotal(t); setPages(pg); })
      .catch((e) => setErr((e as Error).message));
  };

  useEffect(() => { api.districts().then(setDistricts); }, []);
  useEffect(() => { load(1); setPage(1); }, [q, filterRole, filterDist, filterBlock, filterSchool]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(page); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // cascade filter blocks when filter district changes
  useEffect(() => {
    setFilterBlock(''); setFilterSchool('');
    if (filterDist) {
      api.blocks(filterDist).then(setFilterBlocks);
      api.schools({ districtId: filterDist }).then(setFilterSchools);
    } else { setFilterBlocks([]); setFilterSchools([]); }
  }, [filterDist]);

  // cascade filter schools when filter block changes
  useEffect(() => {
    setFilterSchool('');
    if (filterBlock) api.schools({ blockId: filterBlock }).then(setFilterSchools);
    else if (filterDist) api.schools({ districtId: filterDist }).then(setFilterSchools);
  }, [filterBlock]); // eslint-disable-line react-hooks/exhaustive-deps

  // cascade form blocks/schools
  useEffect(() => {
    if (form.districtId) {
      api.blocks(form.districtId).then(setFormBlocks);
      if (!needsBlock(form.role)) api.schools({ districtId: form.districtId }).then(setFormSchools);
    } else { setFormBlocks([]); setFormSchools([]); }
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
      setMsg(`User ${form.email} created.`);
      setForm(empty);
      setShowForm(false);
      load(1); setPage(1);
    } catch (e) { setErr((e as Error).message); }
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
    try { await api.users.remove(u.id); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  const start = (page - 1) * 50 + 1;
  const end   = Math.min(page * 50, total);

  return (
    <>
    <div className="space-y-5">
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2">
            <i className="fas fa-users-cog" />
            Administrator Console
          </div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total > 0 ? `Showing ${start}–${end} of ${total} users` : 'No users found'}
          </p>
        </div>
        <button onClick={() => setShowForm((s) => !s)} className={showForm ? 'btn-outline' : 'btn-navy'}>
          {showForm ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-user-plus" />New user</>}
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
            <i className="fas fa-user-plus text-sky-500 mr-2" />Create new user
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Full name</label>
              <input required className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
              <input required type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@edubeam.com" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Temporary password</label>
              <input required className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Role</label>
              <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role, blockId: '', schoolId: '' })}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
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
                  {formBlocks.map((b) => <option key={b.blockId} value={b.blockId}>{b.block}</option>)}
                </select>
              </div>
            )}
            {needsSchool(form.role) && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">School</label>
                <select required disabled={!form.districtId} className={inputCls + ' disabled:opacity-40 disabled:cursor-not-allowed'} value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
                  <option value="">Select school…</option>
                  {formSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            <div className="md:col-span-3 pt-2 border-t border-slate-100">
              <button type="submit" className="btn-primary"><i className="fas fa-user-plus" />Create user</button>
            </div>
          </div>
        </form>
      )}

      {/* ── Search & filter bar ───────────────────────────────── */}
      <div className="panel p-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* text search */}
          <div className="md:col-span-2 relative">
            <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
            <input
              className={inputCls + ' pl-8'}
              placeholder="Search name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {/* district filter */}
          <select className={inputCls} value={filterDist} onChange={(e) => { setFilterDist(e.target.value); setFilterBlock(''); setFilterSchool(''); }}>
            <option value="">All districts</option>
            {districts.map((d) => <option key={d.districtId} value={d.districtId}>{d.district}</option>)}
          </select>

          {/* block filter (cascades from district) */}
          <select className={inputCls} value={filterBlock} onChange={(e) => setFilterBlock(e.target.value)} disabled={!filterDist}>
            <option value="">All blocks</option>
            {filterBlocks.map((b) => <option key={b.blockId} value={b.blockId}>{b.block}</option>)}
          </select>

          {/* school filter (cascades from block/district) */}
          <select className={inputCls} value={filterSchool} onChange={(e) => setFilterSchool(e.target.value)} disabled={!filterDist}>
            <option value="">All schools</option>
            {filterSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* role chips */}
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100">
          {['', ...ROLES].map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                filterRole === r
                  ? 'bg-navy-600 text-white border-navy-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-navy-300 hover:text-navy-600'
              }`}
            >
              {r ? ROLE_LABELS[r] ?? r : 'All roles'}
            </button>
          ))}
        </div>
      </div>

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
                  <button onClick={() => toggleActive(u)} className="text-xs text-slate-600 hover:text-sky-600 font-medium px-2 py-1 rounded hover:bg-sky-50 transition-colors">
                    {u.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button onClick={() => resetPassword(u)} className="text-xs text-slate-600 hover:text-navy-600 font-medium px-2 py-1 rounded hover:bg-slate-50 transition-colors">
                    Reset PW
                  </button>
                  <button onClick={() => setConfirmUser(u)} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
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
            No users match the current filters
          </div>
        )}

        {/* ── Pagination ────────────────────────────────────────── */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-500">{start}–{end} of {total}</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="text-xs px-2.5 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-left" />
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const pg = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`text-xs w-8 h-7 rounded border transition-colors ${
                      pg === page
                        ? 'bg-navy-600 text-white border-navy-600'
                        : 'border-slate-200 text-slate-600 hover:bg-white'
                    }`}
                  >
                    {pg}
                  </button>
                );
              })}
              <button
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs px-2.5 py-1.5 rounded border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <i className="fas fa-chevron-right" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>

    <ConfirmDialog
      open={!!confirmUser}
      title="Delete user"
      message={confirmUser ? `Delete ${confirmUser.email}? This cannot be undone.` : ''}
      confirmLabel="Delete"
      onCancel={() => setConfirmUser(null)}
      onConfirm={() => { remove(confirmUser!); setConfirmUser(null); }}
    />
    </>
  );
}
