import { useEffect, useState } from 'react';
import { api, type SchoolRow } from '../api';
import { exportCsv } from '../export';

export function Schools() {
  const [rows, setRows] = useState<SchoolRow[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  const load = (query?: string) => {
    setLoading(true);
    api.schools({ q: query }).then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  return (
    <div className="space-y-5">
      {/* ── Page header ─────────────────────────────────── */}
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

      {/* ── Search bar ──────────────────────────────────── */}
      <form
        onSubmit={(e) => { e.preventDefault(); load(q); }}
        className="flex gap-2 items-center"
      >
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <i className="fas fa-search text-xs" />
          </span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by school name…"
            className="w-full border border-slate-200 rounded-lg pl-9 pr-4 py-2.5 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300
                       transition-colors"
          />
        </div>
        <button
          type="submit"
          className="btn-navy px-5 py-2.5"
        >
          <i className="fas fa-search" />
          Search
        </button>
        {q && (
          <button
            type="button"
            onClick={() => { setQ(''); load(); }}
            className="btn-outline px-3 py-2.5"
          >
            <i className="fas fa-times" />
          </button>
        )}
      </form>

      {/* ── Table ───────────────────────────────────────── */}
      <div className="panel overflow-hidden">
        <table className="w-full text-sm data-table">
          <thead>
            <tr>
              <th>School</th>
              <th>UDISE</th>
              <th>District / Block</th>
              <th>Facilities</th>
              <th className="text-right">Teachers</th>
              <th className="text-right">Students</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((s) => (
              <tr key={s.id}>
                <td>
                  <div className="font-semibold text-navy-700">{s.name}</div>
                  {s.siteCode && (
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{s.siteCode}</div>
                  )}
                </td>
                <td className="text-slate-500 font-mono text-xs">{s.udiseCode}</td>
                <td>
                  <div className="font-medium text-slate-700">{s.district}</div>
                  <div className="text-xs text-slate-400">{s.block}</div>
                </td>
                <td>
                  <div className="flex gap-1 flex-wrap">
                    {s.hasVirtualClassroom && (
                      <span className="badge-virtual">
                        <i className="fas fa-video mr-1" />
                        Virtual
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-right font-medium">{s.teachers ?? '—'}</td>
                <td className="text-right font-medium">{s.students ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {loading && (
          <div className="flex items-center gap-2 p-5 text-slate-400 text-sm">
            <i className="fas fa-circle-notch fa-spin" />
            Loading schools…
          </div>
        )}
        {!loading && (
          <div className="px-4 py-3 text-xs text-slate-400 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span>Showing {Math.min(rows.length, 200)} of {rows.length} schools in your scope</span>
            <span className="flex items-center gap-2">
              <span className="badge-virtual"><i className="fas fa-video mr-1" />Virtual Classroom</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
