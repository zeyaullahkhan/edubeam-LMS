import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth';

// ── Helpers ─────────────────────────────────────────────────────────────────

const STUDIO_COLORS: Record<string, string> = {
  Studio1: 'bg-red-100 text-red-700 border-red-200',
  Studio2: 'bg-blue-100 text-blue-700 border-blue-200',
  Studio3: 'bg-green-100 text-green-700 border-green-200',
  Studio4: 'bg-purple-100 text-purple-700 border-purple-200',
};

const SUBJECT_ICONS: Record<string, string> = {
  Mathematics: '📐',
  Science: '🔬',
  Physics: '⚡',
  Chemistry: '🧪',
  Biology: '🌿',
  English: '📖',
  Hindi: '🅗',
  'Social Science': '🌍',
  Economics: '📊',
  Geography: '🗺️',
  History: '🏛️',
  'Political Science': '⚖️',
};

const GRADE_COLORS = [
  'from-sky-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-700',
  'from-cyan-500 to-sky-600',
];

function channelSearchUrl(channelUrl: string, query: string): string {
  const handle = channelUrl.split('?')[0]; // strip ?si= param
  return `${handle}/search?query=${encodeURIComponent(query)}`;
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return d; }
}

// ── YouTube description-format mapping ────────────────────────────────────────
// Studio channels label every video description with a fixed pattern, e.g.
//   "13062026_10.00 To 10.40_Science_Physics Experiments_Mr. Yogesh Kemni_VI_Part 02"
// We reconstruct that exact string from the lecture's fields so an in-channel
// search lands on the precise video (YouTube indexes the description text).

const ROMAN: Record<number, string> = {
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI', 12: 'XII',
};

