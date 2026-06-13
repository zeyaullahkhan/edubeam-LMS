import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AttendanceSeries, DistrictSummary, EnrollmentDemographics, TeacherStats } from '@edubeam/shared';
import { api, type BlockSummary, type Overview, type SchoolRow } from '../api';
import { exportCsv, printPdf } from '../export';

const BOYS_COLOR = '#0076BC';
const GIRLS_COLOR = '#EC4899';

// Attendance bar colour by rate (green ≥90%, amber 75–89%, red <75%).
const attColor = (v: number | null) =>
  v == null ? '#cbd5e1' : v >= 0.9 ? '#16a34a' : v >= 0.75 ? '#f59e0b' : '#dc2626';

const pct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`;
const passColor = (v: number) =>
  v >= 0.9 ? '#16a34a' : v >= 0.75 ? '#f59e0b' : '#dc2626';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  accent: string;
  onClick?: () => void;
  active?: boolean;
}

function StatCard({ label, value, sub, icon, accent, onClick, active }: StatCardProps) {
  return (
    <div
      className={`stat-card flex items-start gap-4 transition-all ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${active ? 'ring-2 ring-sky-400' : ''}`}
      onClick={onClick}
    >
      <div
        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg shadow-sm"
        style={{ background: accent }}
      >
        <i className={icon} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-widest font-semibold text-slate-500 leading-none mb-1">
          {label}
        </div>
        <div className="font-heading font-bold text-navy-700 text-2xl leading-none">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
        {onClick && (
          <div className="text-[10px] text-sky-500 font-medium mt-1 flex items-center gap-1">
            <i className="fas fa-table text-[9px]" />Click for school-wise
          </div>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentDemographics | null>(null);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSeries | null>(null);
  const [attPeriod, setAttPeriod] = useState<'month' | 'day'>('month');
  const [attMonth, setAttMonth] = useState(new Date().getMonth());
  const [attYear, setAttYear] = useState(new Date().getFullYear());
  const [openDistrict, setOpenDistrict] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [drilldown, setDrilldown] = useState<'students' | 'teachers' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.overview(), api.districts(), api.enrollment(), api.teacherStats()])
      .then(([o, d, e, ts]) => { setOverview(o); setDistricts(d); setEnrollment(e); setTeacherStats(ts); })
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    api.attendance(attPeriod, attPeriod === 'day' ? attMonth : undefined, attPeriod === 'day' ? attYear : undefined)
      .then(setAttendance).catch(() => setAttendance(null));
  }, [attPeriod, attMonth, attYear]);

  const toggleDistrict = async (id: string) => {
    if (openDistrict === id) { setOpenDistrict(null); return; }
    setOpenDistrict(id);
    setBlocks(await api.blocks(id));
  };

  if (error) return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">
      <i className="fas fa-exclamation-triangle" />
      {error}
    </div>
  );
  if (!overview) return (
    <div className="flex items-center gap-3 text-slate-500 py-16 justify-center">
      <i className="fas fa-circle-notch fa-spin" />
      Loading dashboard…
    </div>
  );

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <div className="section-tag mb-2">
            <i className="fas fa-chart-bar" />
            Monitoring Dashboard
          </div>
          <h1 className="font-heading font-bold text-navy-700 text-2xl leading-tight">
            Uttarakhand Government Schools
          </h1>
          <p className="text-slate-500 text-sm mt-1">2025–26 Academic Year · Real-time data</p>
        </div>
        <button onClick={printPdf} className="btn-outline no-print">
          <i className="fas fa-file-pdf" />
          Export PDF
        </button>
      </div>

      {/* ── KPI stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Total Districts"
          value={overview.totalDistricts.toLocaleString()}
          icon="fas fa-map"
          accent="linear-gradient(135deg,#1e3a8a,#3b82f6)"
        />
        <StatCard
          label="Total Blocks"
          value={overview.totalBlocks.toLocaleString()}
          icon="fas fa-th-large"
          accent="linear-gradient(135deg,#5b21b6,#8b5cf6)"
        />
        <StatCard
          label="Total Schools"
          value={overview.schools.toLocaleString()}
          sub={`${overview.virtualClassroomSchools.toLocaleString()} with Virtual`}
          icon="fas fa-school"
          accent="linear-gradient(135deg,#003087,#0076BC)"
        />
        <StatCard
          label="Total Students"
          value={overview.totalStudents.toLocaleString()}
          icon="fas fa-user-graduate"
          accent="linear-gradient(135deg,#065f46,#059669)"
          onClick={() => setDrilldown(drilldown === 'students' ? null : 'students')}
          active={drilldown === 'students'}
        />
        <StatCard
          label="Total Teachers"
          value={teacherStats ? teacherStats.totalTeachers.toLocaleString() : '…'}
          sub="ICT Lab schools"
          icon="fas fa-chalkboard-teacher"
          accent="linear-gradient(135deg,#0e7490,#06b6d4)"
          onClick={() => setDrilldown(drilldown === 'teachers' ? null : 'teachers')}
          active={drilldown === 'teachers'}
        />
        <StatCard
          label="Avg Pass Rate"
          value={`${pct(overview.avgPass10th)}`}
          sub={`Class 12: ${pct(overview.avgPass12th)}`}
          icon="fas fa-award"
          accent="linear-gradient(135deg,#b45309,#f59e0b)"
        />
      </div>

      {/* ── Drill-down panel (students / teachers school-wise) ── */}
      {drilldown && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-sky-50/50">
            <div className="flex items-center gap-2">
              <i className={`fas ${drilldown === 'students' ? 'fa-user-graduate text-emerald-600' : 'fa-chalkboard-teacher text-cyan-600'}`} />
              <h3 className="font-semibold text-navy-700 text-sm">
                {drilldown === 'students' ? 'Students by District' : 'Teachers by District'}
              </h3>
            </div>
            <button onClick={() => setDrilldown(null)} className="text-slate-400 hover:text-slate-600 text-sm">
              <i className="fas fa-times" />
            </button>
          </div>
          <table className="w-full text-sm data-table">
            <thead>
              <tr>
                <th className="text-left">District</th>
                <th className="text-right">Schools</th>
                {drilldown === 'students' ? (
                  <>
                    <th className="text-right">Students</th>
                    <th className="text-right">Pass 10th</th>
                    <th className="text-right">Pass 12th</th>
                  </>
                ) : (
                  <>
                    <th className="text-right">Teachers</th>
                    <th className="text-right">ICT Students</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {drilldown === 'students'
                ? [...districts].sort((a, b) => b.totalStudents - a.totalStudents).map((d) => (
                    <tr key={d.districtId}>
                      <td className="font-medium text-navy-700">{d.district}</td>
                      <td className="text-right">{d.schools}</td>
                      <td className="text-right font-semibold">{d.totalStudents.toLocaleString()}</td>
                      <td className="text-right font-semibold" style={{ color: passColor(d.avgPass10th ?? 0) }}>{pct(d.avgPass10th)}</td>
                      <td className="text-right font-semibold" style={{ color: passColor(d.avgPass12th ?? 0) }}>{pct(d.avgPass12th)}</td>
                    </tr>
                  ))
                : teacherStats?.byDistrict.sort((a, b) => b.teachers - a.teachers).map((d) => (
                    <tr key={d.districtId}>
                      <td className="font-medium text-navy-700">{d.district}</td>
                      <td className="text-right">{d.schools}</td>
                      <td className="text-right font-semibold">{d.teachers.toLocaleString()}</td>
                      <td className="text-right">{d.students.toLocaleString()}</td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* ── Student gender ratio (from 500 Virtual2526 enrolment) ── */}
      {enrollment && <GenderPanel data={enrollment} />}

      {/* ── Attendance calendar (sample) ──────────────────────── */}
      {attendance && (
        <AttendancePanel
          data={attendance}
          period={attPeriod}
          onPeriod={setAttPeriod}
          selMonth={attMonth}
          selYear={attYear}
          onMonthChange={(m, y) => { setAttMonth(m); setAttYear(y); }}
        />
      )}

      {/* ── District performance table ────────────────────────── */}
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-heading font-semibold text-navy-700">
              District Performance
              <span className="ml-2 text-sm font-normal text-slate-400">({districts.length} districts)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Click a district → blocks → schools to drill down</p>
          </div>
          <button
            onClick={() =>
              exportCsv(
                'district-summary',
                districts.map((d) => ({
                  District: d.district,
                  Schools: d.schools,
                  'Virtual Classroom': d.virtualClassroomSchools,
                  Students: d.totalStudents,
                  'Avg Pass 10th': pct(d.avgPass10th),
                  'Avg Pass 12th': pct(d.avgPass12th),
                })),
              )
            }
            className="btn-outline no-print text-xs"
          >
            <i className="fas fa-download" />
            Export CSV
          </button>
        </div>
        <table className="w-full text-sm data-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 'auto' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '110px' }} />
            <col style={{ width: '110px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">District / Block / School</th>
              <th className="text-right">Schools</th>
              <th className="text-right">Virtual</th>
              <th className="text-right">Students</th>
              <th className="text-right">Pass 10th</th>
              <th className="text-right">Pass 12th</th>
            </tr>
          </thead>
          <tbody>
            {districts.map((d) => (
              <DistrictRow
                key={d.districtId}
                d={d}
                open={openDistrict === d.districtId}
                blocks={openDistrict === d.districtId ? blocks : []}
                onToggle={() => toggleDistrict(d.districtId)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GenderPanel({ data }: { data: EnrollmentDemographics }) {
  const { boys, girls, total } = data;
  const boysPct = total ? ((boys / total) * 100).toFixed(1) : '0';
  const girlsPct = total ? ((girls / total) * 100).toFixed(1) : '0';
  const pieData = [
    { name: 'Boys', value: boys },
    { name: 'Girls', value: girls },
  ];
  const barData = data.byGrade.map((g) => ({ name: `Class ${g.grade}`, Boys: g.boys, Girls: g.girls }));

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-semibold text-navy-700">Student Gender Ratio</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Enrolment from Virtual Classroom data (500 schools) · {total.toLocaleString()} students
          </p>
        </div>
        <button
          onClick={() =>
            exportCsv(
              'gender-ratio-by-class',
              data.byGrade.map((g) => ({
                Class: g.grade, Boys: g.boys, Girls: g.girls, Total: g.boys + g.girls,
              })),
            )
          }
          className="btn-outline no-print text-xs"
        >
          <i className="fas fa-download" />
          Export CSV
        </button>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-center">
        {/* Boys / Girls donut */}
        <div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={2}
                isAnimationActive={false}
              >
                <Cell fill={BOYS_COLOR} />
                <Cell fill={GIRLS_COLOR} />
              </Pie>
              <Tooltip
                formatter={(v, n) => { const num = v as number; return [`${num.toLocaleString()} (${((num / total) * 100).toFixed(1)}%)`, n]; }}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.10)' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 -mt-2">
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: BOYS_COLOR }} />Boys
              </div>
              <div className="font-heading font-bold text-navy-700 text-lg">{boys.toLocaleString()}</div>
              <div className="text-xs text-slate-400">{boysPct}%</div>
            </div>
            <div className="text-center">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: GIRLS_COLOR }} />Girls
              </div>
              <div className="font-heading font-bold text-navy-700 text-lg">{girls.toLocaleString()}</div>
              <div className="text-xs text-slate-400">{girlsPct}%</div>
            </div>
          </div>
        </div>

        {/* Class-wise boys vs girls */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Class-wise gender ratio
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip
                formatter={(v) => (v as number).toLocaleString()}
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.10)' }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Boys" fill={BOYS_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="Girls" fill={GIRLS_COLOR} radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildMonthOptions() {
  const options: { label: string; month: number; year: number }[] = [];
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  // Walk backward from current month to Jan 2019
  for (let y = endYear; y >= 2019; y--) {
    const startM = y === endYear ? endMonth : 11;
    const endM = y === 2019 ? 0 : 0;
    for (let m = startM; m >= endM; m--) {
      options.push({ label: `${MONTH_NAMES[m]} ${y}`, month: m, year: y });
    }
  }
  return options;
}

function AttendancePanel({
  data, period, onPeriod, selMonth, selYear, onMonthChange,
}: {
  data: AttendanceSeries;
  period: 'month' | 'day';
  onPeriod: (p: 'month' | 'day') => void;
  selMonth: number;
  selYear: number;
  onMonthChange: (month: number, year: number) => void;
}) {
  const monthOptions = buildMonthOptions();
  const chartData = data.points.map((p) => ({
    label: p.label,
    pct: p.attendancePct,
    present: p.present,
    total: p.total,
    isHoliday: p.isHoliday,
  }));

  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-semibold text-navy-700">Student Attendance</h2>
            <span className="badge-sample">Sample</span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {period === 'month'
              ? 'Average daily attendance by month · 2026'
              : `Daily attendance · ${data.monthLabel}`}
            {data.averagePct != null && (
              <span className="ml-1 text-slate-400">· avg {(data.averagePct * 100).toFixed(1)}%</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 no-print flex-wrap">
          <div className="flex gap-1 text-sm">
            {(['month', 'day'] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPeriod(p)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                  period === p ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                style={period === p ? { background: 'linear-gradient(135deg,#003087,#0076BC)' } : {}}
              >
                {p === 'month' ? 'By Month' : 'By Day'}
              </button>
            ))}
          </div>
          {period === 'day' && (
            <select
              value={`${selYear}-${selMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number);
                onMonthChange(m, y);
              }}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300"
            >
              {monthOptions.map((o) => (
                <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
                  {o.label}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() =>
              exportCsv(
                `attendance-by-${period}`,
                data.points.map((p) => ({
                  [period === 'month' ? 'Month' : 'Day']: p.label,
                  'Attendance %': p.attendancePct == null ? 'Holiday' : (p.attendancePct * 100).toFixed(1),
                  Present: p.present,
                  Total: p.total,
                })),
              )
            }
            className="btn-outline text-xs"
          >
            <i className="fas fa-download" />
            Export CSV
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: -8 }} barCategoryGap={period === 'day' ? 2 : '20%'}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" fontSize={11} interval={period === 'day' ? 1 : 0} />
          <YAxis domain={[0, 1]} tickFormatter={(v) => `${Math.round(v * 100)}%`} fontSize={12} />
          <Tooltip
            formatter={((v: unknown, _n: unknown, item: unknown) => {
              const val = v as number | null;
              if (val == null) return ['Holiday', 'Attendance'];
              const present = (item as { payload?: { present?: number } })?.payload?.present ?? 0;
              return [`${(val * 100).toFixed(1)}%  (${present.toLocaleString()} present)`, 'Attendance'];
            }) as never}
            labelFormatter={(l) => (period === 'month' ? l : `Day ${l}`)}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,48,135,0.10)' }}
          />
          <Bar dataKey="pct" radius={[4, 4, 0, 0]} isAnimationActive={false}>
            {chartData.map((p, i) => (
              <Cell key={i} fill={attColor(p.pct)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-600 inline-block" />≥ 90%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />75–89%</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />&lt; 75%</span>
        {period === 'day' && (
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-slate-300 inline-block" />Holiday</span>
        )}
      </div>
    </div>
  );
}

function DistrictRow({
  d, open, blocks, onToggle,
}: {
  d: DistrictSummary;
  open: boolean;
  blocks: BlockSummary[];
  onToggle: () => void;
}) {
  const [openBlock, setOpenBlock] = useState<string | null>(null);
  const [blockSchools, setBlockSchools] = useState<SchoolRow[]>([]);
  const [loadingBlock, setLoadingBlock] = useState(false);

  const toggleBlock = async (blockId: string) => {
    if (openBlock === blockId) { setOpenBlock(null); return; }
    setOpenBlock(blockId);
    setLoadingBlock(true);
    const schools = await api.schools({ blockId }).catch(() => []);
    setBlockSchools(schools);
    setLoadingBlock(false);
  };

  return (
    <>
      {/* District row */}
      <tr
        className={`cursor-pointer transition-colors ${open ? 'bg-sky-50' : 'hover:bg-sky-50/30'}`}
        onClick={onToggle}
      >
        <td className="font-medium text-navy-700">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded mr-2 text-[10px] transition-transform ${
            open ? 'bg-sky-100 text-sky-600 rotate-90' : 'bg-slate-100 text-slate-400'
          }`}>
            <i className="fas fa-chevron-right" />
          </span>
          {d.district}
        </td>
        <td className="text-right font-medium">{d.schools}</td>
        <td className="text-right font-medium">{d.virtualClassroomSchools}</td>
        <td className="text-right">{d.totalStudents.toLocaleString()}</td>
        <td className="text-right font-semibold" style={{ color: passColor(d.avgPass10th ?? 0) }}>
          {pct(d.avgPass10th)}
        </td>
        <td className="text-right font-semibold" style={{ color: passColor(d.avgPass12th ?? 0) }}>
          {pct(d.avgPass12th)}
        </td>
      </tr>

      {/* Block rows */}
      {open && blocks.map((b) => (
        <React.Fragment key={b.blockId}>
          <tr
            className={`cursor-pointer transition-colors ${openBlock === b.blockId ? 'bg-sky-100/60' : 'bg-sky-50/60 hover:bg-sky-100/40'}`}
            onClick={() => toggleBlock(b.blockId)}
          >
            <td className="pl-10 text-slate-600">
              <span className={`inline-flex items-center justify-center w-4 h-4 rounded mr-1.5 text-[9px] transition-transform ${
                openBlock === b.blockId ? 'bg-sky-200 text-sky-700 rotate-90' : 'bg-slate-100 text-slate-400'
              }`}>
                <i className="fas fa-chevron-right" />
              </span>
              <i className="fas fa-map-pin text-sky-400 mr-1.5 text-xs" />
              {b.block}
              <span className="ml-1.5 text-xs text-slate-400">({b.schools} schools)</span>
            </td>
            <td className="text-right text-slate-500 font-medium">{b.schools}</td>
            <td className="text-right text-slate-500 font-medium">{b.virtualClassroomSchools}</td>
            <td className="text-right text-slate-500">{b.totalStudents.toLocaleString()}</td>
            <td className="text-right text-slate-400">—</td>
            <td className="text-right text-slate-400">—</td>
          </tr>

          {/* School rows under this block */}
          {openBlock === b.blockId && (
            loadingBlock ? (
              <tr>
                <td colSpan={6} className="pl-20 py-2 text-xs text-slate-400">
                  <i className="fas fa-circle-notch fa-spin mr-1" />Loading schools…
                </td>
              </tr>
            ) : blockSchools.map((s) => (
              <tr key={s.id} className="bg-blue-50/30 text-slate-600 text-xs">
                <td className="pl-20">
                  <i className="fas fa-school text-slate-300 mr-1.5" />
                  <span className="font-medium text-slate-700">{s.name}</span>
                  {s.udiseCode && (
                    <span className="ml-1.5 text-slate-400 font-mono">{s.udiseCode}</span>
                  )}
                </td>
                <td className="text-right text-slate-400">—</td>
                <td className="text-right">
                  {s.hasVirtualClassroom && (
                    <span className="badge-virtual text-[10px] px-1.5 py-0.5">
                      <i className="fas fa-video mr-1" />VC
                    </span>
                  )}
                </td>
                <td className="text-right text-slate-500">
                  {(s.enrolledStudents ?? s.students)?.toLocaleString() ?? '—'}
                </td>
                <td className="text-right font-semibold" style={s.avgPass10th != null ? { color: passColor(s.avgPass10th) } : {}}>
                  {pct(s.avgPass10th)}
                </td>
                <td className="text-right font-semibold" style={s.avgPass12th != null ? { color: passColor(s.avgPass12th) } : {}}>
                  {pct(s.avgPass12th)}
                </td>
              </tr>
            ))
          )}
        </React.Fragment>
      ))}
    </>
  );
}
