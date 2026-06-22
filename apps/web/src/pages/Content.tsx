import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

// ── Constants ─────────────────────────────────────────────────────────────────

const STUDIOS = ['Studio1', 'Studio2', 'Studio3', 'Studio4'];
const GRADES  = [6, 7, 8, 9, 10, 11, 12];
const MEDIUMS = ['Hindi', 'English', 'Hindi & English'];

const KNOWN_SUBJECTS = [
  'Mathematics', 'Science', 'Physics', 'Chemistry', 'Biology',
  'English', 'Hindi', 'Social Science', 'Economics', 'Geography',
  'History', 'Political Science', 'Computer Science', 'Sanskrit',
  'Urdu', 'Music', 'Physical Education',
];

const STUDIO_COLORS: Record<string, string> = {
  Studio1: 'bg-red-100 text-red-700 border-red-200',
  Studio2: 'bg-blue-100 text-blue-700 border-blue-200',
  Studio3: 'bg-green-100 text-green-700 border-green-200',
  Studio4: 'bg-purple-100 text-purple-700 border-purple-200',
};

const SUBJECT_ICONS: Record<string, string> = {
  Mathematics: '📐', Science: '🔬', Physics: '⚡', Chemistry: '🧪',
  Biology: '🌿', English: '📖', Hindi: '🅗', 'Social Science': '🌍',
  Economics: '📊', Geography: '🗺️', History: '🏛️', 'Political Science': '⚖️',
  'Computer Science': '💻', Sanskrit: '📜',
};

const GRADE_COLORS = [
  'from-sky-500 to-blue-600', 'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600', 'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600', 'from-indigo-500 to-blue-700',
  'from-cyan-500 to-sky-600',
];

