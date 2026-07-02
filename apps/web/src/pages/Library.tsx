import { useCallback, useEffect, useState } from 'react';
import { api, type SchoolRow } from '../api';
import { useAuth } from '../auth';

const GRADES = [6, 7, 8, 9, 10, 11, 12];
const SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography', 'Economics', 'Political Science', 'Computer Science', 'General'];
const today = new Date().toISOString().slice(0, 10);

const inputCls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors';
const btnPrimary = 'flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-medium hover:bg-sky-700 transition-colors';

const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL'];

const RES_STATUS_COLOR: Record<string, string> = {
  ISSUED:   'bg-amber-100 text-amber-700',
  RETURNED: 'bg-emerald-100 text-emerald-700',
  OVERDUE:  'bg-rose-100 text-rose-700',
  LOST:     'bg-rose-200 text-rose-800',
};
const FINE_COLOR: Record<string, string> = {
  PENDING: 'bg-rose-100 text-rose-700',
  PAID:    'bg-emerald-100 text-emerald-700',
};

const TABS = [
  { id: 'books',        label: 'Books',          icon: 'fa-book' },
  { id: 'reservations', label: 'Issued Books',    icon: 'fa-hand-holding-heart' },
  { id: 'lost',         label: 'Lost Books',      icon: 'fa-exclamation-triangle' },
  { id: 'digital',      label: 'Digital Library', icon: 'fa-laptop-code' },
] as const;

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Issue Book modal ──────────────────────────────────────────────────────────
function IssueModal({ book, schoolId, onSave, onClose }: { book: any; schoolId?: string; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ studentName: '', issueDate: today, dueDate: today });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.library.reservations.issue({ bookId: book.id, schoolId, ...form });
      onSave(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Issue: {book.title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-lg" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-rose-600 text-sm">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student Name *</label>
            <input required type="text" className={inputCls} value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} placeholder="Student name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Issue Date</label>
              <input type="date" className={inputCls} value={form.issueDate} onChange={e => setForm(f => ({ ...f, issueDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Due Date</label>
              <input required type="date" className={inputCls} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-hand-holding-heart" />}
              Issue
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Lost Book record modal ────────────────────────────────────────────────────
function LostModal({ books, schoolId, onSave, onClose }: { books: any[]; schoolId?: string; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState({ bookId: '', studentName: '', reportedDate: today, fineAmount: 0 });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.library.lost.record({ schoolId, ...form });
      onSave(); onClose();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-bold text-slate-800">Record Lost Book</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><i className="fas fa-times text-lg" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {err && <p className="text-rose-600 text-sm">{err}</p>}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Book *</label>
            <select required className={inputCls} value={form.bookId} onChange={e => setForm(f => ({ ...f, bookId: e.target.value }))}>
              <option value="">Select book…</option>
              {books.map((b: any) => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Student Name *</label>
            <input required type="text" className={inputCls} value={form.studentName} onChange={e => setForm(f => ({ ...f, studentName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Reported Date</label>
              <input type="date" className={inputCls} value={form.reportedDate} onChange={e => setForm(f => ({ ...f, reportedDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Fine Amount (₹)</label>
              <input type="number" min={0} className={inputCls} value={form.fineAmount} onChange={e => setForm(f => ({ ...f, fineAmount: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className={btnPrimary}>
              {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-exclamation-triangle" />}
              Record
            </button>
            <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Book form ─────────────────────────────────────────────────────────────
const emptyBook = { title: '', author: '', isbn: '', publisher: '', edition: '', subject: '', grade: '' as string | number, totalCopies: 1 };

function AddBookForm({ schoolId, onSave, onCancel }: { schoolId?: string; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(emptyBook);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.library.books.create({ schoolId, ...form, grade: form.grade ? Number(form.grade) : undefined });
      onSave();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-sky-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-700">Add New Book</h3>
      {err && <p className="text-rose-600 text-sm">{err}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
          <input required type="text" className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Book title" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Author</label>
          <input type="text" className={inputCls} value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">ISBN</label>
          <input type="text" className={inputCls} value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Publisher</label>
          <input type="text" className={inputCls} value={form.publisher} onChange={e => setForm(f => ({ ...f, publisher: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Edition</label>
          <input type="text" className={inputCls} value={form.edition} onChange={e => setForm(f => ({ ...f, edition: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
          <select className={inputCls} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
            <option value="">Any / General</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Grade</label>
          <select className={inputCls} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
            <option value="">Any Grade</option>
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Total Copies</label>
          <input type="number" min={1} className={inputCls} value={form.totalCopies} onChange={e => setForm(f => ({ ...f, totalCopies: Number(e.target.value) }))} />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
          Add Book
        </button>
        <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// ── Add Digital Resource form ─────────────────────────────────────────────────
const emptyDigital = { title: '', type: 'EBOOK' as 'EBOOK' | 'LINK' | 'RECOMMENDATION', subject: '', grade: '' as string | number, gradeTo: '' as string | number, externalUrl: '', description: '' };

function AddDigitalForm({ schoolId, onSave, onCancel }: { schoolId?: string; onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState(emptyDigital);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.library.digital.add({
        schoolId,
        ...form,
        grade: form.grade ? Number(form.grade) : undefined,
        gradeTo: form.gradeTo ? Number(form.gradeTo) : undefined,
      });
      onSave();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-sky-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-slate-700">Add Digital Resource</h3>
      {err && <p className="text-rose-600 text-sm">{err}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
          <input required type="text" className={inputCls} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
          <div className="flex gap-1">
            {(['EBOOK', 'LINK', 'RECOMMENDATION'] as const).map(t => (
              <button key={t} type="button"
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${form.type === t ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setForm(f => ({ ...f, type: t }))}
              >
                {t === 'EBOOK' ? 'E-Book' : t === 'LINK' ? 'External Link' : 'Recommendation'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Subject</label>
          <select className={inputCls} value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}>
            <option value="">Any / General</option>
            {SUBJECTS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Grade (From)</label>
          <select className={inputCls} value={form.grade} onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}>
            <option value="">Any Grade</option>
            {GRADES.map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Grade (To)</label>
          <select className={inputCls} value={form.gradeTo} onChange={e => setForm(f => ({ ...f, gradeTo: e.target.value }))}>
            <option value="">Same as From</option>
            {GRADES.filter(g => !form.grade || g >= Number(form.grade)).map(g => <option key={g} value={g}>Class {g}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {form.type === 'EBOOK' ? 'File URL (S3) or External URL' : 'URL *'}
          </label>
          <input
            required={form.type !== 'EBOOK'}
            type="url"
            className={inputCls}
            value={form.externalUrl}
            onChange={e => setForm(f => ({ ...f, externalUrl: e.target.value }))}
            placeholder={form.type === 'EBOOK' ? 'https://…' : 'https://…'}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
          <textarea rows={2} className={inputCls} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-plus" />}
          Add Resource
        </button>
        <button type="button" className="px-4 py-2 rounded-lg text-sm text-slate-600 border border-slate-200 hover:bg-slate-50" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

const SCOPE_CARDS = [
  { value: 'school',   label: 'School',    icon: 'fa-school', desc: 'This school only' },
  { value: 'block',    label: 'Block',     icon: 'fa-city',   desc: 'Pick school in block' },
  { value: 'district', label: 'District',  icon: 'fa-map',    desc: 'Pick school in district' },
  { value: 'all',      label: 'State-wide',icon: 'fa-globe',  desc: 'Any school in state' },
] as const;

type ScopeMode = 'school' | 'block' | 'district' | 'all';

// ── Main page ─────────────────────────────────────────────────────────────────
export function Library() {
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? '');
  const isSchoolBound = !!user?.schoolId;
  const role = user?.role ?? '';

  // Scope card options based on role
  const availableScopes = (() => {
    if (['ADMIN', 'STATE_OFFICIAL'].includes(role)) return SCOPE_CARDS;
    if (role === 'DISTRICT_OFFICIAL') return SCOPE_CARDS.slice(0, 3);
    if (role === 'BLOCK_OFFICIAL')    return SCOPE_CARDS.slice(0, 2);
    return SCOPE_CARDS.slice(0, 1);
  })();

  const [scopeMode, setScopeMode] = useState<ScopeMode>(availableScopes[0].value);
  const [selDistrict, setSelDistrict] = useState(user?.districtId ?? '');
  const [selBlock, setSelBlock]       = useState(user?.blockId ?? '');
  const [selSchool, setSelSchool]     = useState('');

  const [districts, setDistricts] = useState<any[]>([]);
  const [blocks, setBlocks]       = useState<any[]>([]);
  const [schools, setSchools]     = useState<SchoolRow[]>([]);

  // Load districts for non-school-bound users
  useEffect(() => {
    if (!isSchoolBound) {
      api.districts().then(setDistricts).catch(() => setDistricts([]));
    }
  }, [isSchoolBound]);

  // Load blocks when district changes
  useEffect(() => {
    if (selDistrict) api.blocks(selDistrict).then(setBlocks).catch(() => setBlocks([]));
    else { setBlocks([]); setSelBlock(''); }
  }, [selDistrict]);

  // Load schools when district/block changes
  useEffect(() => {
    if (!isSchoolBound && selDistrict) {
      api.schools({ districtId: selDistrict, blockId: selBlock || undefined })
        .then(setSchools).catch(() => setSchools([]));
    } else {
      setSchools([]);
    }
    setSelSchool('');
  }, [selDistrict, selBlock, isSchoolBound]);

  // Reset sub-selections when scope mode changes
  const handleScopeMode = (m: ScopeMode) => {
    setScopeMode(m);
    if (!user?.districtId) setSelDistrict('');
    if (!user?.blockId) setSelBlock('');
    setSelSchool('');
  };

  const schoolId: string | undefined = isSchoolBound
    ? (user?.schoolId ?? undefined)
    : selSchool || undefined;

  const [tab, setTab] = useState<'books' | 'reservations' | 'lost' | 'digital'>('books');
  const [books, setBooks] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [lostRecords, setLostRecords] = useState<any[]>([]);
  const [digital, setDigital] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [digitalType, setDigitalType] = useState('');
  const [showBookForm, setShowBookForm] = useState(false);
  const [showDigitalForm, setShowDigitalForm] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [issueTarget, setIssueTarget] = useState<any | null>(null);

  const loadBooks = useCallback(() => {
    setLoading(true);
    api.library.books.list({ schoolId, q: searchQ || undefined })
      .then(setBooks).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  }, [schoolId, searchQ]);

  const loadReservations = useCallback(() => {
    setLoading(true);
    api.library.reservations.list({ schoolId, status: filterStatus || undefined })
      .then(setReservations).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  }, [schoolId, filterStatus]);

  const loadLost = useCallback(() => {
    setLoading(true);
    api.library.lost.list({ schoolId })
      .then(setLostRecords).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  }, [schoolId]);

  const loadDigital = useCallback(() => {
    setLoading(true);
    api.library.digital.list({ schoolId, type: digitalType || undefined })
      .then(setDigital).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  }, [schoolId, digitalType]);

  useEffect(() => {
    if (tab === 'books') loadBooks();
    else if (tab === 'reservations') loadReservations();
    else if (tab === 'lost') { loadBooks(); loadLost(); }
    else if (tab === 'digital') loadDigital();
  }, [tab, loadBooks, loadReservations, loadLost, loadDigital]);

  async function handleReturn(id: string) {
    try { await api.library.reservations.returnBook(id); loadReservations(); }
    catch (e: any) { setErr(e.message); }
  }

  async function handleMarkPaid(id: string) {
    try { await api.library.lost.markPaid(id); loadLost(); }
    catch (e: any) { setErr(e.message); }
  }

  async function handleDeleteBook(id: string) {
    if (!confirm('Delete this book?')) return;
    try { await api.library.books.remove(id); loadBooks(); }
    catch (e: any) { setErr(e.message); }
  }

  async function handleDeleteDigital(id: string) {
    if (!confirm('Remove this resource?')) return;
    try { await api.library.digital.remove(id); loadDigital(); }
    catch (e: any) { setErr(e.message); }
  }

  const TYPE_ICON: Record<string, string> = { EBOOK: 'fa-file-pdf', LINK: 'fa-external-link-alt', RECOMMENDATION: 'fa-star' };
  const TYPE_COLOR: Record<string, string> = { EBOOK: 'bg-sky-100 text-sky-700', LINK: 'bg-violet-100 text-violet-700', RECOMMENDATION: 'bg-amber-100 text-amber-700' };

  const selCls = 'w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-100';

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <i className="fas fa-book text-sky-500" />
          Library Management
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Books, reservations, lost records and digital resources</p>
      </div>

      {/* Scope selector — hidden for school-bound users */}
      {!isSchoolBound && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Select School Scope</p>
            <div className={`grid gap-2 ${availableScopes.length <= 2 ? 'grid-cols-2' : availableScopes.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
              {availableScopes.map(s => {
                const sel = scopeMode === s.value;
                return (
                  <button key={s.value} type="button" onClick={() => handleScopeMode(s.value)}
                    className={`flex flex-col items-center gap-1.5 p-3.5 rounded-xl border-2 text-center transition-all ${
                      sel ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${sel ? 'bg-sky-600' : 'bg-slate-100'}`}>
                      <i className={`fas ${s.icon} text-sm ${sel ? 'text-white' : 'text-slate-400'}`} />
                    </div>
                    <span className={`text-xs font-bold ${sel ? 'text-sky-700' : 'text-slate-600'}`}>{s.label}</span>
                    <span className="text-[10px] text-slate-400 leading-tight">{s.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cascade selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* District */}
            {!user?.districtId && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">District *</label>
                <select className={selCls} value={selDistrict} onChange={e => { setSelDistrict(e.target.value); setSelBlock(''); setSelSchool(''); }}>
                  <option value="">Select district…</option>
                  {districts.map((d: any) => <option key={d.districtId} value={d.districtId}>{d.district}</option>)}
                </select>
              </div>
            )}
            {/* Block — shown for block/school scope */}
            {(scopeMode === 'block' || scopeMode === 'school') && !user?.blockId && (
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Block</label>
                <select className={selCls} value={selBlock} disabled={!selDistrict && !user?.districtId}
                  onChange={e => { setSelBlock(e.target.value); setSelSchool(''); }}>
                  <option value="">All blocks</option>
                  {blocks.map((b: any) => <option key={b.blockId} value={b.blockId}>{b.block}</option>)}
                </select>
              </div>
            )}
            {/* School picker — always shown for non-school-bound */}
            <div>
              <label className="block text-xs text-slate-500 mb-1.5">School *</label>
              <select className={selCls} value={selSchool} disabled={!selDistrict && !user?.districtId}
                onChange={e => setSelSchool(e.target.value)}>
                <option value="">Select school…</option>
                {schools.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Gate: must have a school selected */}
      {!schoolId ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          <i className="fas fa-book text-4xl mb-3 block text-slate-200" />
          Select a school above to view and manage its library
        </div>
      ) : (
      <>

      {/* Tab strip */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t.id ? 'bg-white text-sky-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            onClick={() => setTab(t.id)}
          >
            <i className={`fas ${t.icon}`} />
            {t.label}
          </button>
        ))}
      </div>

      {err && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <i className="fas fa-exclamation-circle" /> {err}
          <button className="ml-auto text-rose-400 hover:text-rose-600" onClick={() => setErr('')}><i className="fas fa-times" /></button>
        </div>
      )}

      {/* ── Books tab ──────────────────────────────────────────────────────── */}
      {tab === 'books' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <input
              type="text" className={inputCls + ' max-w-xs'}
              placeholder="Search title / author / ISBN…"
              value={searchQ} onChange={e => setSearchQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && loadBooks()}
            />
            <div className="flex gap-2">
              <button className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50" onClick={loadBooks}>
                <i className="fas fa-search" />
              </button>
              {canWrite && (
                <button className={btnPrimary} onClick={() => setShowBookForm(v => !v)}>
                  <i className={`fas fa-${showBookForm ? 'times' : 'plus'}`} />
                  {showBookForm ? 'Cancel' : 'Add Book'}
                </button>
              )}
            </div>
          </div>

          {showBookForm && (
            <AddBookForm schoolId={schoolId} onSave={() => { setShowBookForm(false); loadBooks(); }} onCancel={() => setShowBookForm(false)} />
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
          ) : books.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm"><i className="fas fa-book text-3xl mb-3 block" />No books in the library.</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Title</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Author</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Subject</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Copies</th>
                    {canWrite && <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {books.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{b.title}</p>
                        {b.isbn && <p className="text-xs text-slate-400">ISBN: {b.isbn}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{b.author ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{b.subject ?? '—'}{b.grade ? ` · Class ${b.grade}` : ''}</td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${b.availableCopies === 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {b.availableCopies}
                        </span>
                        <span className="text-slate-400"> / {b.totalCopies}</span>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            <button
                              className="px-2 py-1 text-xs bg-sky-50 text-sky-600 border border-sky-200 rounded hover:bg-sky-100"
                              onClick={() => setIssueTarget(b)}
                              disabled={b.availableCopies === 0}
                            >
                              Issue
                            </button>
                            <button
                              className="px-2 py-1 text-xs bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100"
                              onClick={() => handleDeleteBook(b.id)}
                            >
                              <i className="fas fa-trash" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Reservations tab ───────────────────────────────────────────────── */}
      {tab === 'reservations' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {['', 'ISSUED', 'RETURNED', 'OVERDUE'].map(s => (
              <button key={s}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${filterStatus === s ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                onClick={() => setFilterStatus(s)}
              >
                {s === '' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
          ) : reservations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm"><i className="fas fa-hand-holding-heart text-3xl mb-3 block" />No book reservations found.</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Book</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Issue Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Due Date</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    {canWrite && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reservations.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.book?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.studentName}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(r.issueDate)}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(r.dueDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RES_STATUS_COLOR[r.status] ?? ''}`}>
                          {r.status}
                        </span>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          {r.status === 'ISSUED' && (
                            <button
                              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100"
                              onClick={() => handleReturn(r.id)}
                            >
                              Return
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Lost Books tab ─────────────────────────────────────────────────── */}
      {tab === 'lost' && (
        <div className="space-y-4">
          {canWrite && (
            <div className="flex justify-end">
              <button className={btnPrimary} onClick={() => setShowLostModal(true)}>
                <i className="fas fa-plus" />
                Record Lost Book
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
          ) : lostRecords.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm"><i className="fas fa-exclamation-triangle text-3xl mb-3 block" />No lost book records.</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Book</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Student</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Reported</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Fine</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    {canWrite && <th className="px-4 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lostRecords.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.book?.title ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{r.studentName}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDate(r.reportedDate)}</td>
                      <td className="px-4 py-3 font-medium text-slate-700">₹{r.fineAmount}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FINE_COLOR[r.fineStatus] ?? ''}`}>
                          {r.fineStatus}
                        </span>
                      </td>
                      {canWrite && (
                        <td className="px-4 py-3 text-right">
                          {r.fineStatus === 'PENDING' && (
                            <button
                              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-600 border border-emerald-200 rounded hover:bg-emerald-100"
                              onClick={() => handleMarkPaid(r.id)}
                            >
                              Mark Paid
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Digital Library tab ────────────────────────────────────────────── */}
      {tab === 'digital' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center justify-between">
            <div className="flex gap-1">
              {['', 'EBOOK', 'LINK', 'RECOMMENDATION'].map(t => (
                <button key={t}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${digitalType === t ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => setDigitalType(t)}
                >
                  {t === '' ? 'All' : t === 'EBOOK' ? 'E-Books' : t === 'LINK' ? 'Links' : 'Recommendations'}
                </button>
              ))}
            </div>
            {canWrite && (
              <button className={btnPrimary} onClick={() => setShowDigitalForm(v => !v)}>
                <i className={`fas fa-${showDigitalForm ? 'times' : 'plus'}`} />
                {showDigitalForm ? 'Cancel' : 'Add Resource'}
              </button>
            )}
          </div>

          {showDigitalForm && (
            <AddDigitalForm schoolId={schoolId} onSave={() => { setShowDigitalForm(false); loadDigital(); }} onCancel={() => setShowDigitalForm(false)} />
          )}

          {loading ? (
            <div className="text-center py-12 text-slate-400"><i className="fas fa-spinner fa-spin text-2xl" /></div>
          ) : digital.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm"><i className="fas fa-laptop-code text-3xl mb-3 block" />No digital resources found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {digital.map((r: any) => (
                <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm leading-tight">{r.title}</p>
                      {r.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{r.description}</p>}
                    </div>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${TYPE_COLOR[r.type] ?? ''}`}>
                      <i className={`fas ${TYPE_ICON[r.type] ?? 'fa-file'} mr-1`} />
                      {r.type === 'EBOOK' ? 'E-Book' : r.type === 'LINK' ? 'Link' : 'Rec.'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-400">
                    {r.subject && <span>{r.subject}</span>}
                    {r.grade && <span>· Class {r.grade}{r.gradeTo && r.gradeTo !== r.grade ? `–${r.gradeTo}` : ''}</span>}
                    <span>· {r.addedByName}</span>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <a
                      href={r.fileUrl ?? r.externalUrl ?? '#'}
                      target="_blank" rel="noreferrer"
                      className="text-xs text-sky-600 hover:underline inline-flex items-center gap-1"
                    >
                      <i className="fas fa-external-link-alt" />
                      {r.type === 'EBOOK' ? 'Open / Download' : 'Visit Link'}
                    </a>
                    {canWrite && (
                      <button className="text-xs text-rose-400 hover:text-rose-600" onClick={() => handleDeleteDigital(r.id)}>
                        <i className="fas fa-trash" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {issueTarget && (
        <IssueModal
          book={issueTarget}
          schoolId={schoolId}
          onSave={loadBooks}
          onClose={() => setIssueTarget(null)}
        />
      )}
      {showLostModal && (
        <LostModal
          books={books}
          schoolId={schoolId}
          onSave={loadLost}
          onClose={() => setShowLostModal(false)}
        />
      )}
      </>
      )}
    </div>
  );
}
