import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DistrictSummary, KpiResponse, Metric, MetricGroup } from '@edubeam/shared';
import { api, type BlockSummary, type SchoolRow } from '../api';
import { useAuth } from '../auth';
import { stateFor } from '../config/states';
import { formatMetric, trendLabel } from '../format';
import { exportCsv, printPdf } from '../export';

export function Analytics() {
  const { user } = useAuth();
  const state = user ? stateFor(user) : null;
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [sel, setSel] = useState<{ districtId?: string; blockId?: string; schoolId?: string }>({});
  const [data, setData] = useState<KpiResponse | null>(null);
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');

  const canPickDistrict = user?.role === 'ADMIN' || user?.role === 'STATE_OFFICIAL';

  useEffect(() => {
    api.districts().then(setDistricts).catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    if (sel.districtId) api.blocks(sel.districtId).then(setBlocks);
    else setBlocks([]);
  }, [sel.districtId]);

  useEffect(() => {
    if (sel.districtId || sel.blockId)
      api.schools({ districtId: sel.districtId, blockId: sel.blockId }).then(setSchools);
    else setSchools([]);
  }, [sel.districtId, sel.blockId]);

  useEffect(() => {
    api.kpis(sel).then(setData).catch((e) => setError((e as Error).message));
  }, [sel.districtId, sel.blockId, sel.schoolId]);

  const groups = data?.groups ?? [];
  const tabs = useMemo(
    () => [...groups.map((g) => g.category), 'Government Project KPIs'],
    [groups],
  );

  if (error) return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
      <i className="fas fa-exclamation-triangle" />
      {error}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="section-tag mb-2">
            <i className="fas fa-chart-line" />
            Analytics Hub
          </div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl">
            KPI Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Scope: <span className="font-semibold text-navy-600">{data?.scope.label ?? '…'}</span>
          </p>
        </div>
        <button onClick={printPdf} className="btn-outline no-print">
          <i className="fas fa-file-pdf" />
          Export PDF
        </button>
      </div>

      {/* ── Scope selector ────────────────────────────────────── */}
      {canPickDistrict && (
        <div className="no-print panel px-5 py-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
              <i className="fas fa-filter" />
              Drill down
            </div>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors"
              value={sel.districtId ?? ''}
              onChange={(e) => setSel({ districtId: e.target.value || undefined })}
            >
              <option value="">All districts (statewide)</option>
              {districts.map((d) => (
                <option key={d.districtId} value={d.districtId}>{d.district}</option>
              ))}
            </select>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!sel.districtId}
              value={sel.blockId ?? ''}
              onChange={(e) => setSel((s) => ({ districtId: s.districtId, blockId: e.target.value || undefined }))}
            >
              <option value="">All blocks</option>
              {blocks.map((b) => (
                <option key={b.blockId} value={b.blockId}>{b.block}</option>
              ))}
            </select>
            <select
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!sel.districtId && !sel.blockId}
              value={sel.schoolId ?? ''}
              onChange={(e) =>
                setSel((s) => ({ districtId: s.districtId, blockId: s.blockId, schoolId: e.target.value || undefined }))
              }
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {(sel.districtId || sel.blockId || sel.schoolId) && (
              <button
                onClick={() => setSel({})}
                className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                <i className="fas fa-times-circle text-xs" />
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Students by District bar chart (real data) ───────── */}
      {districts.length > 0 && (
        <div className="panel p-5">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-heading font-semibold text-navy-700">Total Students — District Wise</h2>
            <span className="badge-real">Real</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Enrollment from Virtual Classroom data{state ? ` · all districts — ${state.name}` : ' · all states'}
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={[...districts].sort((a, b) => b.totalStudents - a.totalStudents)}
              margin={{ top: 8, right: 16, bottom: 60, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="district" fontSize={11} angle={-35} textAnchor="end" interval={0} />
              <YAxis fontSize={12} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
              <Tooltip
                formatter={(v) => [(v as number).toLocaleString(), 'Students']}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.10)' }}
              />
              <Bar dataKey="totalStudents" name="Students" fill="#059669" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Real 5-year board result trend ───────────────────── */}
      {data && data.yearlyResults.length > 0 && (
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <h2 className="font-heading font-semibold text-navy-700">5-Year Board Result Trend</h2>
              <span className="badge-real">Real</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Average Total pass % by year · {data.scope.label}
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.yearlyResults} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="year" fontSize={12} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} fontSize={12} />
              <Tooltip
                formatter={(v) => { const n = v as number | null; return n == null ? '—' : `${(n * 100).toFixed(1)}%`; }}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.10)' }}
              />
              <Legend />
              <Line type="monotone" dataKey="pass10" name="Class 10" stroke="#003087" strokeWidth={2.5} connectNulls isAnimationActive={false} dot={{ fill: '#003087', r: 4 }} />
              <Line type="monotone" dataKey="pass12" name="Class 12" stroke="#5BBCD8" strokeWidth={2.5} connectNulls isAnimationActive={false} dot={{ fill: '#5BBCD8', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Category tabs ─────────────────────────────────────── */}
      <div className="no-print">
        <div className="flex flex-wrap gap-1 border-b border-slate-200">
          {tabs.map((t, i) => (
            <button
              key={t}
              onClick={() => setTab(i)}
              className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-all duration-150 ${
                tab === i
                  ? 'border-sky-400 text-navy-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-300'
              }`}
            >
              {t.replace(' Analytics', '')}
            </button>
          ))}
        </div>
      </div>

      {data && tab < groups.length && <CategoryPanel group={groups[tab]} />}
      {data && tab === groups.length && <GovtKpiPanel data={data} />}
    </div>
  );
}

function MetricCard({ m }: { m: Metric }) {
  const t = trendLabel(m.trend);
  return (
    <div className="stat-card relative">
      {m.source === 'sample' ? (
        <span className="absolute top-3 right-3 badge-sample">Sample</span>
      ) : (
        <span className="absolute top-3 right-3 badge-real">Real</span>
      )}
      <div className="text-xs text-slate-500 pr-16 leading-snug">{m.label}</div>
      <div className="font-heading font-bold text-navy-700 text-2xl mt-2">{formatMetric(m)}</div>
      {t && (
        <div className={`text-xs mt-1 font-medium flex items-center gap-1 ${t.cls}`}>
          {t.text}
        </div>
      )}
    </div>
  );
}

function CategoryPanel({ group }: { group: MetricGroup }) {
  const realCount = group.metrics.filter((m) => m.source === 'real').length;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-heading font-semibold text-navy-700">{group.category}</h2>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="badge-real">{realCount} live</span>
          <span className="badge-sample">{group.metrics.length - realCount} sample</span>
        </div>
        <button
          onClick={() =>
            exportCsv(
              group.key + '-kpis',
              group.metrics.map((m) => ({ Metric: m.label, Value: formatMetric(m), Source: m.source })),
            )
          }
          className="btn-outline no-print ml-auto text-xs"
        >
          <i className="fas fa-download" />
          Export CSV
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {group.metrics.map((m) => (
          <MetricCard key={m.key} m={m} />
        ))}
      </div>
    </div>
  );
}

function GovtKpiPanel({ data }: { data: KpiResponse }) {
  return (
    <div className="panel overflow-hidden">
      <div className="p-5 flex items-center justify-between border-b border-slate-100">
        <div>
          <h2 className="font-heading font-semibold text-navy-700">Government Project KPIs</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Smart Classrooms · ICT Labs · Virtual Classrooms — {data.scope.label}
          </p>
        </div>
        <button
          onClick={() =>
            exportCsv('govt-kpis', data.govtKpis.map((k) => ({
              KPI: k.kpi, 'Data Point': k.dataPoint, Value: k.value, Source: k.source,
            })))
          }
          className="btn-outline no-print text-xs"
        >
          <i className="fas fa-download" />
          Export CSV
        </button>
      </div>
      <table className="w-full text-sm data-table">
        <thead>
          <tr>
            <th>KPI</th>
            <th>Data Point</th>
            <th className="text-right">Value</th>
            <th className="text-right">Source</th>
          </tr>
        </thead>
        <tbody>
          {data.govtKpis.map((k) => (
            <tr key={k.kpi}>
              <td className="font-semibold text-navy-700">{k.kpi}</td>
              <td className="text-slate-500">{k.dataPoint}</td>
              <td className="text-right font-bold text-navy-600">{k.value}</td>
              <td className="text-right">
                <span className={k.source === 'real' ? 'badge-real' : 'badge-sample'}>
                  {k.source}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