const EDITOR_ROLES = new Set(['ADMIN', 'PRINCIPAL', 'TEACHER']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

const ROMAN: Record<number, string> = { 6:'VI',7:'VII',8:'VIII',9:'IX',10:'X',11:'XI',12:'XII' };
function toDDMMYYYY(iso: string) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : String(iso).replace(/\D/g, '');
}
function cleanTime(t: string) { return String(t ?? '').replace(/\s*(am|pm)\s*$/i, '').replace(':', '.').trim(); }
function splitTopicPart(topic: string) {
  const m = String(topic ?? '').match(/^(.*?)[\s_-]*((?:part|भाग)\s*\d+)\s*$/i);
  return m ? { body: m[1].trim(), part: m[2].trim() } : { body: String(topic ?? '').trim(), part: '' };
}
function channelSearchUrl(channelUrl: string, query: string) {
  return `${channelUrl.split('?')[0]}/search?query=${encodeURIComponent(query)}`;
}
function descriptionQuery(lecture: any) {
  const date = toDDMMYYYY(lecture.date);
  const time = `${cleanTime(lecture.startTime)} To ${cleanTime(lecture.endTime)}`;
  const { body, part } = splitTopicPart(lecture.topic);
  const roman = ROMAN[lecture.standard] ?? String(lecture.standard);
  return [date, time, lecture.subject, body, lecture.teacherName, roman, part].filter(Boolean).join('_');
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ── LectureForm (shared between add + edit) ───────────────────────────────────

type LectureFormData = {
  topic: string; teacherName: string; subject: string; standard: number;
  studioName: string; date: string; startTime: string; endTime: string;
  medium: string; youtubeUrl: string;
};

function blankForm(defaults: Partial<LectureFormData> = {}): LectureFormData {
  return {
    topic: '', teacherName: '', subject: '', standard: 6,
    studioName: 'Studio1', date: todayStr(),
    startTime: '10:00 am', endTime: '10:40 am',
    medium: 'Hindi', youtubeUrl: '', ...defaults,
  };
}

function LectureForm({
  value, onChange, allSubjects, isNew,
}: {
  value: LectureFormData;
  onChange: (f: LectureFormData) => void;
  allSubjects: string[];
  isNew: boolean;
}) {
  const set = (k: keyof LectureFormData, v: string | number) =>
    onChange({ ...value, [k]: v });

  const inputCls = 'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white w-full focus:ring-2 focus:ring-sky-300 focus:border-sky-400 outline-none';
  const labelCls = 'block text-xs font-semibold text-slate-500 mb-1';
  const subjectList = Array.from(new Set([...KNOWN_SUBJECTS, ...allSubjects])).sort();

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      {/* Topic */}
      <div className="col-span-2">
        <label className={labelCls}>Title / Topic *</label>
        <input className={inputCls} value={value.topic} placeholder="e.g. Light Shadows And Reflections Part 01"
          onChange={e => set('topic', e.target.value)} />
      </div>

      {/* Teacher */}
      <div>
        <label className={labelCls}>Teacher Name *</label>
        <input className={inputCls} value={value.teacherName} placeholder="Mr. Yogesh Kemni"
          onChange={e => set('teacherName', e.target.value)} />
      </div>

      {/* Subject */}
      <div>
        <label className={labelCls}>Subject *</label>
        <select className={inputCls} value={value.subject} onChange={e => set('subject', e.target.value)}>
          <option value="">— Select subject —</option>
          {subjectList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Standard + Studio */}
      <div>
        <label className={labelCls}>Class (Standard) *</label>
        <select className={inputCls} value={value.standard} onChange={e => set('standard', Number(e.target.value))}>
          {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Studio *</label>
        <select className={inputCls} value={value.studioName} onChange={e => set('studioName', e.target.value)}>
          {STUDIOS.map(s => <option key={s} value={s}>{s} {s === 'Studio1' ? '(Class 6–7)' : s === 'Studio2' ? '(Class 8–9)' : s === 'Studio3' ? '(Class 10–11)' : '(Class 12)'}</option>)}
        </select>
      </div>

      {/* Date */}
      <div>
        <label className={labelCls}>Date *</label>
        <input type="date" className={inputCls} value={value.date} onChange={e => set('date', e.target.value)} />
      </div>

      {/* Medium */}
      <div>
        <label className={labelCls}>Medium</label>
        <select className={inputCls} value={value.medium} onChange={e => set('medium', e.target.value)}>
          {MEDIUMS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Time */}
      <div>
        <label className={labelCls}>Start Time *</label>
        <input className={inputCls} value={value.startTime} placeholder="10:00 am"
          onChange={e => set('startTime', e.target.value)} />
      </div>
      <div>
        <label className={labelCls}>End Time *</label>
        <input className={inputCls} value={value.endTime} placeholder="10:40 am"
          onChange={e => set('endTime', e.target.value)} />
      </div>

      {/* YouTube URL */}
      <div className="col-span-2">
        <label className={labelCls}>
          YouTube URL <span className="font-normal text-slate-400">(optional — paste a direct video link)</span>
        </label>
        <input className={inputCls} value={value.youtubeUrl} placeholder="https://www.youtube.com/watch?v=..."
          onChange={e => set('youtubeUrl', e.target.value)} />
      </div>
    </div>
  );
}

// ── AddContentModal ───────────────────────────────────────────────────────────

function AddContentModal({
  defaultStandard, defaultSubject, allSubjects, onClose, onSaved,
}: {
  defaultStandard: number; defaultSubject: string;
  allSubjects: string[]; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<LectureFormData>(blankForm({ standard: defaultStandard, subject: defaultSubject }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic.trim() || !form.teacherName.trim() || !form.subject) {
      setError('Title, teacher, and subject are required.'); return;
    }
    setSaving(true); setError('');
    try {
      await api.content.createLecture({
        ...form,
        youtubeUrl: form.youtubeUrl.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err: any) { setError(err.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <i className="fas fa-plus-circle text-sky-500" /> Add New Content
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          <LectureForm value={form} onChange={setForm} allSubjects={allSubjects} isNew />
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><i className="fas fa-exclamation-circle" />{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="flex-1 bg-sky-600 text-white py-2.5 rounded-xl font-semibold hover:bg-sky-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving…' : 'Add Content'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── LectureCard ───────────────────────────────────────────────────────────────

function LectureCard({
  lecture, channelMap, allSubjects, onUpdated, onDeleted,
}: {
  lecture: any; channelMap: Record<string, string>;
  allSubjects: string[]; onUpdated: (l: any) => void; onDeleted: (id: string) => void;
}) {
  const { user } = useAuth();
  const isEditor = EDITOR_ROLES.has(user?.role ?? '');
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRINCIPAL';

  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [form, setForm] = useState<LectureFormData>(blankForm({
    topic: lecture.topic, teacherName: lecture.teacherName, subject: lecture.subject,
    standard: lecture.standard, studioName: lecture.studioName, date: lecture.date,
    startTime: lecture.startTime, endTime: lecture.endTime,
    medium: lecture.medium ?? 'Hindi', youtubeUrl: lecture.youtubeUrl ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const channelUrl = channelMap[lecture.studioName];
  const searchUrl = channelUrl ? channelSearchUrl(channelUrl, descriptionQuery(lecture)) : '#';

  const handleSave = async () => {
    if (!form.topic.trim() || !form.teacherName.trim() || !form.subject) {
      setError('Title, teacher, and subject are required.'); return;
    }
    setSaving(true); setError('');
    try {
      const updated = await api.content.updateLecture(lecture.id, {
        ...form,
        youtubeUrl: form.youtubeUrl.trim() || null,
      });
      onUpdated(updated);
      setMode('view');
    } catch (err: any) { setError(err.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await api.content.deleteLecture(lecture.id); onDeleted(lecture.id); }
    catch { setDeleting(false); setConfirmDelete(false); }
  };

  if (mode === 'edit') {
    return (
      <div className="bg-white border border-sky-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <i className="fas fa-edit text-sky-500" /> Edit Content
          </h3>
          <button onClick={() => { setMode('view'); setError(''); }}
            className="text-slate-400 hover:text-slate-600 text-sm">
            <i className="fas fa-times" />
          </button>
        </div>
        <LectureForm value={form} onChange={setForm} allSubjects={allSubjects} isNew={false} />
        {error && <p className="text-xs text-red-500"><i className="fas fa-exclamation-circle mr-1" />{error}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-sky-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={() => { setMode('view'); setError(''); }}
            className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          {isAdmin && (
            <button onClick={() => setConfirmDelete(true)}
              className="px-3 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50">
              <i className="fas fa-trash" />
            </button>
          )}
        </div>
        {confirmDelete && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between gap-3">
            <p className="text-xs text-red-700 font-medium">Delete this lecture permanently?</p>
            <div className="flex gap-2">
              <button onClick={handleDelete} disabled={deleting}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleting ? '…' : 'Yes, Delete'}
              </button>
              <button onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-600 text-xs rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-shadow group">
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        <a href={lecture.youtubeUrl || searchUrl} target="_blank" rel="noopener noreferrer"
          className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white font-bold transition-opacity hover:opacity-90 ${lecture.youtubeUrl ? 'bg-red-500' : 'bg-slate-400'}`}
          title={lecture.youtubeUrl ? 'Watch video' : `Search on ${lecture.studioName} channel`}>
          <i className={`fas ${lecture.youtubeUrl ? 'fa-play' : 'fa-search'} text-lg`} />
          <span className="text-[9px] mt-0.5 opacity-80">{lecture.youtubeUrl ? 'Watch' : 'Search'}</span>
        </a>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 leading-snug" title={lecture.topic}>{lecture.topic}</div>
          <div className="text-sm text-slate-500 mt-0.5">{lecture.teacherName}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STUDIO_COLORS[lecture.studioName] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {lecture.studioName}
            </span>
            <span className="text-xs text-slate-400">{formatDate(lecture.date)}</span>
            <span className="text-xs text-slate-400">{lecture.startTime} – {lecture.endTime}</span>
            {lecture.medium && <span className="text-xs text-slate-300">{lecture.medium}</span>}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          <a href={lecture.youtubeUrl || searchUrl} target="_blank" rel="noopener noreferrer"
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${lecture.youtubeUrl ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            {lecture.youtubeUrl ? '▶ Play' : '🔍 Search'}
          </a>
          {isEditor && (
            <button onClick={() => setMode('edit')}
              className="text-[10px] text-slate-400 hover:text-sky-600 transition-colors flex items-center gap-1">
              <i className="fas fa-edit" /> Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── VideoTab ──────────────────────────────────────────────────────────────────

function VideoTab({ standard, subject }: { standard: number; subject: string }) {
  const { user } = useAuth();
  const isEditor = EDITOR_ROLES.has(user?.role ?? '');

  const [lectures, setLectures] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});
  const [allSubjects, setAllSubjects] = useState<string[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.content.channels().then(chs => {
      const map: Record<string, string> = {};
      for (const c of chs) map[c.studioName] = c.channelUrl;
      setChannelMap(map);
    }).catch(() => null);
    api.content.allSubjects().then(setAllSubjects).catch(() => setAllSubjects([]));
  }, []);

  const load = useCallback((p: number, s: string, d: string) => {
    setLoading(true);
    api.content.lectures(standard, subject, { search: s || undefined, date: d || undefined, page: p })
      .then(data => { setLectures(data.lectures); setTotal(data.total); setPages(data.pages); setLoading(false); })
      .catch(() => setLoading(false));
  }, [standard, subject]);

  useEffect(() => { load(1, '', ''); }, [load]);

  const handleSearch = (val: string) => {
    setSearch(val); setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val, dateFilter), 350);
  };
  const handleDate = (val: string) => { setDateFilter(val); setPage(1); load(1, search, val); };
  const goPage = (p: number) => { setPage(p); load(p, search, dateFilter); };

  const handleUpdated = (updated: any) => {
    setLectures(prev => prev.map(l => l.id === updated.id ? { ...l, ...updated } : l));
  };
  const handleDeleted = (id: string) => {
    setLectures(prev => prev.filter(l => l.id !== id));
    setTotal(t => t - 1);
  };

  return (
    <div className="space-y-4">
      {showAdd && (
        <AddContentModal
          defaultStandard={standard}
          defaultSubject={subject}
          allSubjects={allSubjects}
          onClose={() => setShowAdd(false)}
          onSaved={() => load(1, search, dateFilter)}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input value={search} onChange={e => handleSearch(e.target.value)}
            placeholder="Search topic or teacher…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
        </div>
        <input type="date" value={dateFilter} onChange={e => handleDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none" />
        {(search || dateFilter) && (
          <button onClick={() => { setSearch(''); setDateFilter(''); setPage(1); load(1, '', ''); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-red-600 border border-slate-200 rounded-xl hover:border-red-200 transition-colors">
            <i className="fas fa-times mr-1" />Clear
          </button>
        )}
        {isEditor && (
          <button onClick={() => setShowAdd(true)}
            className="ml-auto flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-700 transition-colors shadow-sm">
            <i className="fas fa-plus" /> Add Content
          </button>
        )}
      </div>

      <div className="text-xs text-slate-400">{total.toLocaleString()} lectures found</div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading lectures…</div>
      ) : lectures.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="text-4xl">📭</div>
          <p className="text-slate-400">No lectures match your search.</p>
          {isEditor && (
            <button onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sky-700">
              <i className="fas fa-plus" /> Add the first content
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {lectures.map(l => (
              <LectureCard
                key={l.id}
                lecture={l}
                channelMap={channelMap}
                allSubjects={allSubjects}
                onUpdated={handleUpdated}
                onDeleted={handleDeleted}
              />
            ))}
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => goPage(page - 1)} disabled={page === 1}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 disabled:opacity-40">
                ‹ Prev
              </button>
              <span className="text-sm text-slate-500">Page {page} of {pages}</span>
              <button onClick={() => goPage(page + 1)} disabled={page === pages}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 disabled:opacity-40">
                Next ›
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Grade/Subject grids (unchanged layout) ────────────────────────────────────

function GradeGrid({ onSelect }: { onSelect: (g: number) => void }) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">Virtual Classroom Content</h2>
        <p className="text-slate-500 mt-1">Select a class to browse recorded lectures, e-books, and assessments</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {GRADES.map((g, i) => (
          <button key={g} onClick={() => onSelect(g)}
            className={`bg-gradient-to-br ${GRADE_COLORS[i % GRADE_COLORS.length]} text-white rounded-2xl p-6 text-left shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 group`}>
            <div className="text-4xl font-black opacity-20 leading-none">{g}</div>
            <div className="mt-2">
              <div className="text-xl font-bold">Class {g}</div>
              <div className="text-white/70 text-sm mt-0.5">
                {g <= 8 ? 'Middle School' : g <= 10 ? 'High School' : 'Senior Secondary'}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white/90 transition-colors">
              <i className="fas fa-play-circle" /><span>View content →</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SubjectGrid({ standard, onSelect, onBack }: { standard: number; onSelect: (s: string) => void; onBack: () => void }) {
  const [data, setData] = useState<{ subject: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.content.subjects(standard).then(d => { setData(d.subjects); setLoading(false); }).catch(() => setLoading(false));
  }, [standard]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <i className="fas fa-arrow-left" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Class {standard} — Select Subject</h2>
          <p className="text-slate-500 text-sm">{data.reduce((a, s) => a + s.count, 0).toLocaleString()} lectures available</p>
        </div>
      </div>
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading subjects…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.filter(s => !['Event', 'Guest Lecture'].includes(s.subject)).map(({ subject, count }) => (
            <button key={subject} onClick={() => onSelect(subject)}
              className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-sky-300 hover:shadow-md transition-all group">
              <div className="text-3xl mb-2">{SUBJECT_ICONS[subject] ?? '📚'}</div>
              <div className="font-semibold text-slate-800 group-hover:text-sky-700 transition-colors">{subject}</div>
              <div className="text-xs text-slate-400 mt-1">{count.toLocaleString()} lectures</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ComingSoon({ label, icon }: { label: string; icon: string }) {
  return (
    <div className="text-center py-20 space-y-3">
      <div className="text-5xl">{icon}</div>
      <h3 className="text-lg font-semibold text-slate-700">{label}</h3>
      <p className="text-slate-400 text-sm">This section is coming soon.</p>
    </div>
  );
}

type ContentTab = 'video' | 'ebook' | 'assessment';

function SubjectContent({ standard, subject, onBack }: { standard: number; subject: string; onBack: () => void }) {
  const [tab, setTab] = useState<ContentTab>('video');
  const tabs: { key: ContentTab; label: string; icon: string }[] = [
    { key: 'video', label: 'Virtual Class Recorded', icon: '📹' },
    { key: 'ebook', label: 'E-Book', icon: '📚' },
    { key: 'assessment', label: 'Assessment', icon: '📝' },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors">
          <i className="fas fa-arrow-left" />
        </button>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{SUBJECT_ICONS[subject] ?? '📚'}</span>
            <h2 className="text-xl font-bold text-slate-800">{subject}</h2>
          </div>
          <p className="text-slate-500 text-sm">Class {standard}</p>
        </div>
      </div>
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key ? 'border-sky-500 text-sky-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
      {tab === 'video' && <VideoTab standard={standard} subject={subject} />}
      {tab === 'ebook' && <ComingSoon label="E-Books" icon="📚" />}
      {tab === 'assessment' && <ComingSoon label="Assessments & Quizzes" icon="📝" />}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Step = { view: 'grades' } | { view: 'subjects'; standard: number } | { view: 'content'; standard: number; subject: string };

export function Content() {
  const [step, setStep] = useState<Step>({ view: 'grades' });
  return (
    <div>
      {step.view === 'grades' && (
        <GradeGrid onSelect={standard => setStep({ view: 'subjects', standard })} />
      )}
      {step.view === 'subjects' && (
        <SubjectGrid
          standard={step.standard}
          onSelect={subject => setStep({ view: 'content', standard: step.standard, subject })}
          onBack={() => setStep({ view: 'grades' })}
        />
      )}
      {step.view === 'content' && (
        <SubjectContent
          standard={step.standard}
          subject={step.subject}
          onBack={() => setStep({ view: 'subjects', standard: step.standard })}
        />
      )}
    </div>
  );
}
