import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const STREAMS = ['General', 'Science', 'Commerce', 'Arts', 'Vocational'];
const STREAM_ICONS: Record<string, string> = {
  General: 'fa-book', Science: 'fa-flask', Commerce: 'fa-chart-line', Arts: 'fa-palette', Vocational: 'fa-tools',
};
const STREAM_COLORS: Record<string, string> = {
  General: '#0076BC', Science: '#34C759', Commerce: '#F59E0B', Arts: '#8B5CF6', Vocational: '#FF6B35',
};

// Common state-board subjects with stream mapping
const PRESET_SUBJECTS: { name: string; stream: string; grade?: number; maxMarks: number }[] = [
  // General (all grades)
  { name: 'Hindi', stream: 'General', maxMarks: 100 },
  { name: 'English', stream: 'General', maxMarks: 100 },
  { name: 'Mathematics', stream: 'General', maxMarks: 100 },
  { name: 'Social Science', stream: 'General', grade: 10, maxMarks: 100 },
  { name: 'Science', stream: 'General', grade: 10, maxMarks: 100 },
  { name: 'Sanskrit', stream: 'General', maxMarks: 100 },
  // Science stream (11-12)
  { name: 'Physics', stream: 'Science', grade: 11, maxMarks: 100 },
  { name: 'Chemistry', stream: 'Science', grade: 11, maxMarks: 100 },
  { name: 'Biology', stream: 'Science', grade: 11, maxMarks: 100 },
  { name: 'Mathematics', stream: 'Science', grade: 11, maxMarks: 100 },
  { name: 'Computer Science', stream: 'Science', grade: 11, maxMarks: 100 },
  // Commerce stream (11-12)
  { name: 'Accountancy', stream: 'Commerce', grade: 11, maxMarks: 100 },
  { name: 'Business Studies', stream: 'Commerce', grade: 11, maxMarks: 100 },
  { name: 'Economics', stream: 'Commerce', grade: 11, maxMarks: 100 },
  { name: 'Mathematics', stream: 'Commerce', grade: 11, maxMarks: 100 },
  // Arts stream (11-12)
  { name: 'History', stream: 'Arts', grade: 11, maxMarks: 100 },
  { name: 'Geography', stream: 'Arts', grade: 11, maxMarks: 100 },
  { name: 'Political Science', stream: 'Arts', grade: 11, maxMarks: 100 },
  { name: 'Economics', stream: 'Arts', grade: 11, maxMarks: 100 },
  { name: 'Sociology', stream: 'Arts', grade: 11, maxMarks: 100 },
];

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';