/** "2026-06-13" → "13062026" (DDMMYYYY, as used in the video descriptions). */
function toDDMMYYYY(iso: string): string {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}${m[2]}${m[1]}` : String(iso).replace(/\D/g, '');
}

/** "10:00 am" → "10.00" (drop am/pm marker, colon → dot, matching the format). */
function cleanTime(t: string): string {
  return String(t ?? '').replace(/\s*(am|pm)\s*$/i, '').replace(':', '.').trim();
}

/** Split "Physics Experiments Part 02" → { body: "Physics Experiments", part: "Part 02" }. */
function splitTopicPart(topic: string): { body: string; part: string } {
  const m = String(topic ?? '').match(/^(.*?)[\s_-]*((?:part|भाग)\s*\d+)\s*$/i);
  return m ? { body: m[1].trim(), part: m[2].trim() } : { body: String(topic ?? '').trim(), part: '' };
}

/**
 * Build the studio's video-description string for a lecture so it can be used as
 * the YouTube in-channel search query. Mirrors the manual labelling format:
 *   {DDMMYYYY}_{H.MM To H.MM}_{Subject}_{TopicBody}_{Teacher}_{RomanClass}_{Part NN}
 */
function descriptionQuery(lecture: any): string {
  const date = toDDMMYYYY(lecture.date);
  const time = `${cleanTime(lecture.startTime)} To ${cleanTime(lecture.endTime)}`;
  const { body, part } = splitTopicPart(lecture.topic);
  const roman = ROMAN[lecture.standard] ?? String(lecture.standard);
  return [date, time, lecture.subject, body, lecture.teacherName, roman, part]
    .filter(Boolean)
    .join('_');
}

// ── Sub-components ───────────────────────────────────────────────────────────

type ContentTab = 'video' | 'ebook' | 'assessment';

function GradeGrid({ onSelect }: { onSelect: (g: number) => void }) {
  const grades = [6, 7, 8, 9, 10, 11, 12];
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">Virtual Classroom Content</h2>
        <p className="text-slate-500 mt-1">Select a class to browse recorded lectures, e-books, and assessments</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {grades.map((g, i) => (
          <button
            key={g}
            onClick={() => onSelect(g)}
            className={`bg-gradient-to-br ${GRADE_COLORS[i % GRADE_COLORS.length]} text-white rounded-2xl p-6 text-left shadow-md hover:shadow-xl hover:scale-105 transition-all duration-200 group`}
          >
            <div className="text-4xl font-black opacity-20 leading-none">{g}</div>
            <div className="mt-2">
              <div className="text-xl font-bold">Class {g}</div>
              <div className="text-white/70 text-sm mt-0.5">
                {g <= 8 ? 'Middle School' : g <= 10 ? 'High School' : 'Senior Secondary'}
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-white/60 text-xs group-hover:text-white/90 transition-colors">
              <i className="fas fa-play-circle" />
              <span>View content →</span>
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
            <button
              key={subject}
              onClick={() => onSelect(subject)}
              className="bg-white border border-slate-200 rounded-xl p-5 text-left hover:border-sky-300 hover:shadow-md transition-all group"
            >
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

function LectureCard({ lecture, channelMap }: { lecture: any; channelMap: Record<string, string> }) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(lecture.youtubeUrl ?? '');
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'PRINCIPAL' || user?.role === 'TEACHER';
  const channelUrl = channelMap[lecture.studioName];
  const searchUrl = channelUrl ? channelSearchUrl(channelUrl, descriptionQuery(lecture)) : '#';

  const handleSave = async () => {
    setSaving(true);
    await api.content.setUrl(lecture.id, url || null).catch(() => null);
    setSaving(false);
    setEditing(false);
    lecture.youtubeUrl = url || null;
  };

  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        {/* Thumbnail / play button */}
        <a
          href={lecture.youtubeUrl || searchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-white font-bold transition-opacity hover:opacity-90 ${lecture.youtubeUrl ? 'bg-red-500' : 'bg-slate-400'}`}
          title={lecture.youtubeUrl ? 'Watch video' : `Search on ${lecture.studioName} channel`}
        >
          <i className={`fas ${lecture.youtubeUrl ? 'fa-play' : 'fa-search'} text-lg`} />
          <span className="text-[9px] mt-0.5 opacity-80">{lecture.youtubeUrl ? 'Watch' : 'Search'}</span>
        </a>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-800 leading-snug truncate" title={lecture.topic}>{lecture.topic}</div>
          <div className="text-sm text-slate-500 mt-0.5">{lecture.teacherName}</div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STUDIO_COLORS[lecture.studioName] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
              {lecture.studioName}
            </span>
            <span className="text-xs text-slate-400">{formatDate(lecture.date)}</span>
            <span className="text-xs text-slate-400">{lecture.startTime} – {lecture.endTime}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col items-end gap-1">
          <a
            href={lecture.youtubeUrl || searchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${lecture.youtubeUrl ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {lecture.youtubeUrl ? '▶ Play' : '🔍 Search'}
          </a>
          {isAdmin && (
            <button
              onClick={() => setEditing(e => !e)}
              className="text-[10px] text-slate-400 hover:text-sky-600 transition-colors"
            >
              {lecture.youtubeUrl ? '✏ Edit URL' : '+ Link'}
            </button>
          )}
        </div>
      </div>

      {/* URL editor (admin/teacher only) */}
      {editing && (
        <div className="mt-3 flex gap-2">
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 bg-sky-600 text-white text-xs rounded-lg hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button onClick={() => setEditing(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 text-xs rounded-lg hover:bg-slate-200">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function VideoTab({ standard, subject }: { standard: number; subject: string }) {
  const [lectures, setLectures] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [channelMap, setChannelMap] = useState<Record<string, string>>({});
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load channels once
  useEffect(() => {
    api.content.channels().then(chs => {
      const map: Record<string, string> = {};
      for (const c of chs) map[c.studioName] = c.channelUrl;
      setChannelMap(map);
    }).catch(() => null);
  }, []);

  const load = (p: number, s: string, d: string) => {
    setLoading(true);
    api.content.lectures(standard, subject, { search: s || undefined, date: d || undefined, page: p })
      .then(data => { setLectures(data.lectures); setTotal(data.total); setPages(data.pages); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(1, '', ''); }, [standard, subject]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(1, val, dateFilter), 350);
  };

  const handleDate = (val: string) => {
    setDateFilter(val);
    setPage(1);
    load(1, search, val);
  };

  const goPage = (p: number) => { setPage(p); load(p, search, dateFilter); };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search topic or teacher…"
            className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-300 focus:border-sky-400 outline-none"
          />
        </div>
        <input
          type="date"
          value={dateFilter}
          onChange={e => handleDate(e.target.value)}
          className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-sky-300 outline-none"
        />
        {(search || dateFilter) && (
          <button
            onClick={() => { setSearch(''); setDateFilter(''); setPage(1); load(1, '', ''); }}
            className="px-3 py-2 text-sm text-slate-500 hover:text-red-600 border border-slate-200 rounded-xl hover:border-red-200 transition-colors"
          >
            <i className="fas fa-times mr-1" />Clear
          </button>
        )}
      </div>

      <div className="text-xs text-slate-400">{total.toLocaleString()} lectures found</div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading lectures…</div>
      ) : lectures.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No lectures match your search.</div>
      ) : (
        <>
          <div className="space-y-2">
            {lectures.map(l => <LectureCard key={l.id} lecture={l} channelMap={channelMap} />)}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => goPage(page - 1)} disabled={page === 1} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 disabled:opacity-40">
                ‹ Prev
              </button>
              <span className="text-sm text-slate-500">Page {page} of {pages}</span>
              <button onClick={() => goPage(page + 1)} disabled={page === pages} className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm hover:bg-slate-200 disabled:opacity-40">
                Next ›
              </button>
            </div>
          )}
        </>
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

function SubjectContent({ standard, subject, onBack }: { standard: number; subject: string; onBack: () => void }) {
  const [tab, setTab] = useState<ContentTab>('video');

  const tabs: { key: ContentTab; label: string; icon: string }[] = [
    { key: 'video', label: 'Virtual Class Recorded', icon: '📹' },
    { key: 'ebook', label: 'E-Book', icon: '📚' },
    { key: 'assessment', label: 'Assessment', icon: '📝' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-sky-500 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'video' && <VideoTab standard={standard} subject={subject} />}
      {tab === 'ebook' && <ComingSoon label="E-Books" icon="📚" />}
      {tab === 'assessment' && <ComingSoon label="Assessments & Quizzes" icon="📝" />}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

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