export function SubjectMaster() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const isPrincipal = user?.role === 'PRINCIPAL';
  const canWrite = isAdmin || isPrincipal;
  const isPlatformAdmin = isAdmin && !user?.tenantId;

  const [subjects, setSubjects] = useState<any[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeStream, setActiveStream] = useState('All');
  const [gradeFilter, setGradeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [editSubject, setEditSubject] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', code: '', grade: '', stream: 'General', maxMarks: '100', isElective: false });
  const [bulkStreams, setBulkStreams] = useState<string[]>(['General']);
  const [bulkTenant, setBulkTenant] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try { setSubjects(await api.schoolSubjects(selectedTenant || undefined)); }
    catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }, [selectedTenant]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (isPlatformAdmin) {
      api.tenants?.().then(t => { setTenants(t); if (t[0]) { setSelectedTenant(t[0].id); setBulkTenant(t[0].id); } }).catch(() => {});
    }
  }, [isPlatformAdmin]);

  const resetForm = () => {
    setForm({ name: '', code: '', grade: '', stream: 'General', maxMarks: '100', isElective: false });
    setEditSubject(null); setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    setSaving(true);
    try {
      const payload = { name: form.name, code: form.code || undefined, grade: form.grade ? Number(form.grade) : undefined, stream: form.stream, maxMarks: Number(form.maxMarks), isElective: form.isElective, tenantId: isPlatformAdmin ? selectedTenant : undefined };
      if (editSubject) { await api.updateSubject(editSubject.id, payload); setMsg('Subject updated.'); }
      else { await api.createSubject(payload); setMsg('Subject created.'); }
      resetForm(); load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleBulkSeed = async () => {
    setErr(''); setMsg(''); setSaving(true);
    try {
      const toSeed = PRESET_SUBJECTS.filter(s => bulkStreams.includes(s.stream));
      const result = await api.bulkCreateSubjects({ tenantId: bulkTenant || undefined, subjects: toSeed });
      setMsg(`Created ${result.created} subjects${result.skipped ? ` (${result.skipped} already existed)` : ''}.`);
      setShowBulk(false); load();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this subject from the catalog?')) return;
    try { await api.deleteSubject(id); load(); }
    catch (e: any) { setErr(e.message); }
  };

  const startEdit = (s: any) => {
    setEditSubject(s);
    setForm({ name: s.name, code: s.code ?? '', grade: s.grade ? String(s.grade) : '', stream: s.stream || 'General', maxMarks: String(s.maxMarks ?? 100), isElective: s.isElective ?? false });
    setShowForm(true); setShowBulk(false);
  };

  // Group by stream then grade
  const byStream = useMemo(() => {
    const streamsPresent = Array.from(new Set(subjects.map(s => s.stream || 'General'))).sort();
    const map: Record<string, any[]> = {};
    for (const s of subjects) {
      const key = s.stream || 'General';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return { streams: streamsPresent, map };
  }, [subjects]);

  const filtered = useMemo(() => {
    return subjects.filter(s => {
      const streamMatch = activeStream === 'All' || (s.stream || 'General') === activeStream;
      const gradeMatch = !gradeFilter || String(s.grade ?? '') === gradeFilter || (!s.grade && gradeFilter === '');
      return streamMatch && gradeMatch;
    });
  }, [subjects, activeStream, gradeFilter]);

  const allStreams = ['All', ...byStream.streams];
  const stateName = isPlatformAdmin
    ? (tenants.find(t => t.id === selectedTenant)?.name ?? 'State')
    : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2"><i className="fas fa-book-open" />Curriculum</div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">Subject Master</h1>
          <p className="text-sm text-slate-500 mt-1">
            State-wide subject catalog — same subjects apply to all schools · admins manage, schools view
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            {isAdmin && (
              <button onClick={() => { setShowBulk(s => !s); setShowForm(false); setMsg(''); setErr(''); }}
                className="btn-outline">
                <i className="fas fa-magic" />Seed Preset Subjects
              </button>
            )}
            <button onClick={() => { resetForm(); setShowForm(s => !s); setShowBulk(false); setMsg(''); setErr(''); }}
              className={showForm && !editSubject ? 'btn-outline' : 'btn-navy'}>
              {showForm && !editSubject ? <><i className="fas fa-times" />Cancel</> : <><i className="fas fa-plus" />Add Subject</>}
            </button>
          </div>
        )}
      </div>

      {/* State selector for platform admin */}
      {isPlatformAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">State:</span>
          {tenants.map(t => (
            <button key={t.id} onClick={() => setSelectedTenant(t.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all ${selectedTenant === t.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {msg && <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-check-circle" />{msg}</div>}
      {err && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm"><i className="fas fa-exclamation-circle" />{err}</div>}

      {/* ── Bulk Seed Wizard ── */}
      {showBulk && isAdmin && ( /* seed wizard is admin-only — principals use Add Subject */
        <div className="panel p-5 space-y-4 border-l-4 border-l-purple-500">
          <div>
            <h2 className="font-semibold text-slate-800"><i className="fas fa-magic text-purple-500 mr-2" />Seed Preset Subjects</h2>
            <p className="text-xs text-slate-500 mt-0.5">Adds standard Uttarakhand board subjects for selected streams. Already-existing subjects are skipped.</p>
          </div>

          {isPlatformAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">State *</label>
              <div className="flex flex-wrap gap-2">
                {tenants.map(t => (
                  <button key={t.id} type="button" onClick={() => setBulkTenant(t.id)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-all ${bulkTenant === t.id ? 'bg-navy-700 text-white border-navy-700' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">Streams to include *</label>
            <div className="flex flex-wrap gap-2">
              {STREAMS.map(s => (
                <button key={s} type="button"
                  onClick={() => setBulkStreams(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${bulkStreams.includes(s) ? 'text-white border-transparent' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}
                  style={bulkStreams.includes(s) ? { backgroundColor: STREAM_COLORS[s], borderColor: STREAM_COLORS[s] } : {}}>
                  <i className={`fas ${STREAM_ICONS[s]} text-xs`} />{s}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
              Will add {PRESET_SUBJECTS.filter(s => bulkStreams.includes(s.stream)).length} subjects
            </p>
            <div className="flex flex-wrap gap-1">
              {PRESET_SUBJECTS.filter(s => bulkStreams.includes(s.stream)).map((s, i) => (
                <span key={i} className="text-xs bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-600">
                  {s.name}{s.grade ? ` (Cl.${s.grade}+)` : ''}
                </span>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button onClick={handleBulkSeed} disabled={saving || bulkStreams.length === 0 || (isPlatformAdmin && !bulkTenant)} className="btn-primary disabled:opacity-50">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-magic" />}
              Seed {PRESET_SUBJECTS.filter(s => bulkStreams.includes(s.stream)).length} Subjects
            </button>
            <button onClick={() => setShowBulk(false)} className="btn-outline">Cancel</button>
          </div>
        </div>
      )}

      {/* ── Add / Edit Form ── */}
      {showForm && canWrite && (
        <form onSubmit={handleSubmit} className="panel p-5 space-y-4 border-l-4 border-l-sky-500">
          <h2 className="font-semibold text-slate-800">
            <i className={`fas ${editSubject ? 'fa-edit' : 'fa-plus-circle'} text-sky-500 mr-2`} />
            {editSubject ? `Edit — ${editSubject.name}` : 'New Subject'}
          </h2>
          {isPlatformAdmin && !editSubject && (
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1 uppercase tracking-wide">State *</label>
              <select className={inputCls + ' w-60'} value={selectedTenant} onChange={e => setSelectedTenant(e.target.value)}>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Subject Name *</label>
              <input required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Short Code</label>
              <input className={inputCls} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATH" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Stream *</label>
              <div className="flex flex-wrap gap-1.5">
                {STREAMS.map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, stream: s }))}
                    className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${form.stream === s ? 'text-white' : 'bg-white text-slate-500 border-slate-200'}`}
                    style={form.stream === s ? { backgroundColor: STREAM_COLORS[s], borderColor: STREAM_COLORS[s] } : {}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Grade (blank = all grades)</label>
              <select className={inputCls} value={form.grade} onChange={e => setForm({ ...form, grade: e.target.value })}>
                <option value="">All grades</option>
                {GRADES.map(g => <option key={g} value={g}>Class {g}+</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Max Marks</label>
              <input type="number" min="1" max="1000" className={inputCls} value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isElective} onChange={e => setForm({ ...form, isElective: e.target.checked })} className="rounded" />
            <span className="text-sm text-slate-700">Elective subject</span>
          </label>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
              {editSubject ? 'Save Changes' : 'Create Subject'}
            </button>
            <button type="button" onClick={resetForm} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      {/* ── Stream tabs + grade filter ── */}
      {subjects.length > 0 && (
        <div className="space-y-3">
          {/* Stream tabs */}
          <div className="flex flex-wrap gap-2">
            {allStreams.map(s => (
              <button key={s} onClick={() => setActiveStream(s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  activeStream === s
                    ? s === 'All' ? 'bg-slate-700 text-white border-slate-700' : 'text-white border-transparent'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
                style={activeStream === s && s !== 'All' ? { backgroundColor: STREAM_COLORS[s] ?? '#0076BC', borderColor: STREAM_COLORS[s] ?? '#0076BC' } : {}}>
                {s !== 'All' && <i className={`fas ${STREAM_ICONS[s] ?? 'fa-book'} text-xs`} />}
                {s}
                <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeStream === s ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>
                  {s === 'All' ? subjects.length : (byStream.map[s]?.length ?? 0)}
                </span>
              </button>
            ))}
          </div>
          {/* Grade filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Grade:</span>
            <button onClick={() => setGradeFilter('')} className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${!gradeFilter ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>All</button>
            {GRADES.filter(g => subjects.some(s => s.grade === g || !s.grade)).map(g => (
              <button key={g} onClick={() => setGradeFilter(gradeFilter === String(g) ? '' : String(g))}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${gradeFilter === String(g) ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'}`}>
                Cl.{g}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary stats ── */}
      {subjects.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {[
            { label: 'Total Subjects', value: subjects.length },
            ...STREAMS.filter(s => byStream.map[s]?.length).map(s => ({ label: s, value: byStream.map[s].length, color: STREAM_COLORS[s] })),
          ].map((item, i) => (
            <div key={i} className="panel px-4 py-2 flex items-center gap-2 border-l-4" style={{ borderLeftColor: (item as any).color ?? '#64748B' }}>
              <span className="text-lg font-bold text-slate-800">{item.value}</span>
              <span className="text-xs text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Subject cards ── */}
      {loading && <div className="py-12 text-center text-slate-400"><i className="fas fa-circle-notch fa-spin text-2xl" /></div>}

      {!loading && subjects.length === 0 && (
        <div className="py-14 text-center panel">
          <i className="fas fa-book-open text-3xl mb-3 block text-slate-200" />
          <p className="font-semibold text-slate-500">No subjects in catalog yet</p>
          {canWrite && (
            <div className="flex justify-center gap-2 mt-3">
              {isAdmin && (
                <button onClick={() => setShowBulk(true)} className="btn-primary text-sm">
                  <i className="fas fa-magic" />Seed Preset Subjects
                </button>
              )}
              <button onClick={() => setShowForm(true)} className="btn-outline text-sm">
                <i className="fas fa-plus" />Add Subject
              </button>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-6">
          {(activeStream === 'All' ? byStream.streams : [activeStream]).map(stream => {
            const streamSubjects = filtered.filter(s => (s.stream || 'General') === stream);
            if (streamSubjects.length === 0) return null;
            const color = STREAM_COLORS[stream] ?? '#64748B';
            const icon = STREAM_ICONS[stream] ?? 'fa-book';

            // Group by grade within stream
            const byGrade: Record<string, any[]> = {};
            for (const s of streamSubjects) {
              const key = s.grade ? `Class ${s.grade}+` : 'All Grades';
              if (!byGrade[key]) byGrade[key] = [];
              byGrade[key].push(s);
            }

            return (
              <div key={stream} className="panel overflow-hidden">
                {/* Stream header */}
                <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100" style={{ borderLeftColor: color, borderLeftWidth: 4 }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: color }}>
                    <i className={`fas ${icon}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{stream} Stream</h3>
                    <p className="text-xs text-slate-400">{streamSubjects.length} subject{streamSubjects.length !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                {/* By grade group */}
                {Object.entries(byGrade).map(([gradeLabel, subs]) => (
                  <div key={gradeLabel} className="border-b border-slate-50 last:border-0">
                    <div className="px-5 py-2 bg-slate-50/60">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{gradeLabel}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 p-4">
                      {subs.map(s => (
                        <div key={s.id} className="group relative border border-slate-200 rounded-xl p-3 hover:border-sky-200 hover:shadow-sm transition-all bg-white">
                          <div className="flex items-start gap-2 mb-2">
                            <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: color }}>
                              {s.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800 text-sm leading-tight">{s.name}</p>
                              {s.code && <p className="text-[10px] text-slate-400 font-mono">{s.code}</p>}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-500 rounded px-1.5 py-0.5">{s.maxMarks} marks</span>
                            {s.isElective && <span className="text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200 rounded px-1.5 py-0.5">Elective</span>}
                          </div>
                          {canWrite && (
                            <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
                              <button onClick={() => startEdit(s)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors">
                                <i className="fas fa-edit text-xs" />
                              </button>
                              <button onClick={() => handleDelete(s.id)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors">
                                <i className="fas fa-times text-xs" />
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!canWrite && subjects.length === 0 && !loading && (
        <div className="py-12 text-center panel text-slate-400">
          <i className="fas fa-book-open text-3xl mb-2 block text-slate-300" />
          <p className="text-sm">No subjects defined yet. Contact your administrator.</p>
        </div>
      )}
    </div>
  );
}
