import React, { useEffect, useState } from 'react';
import { EVENTS } from '../data/schedule';
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
import type { DistrictSummary, EnrollmentDemographics, TeacherStats } from '@edubeam/shared';
import { api, type BlockSummary, type Overview, type SchoolRow } from '../api';
import { exportCsv, printPdf } from '../export';
import { useAuth } from '../auth';
import { stateFor } from '../config/states';
import { UttarakhandMap } from '../components/UttarakhandMap';

const BOYS_COLOR = '#0076BC';
const GIRLS_COLOR = '#EC4899';

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
      className={`stat-card flex flex-col gap-2 transition-all min-h-[110px] ${onClick ? 'cursor-pointer hover:shadow-md' : ''} ${active ? 'ring-2 ring-sky-400' : ''}`}
      onClick={onClick}
    >
      {/* Icon row */}
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm shadow-sm shrink-0"
          style={{ background: accent }}
        >
          <i className={icon} />
        </div>
        {onClick && (
          <span className="text-[10px] text-sky-500 font-semibold flex items-center gap-0.5">
            <i className="fas fa-table text-[9px]" />
            <span className="hidden sm:inline">Details</span>
          </span>
        )}
      </div>

      {/* Value + label — always at same vertical position */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="font-heading font-extrabold text-navy-700 text-[22px] leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mt-1 leading-tight">{label}</div>
        {sub && <div className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">{sub}</div>}
      </div>
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const state = user ? stateFor(user) : null;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [enrollment, setEnrollment] = useState<EnrollmentDemographics | null>(null);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [openDistrict, setOpenDistrict] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [drilldown, setDrilldown] = useState<'districts' | 'blocks' | 'schools' | 'students' | 'teachers' | null>(null);
  // KPI panel drill-down: district → block → schools
  const [drillDistrictId, setDrillDistrictId] = useState<string | null>(null);
  const [drillBlocks, setDrillBlocks] = useState<BlockSummary[]>([]);
  const [drillBlockId, setDrillBlockId] = useState<string | null>(null);
  const [drillSchools, setDrillSchools] = useState<SchoolRow[]>([]);
  const [error, setError] = useState('');
  const [todayAtt, setTodayAtt] = useState<any>(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);
  const [attDrilldown, setAttDrilldown] = useState<any[] | null>(null);
  const [attDrillMetric, setAttDrillMetric] = useState<'present' | 'absent' | 'late' | null>(null);
  const [attDrillLoading, setAttDrillLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.overview(), api.districts(), api.enrollment(), api.teacherStats()])
      .then(([o, d, e, ts]) => { setOverview(o); setDistricts(d); setEnrollment(e); setTeacherStats(ts); })
      .catch((e) => setError((e as Error).message));
    api.attendance.today().then(setTodayAtt).catch(() => null);
    api.planner.upcoming(3).then(setUpcomingHolidays).catch(() => null);
  }, []);

  const openAttDrilldown = async (metric: 'present' | 'absent' | 'late') => {
    if (attDrillMetric === metric) { setAttDrilldown(null); setAttDrillMetric(null); return; }
    setAttDrillMetric(metric);
    setAttDrillLoading(true);
    try {
      const rows = await api.attendance.todayDrilldown();
      setAttDrilldown(rows);
    } catch { setAttDrilldown([]); }
    finally { setAttDrillLoading(false); }
  };

  const selectDrillDistrict = async (id: string) => {
    if (drillDistrictId === id) { setDrillDistrictId(null); setDrillBlocks([]); setDrillBlockId(null); setDrillSchools([]); return; }
    setDrillDistrictId(id);
    setDrillBlockId(null);
    setDrillSchools([]);
    setDrillBlocks(await api.blocks(id));
  };

  const selectDrillBlock = async (blockId: string) => {
    if (drillBlockId === blockId) { setDrillBlockId(null); setDrillSchools([]); return; }
    setDrillBlockId(blockId);
    setDrillSchools(await api.schools({ blockId }));
  };

  const closeDrilldown = () => {
    setDrilldown(null); setDrillDistrictId(null); setDrillBlocks([]);
    setDrillBlockId(null); setDrillSchools([]);
  };

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

  const isSchoolScoped = ['PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'].includes(user?.role ?? '');
  const districtLabel = districts[0]?.district ?? null;

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
            {state ? state.govLabel : 'All States — Platform Dashboard'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">2025–26 Academic Year · Real-time data</p>
        </div>
        <button onClick={printPdf} className="btn-outline no-print">
          <i className="fas fa-file-pdf" />
          Export PDF
        </button>
      </div>

      {/* ── Event notification ticker ────────────────────────── */}
      {(() => {
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = EVENTS.filter(e => e.date >= today).slice(0, 4);
        const urgent = upcoming.filter(e => e.urgent);
        if (!upcoming.length) return null;
        return (
          <div className="flex items-stretch gap-3 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden no-print">
            {/* Bell badge */}
            <div className={`flex items-center justify-center w-14 shrink-0 ${urgent.length ? 'bg-rose-500' : 'bg-sky-600'}`}>
              <i className={`fas fa-bell text-white text-lg ${urgent.length ? 'animate-bounce' : ''}`} />
            </div>
            {/* Scrolling ticker */}
            <div className="flex-1 min-w-0 py-2 overflow-hidden">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                {urgent.length ? '⚠ Upcoming Alerts' : 'Upcoming Events'}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {upcoming.map(ev => (
                  <span key={ev.id} className={`flex items-center gap-1.5 text-sm font-semibold ${ev.urgent ? 'text-rose-600' : 'text-slate-700'}`}>
                    {ev.urgent && <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
                    <span className="text-slate-400 font-normal text-xs">{new Date(ev.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    {ev.title}
                  </span>
                ))}
              </div>
            </div>
            {/* CTA */}
            <a href="/planner" className="flex items-center gap-1.5 px-4 text-xs font-bold text-sky-600 hover:text-sky-800 shrink-0 border-l border-slate-100">
              View All <i className="fas fa-arrow-right text-[10px]" />
            </a>
          </div>
        );
      })()}

      {/* ── Upcoming holidays alert ──────────────────────────── */}
      {upcomingHolidays.length > 0 && (
        <div className="no-print bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-amber-700 font-bold text-sm shrink-0">
            <span className="text-xl">🗓️</span> Upcoming Holidays
          </div>
          <div className="flex flex-wrap gap-3 flex-1 min-w-0">
            {upcomingHolidays.map(h => {
              const SCOPE_LABEL: Record<string, string> = { TENANT: 'State', DISTRICT: 'District', BLOCK: 'Block', SCHOOL: 'School' };
              const scopeCls = h.scope === 'TENANT' ? 'text-orange-700 bg-orange-100 border-orange-300'
                : h.scope === 'DISTRICT' ? 'text-amber-700 bg-amber-100 border-amber-300'
                : 'text-sky-700 bg-sky-100 border-sky-300';
              return (
                <div key={h.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-lg px-3 py-1.5 text-sm shadow-sm">
                  <div>
                    <p className="font-semibold text-slate-800 leading-none">{h.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{new Date(h.startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${scopeCls}`}>
                    {SCOPE_LABEL[h.scope] ?? h.scope}
                  </span>
                </div>
              );
            })}
          </div>
          <a href="/planner" className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-800 shrink-0 mt-1">
            Manage <i className="fas fa-arrow-right text-[10px]" />
          </a>
        </div>
      )}

      {/* ── Today's attendance summary ───────────────────────── */}
      {todayAtt && (todayAtt.students.present > 0 || todayAtt.staff.present > 0 || todayAtt.students.absent > 0) && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 no-print">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Today's Attendance</span>
            <span className="ml-auto text-xs text-slate-400">{todayAtt.date}</span>
          </div>
          <div className="grid grid-cols-2 gap-6">
            {/* Students */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <i className="fas fa-user-graduate text-emerald-500" />Students
                <span className="text-[10px] text-slate-300 font-normal ml-1">(click to see school breakdown)</span>
              </p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { label: 'Present', val: todayAtt.students.present, cls: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100', metric: 'present' as const },
                  { label: 'Absent',  val: todayAtt.students.absent,  cls: 'text-red-600 bg-red-50 hover:bg-red-100',             metric: 'absent'  as const },
                  { label: 'Late',    val: todayAtt.students.late,    cls: 'text-amber-600 bg-amber-50 hover:bg-amber-100',        metric: 'late'    as const },
                ]).map(item => (
                  <button key={item.label}
                    onClick={() => openAttDrilldown(item.metric)}
                    className={`rounded-lg p-2 text-center transition-all cursor-pointer ${item.cls} ${attDrillMetric === item.metric ? 'ring-2 ring-offset-1 ring-current scale-105' : ''}`}>
                    <div className="text-xl font-bold">{item.val}</div>
                    <div className="text-[10px] font-medium flex items-center justify-center gap-1">
                      {item.label}
                      <i className="fas fa-chevron-down text-[8px] opacity-60" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Staff */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1.5">
                <i className="fas fa-chalkboard-teacher text-sky-500" />Staff
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Present', val: todayAtt.staff.present, cls: 'text-emerald-600 bg-emerald-50' },
                  { label: 'Absent',  val: todayAtt.staff.absent,  cls: 'text-red-600 bg-red-50' },
                  { label: 'On Duty', val: todayAtt.staff.onDuty,  cls: 'text-blue-600 bg-blue-50' },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-2 text-center ${item.cls}`}>
                    <div className="text-xl font-bold">{item.val}</div>
                    <div className="text-[10px] font-medium">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── School-wise drilldown panel ── */}
          {attDrillMetric && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">
                  School-wise — {attDrillMetric === 'present' ? 'Present' : attDrillMetric === 'absent' ? 'Absent' : 'Late'} Count
                  {attDrilldown && <span className="ml-2 text-slate-400 font-normal">({attDrilldown.filter(r => r[attDrillMetric!] > 0).length} schools)</span>}
                </p>
                <button onClick={() => { setAttDrilldown(null); setAttDrillMetric(null); }}
                  className="text-slate-400 hover:text-slate-600 p-1">
                  <i className="fas fa-times text-xs" />
                </button>
              </div>
              {attDrillLoading ? (
                <div className="text-center py-6 text-slate-400 text-sm"><i className="fas fa-circle-notch fa-spin mr-2" />Loading…</div>
              ) : !attDrilldown?.length ? (
                <div className="text-center py-4 text-slate-400 text-sm">No attendance data for today.</div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-100 max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr className="text-slate-500 uppercase tracking-wide">
                        <th className="px-3 py-2 text-left">#</th>
                        <th className="px-3 py-2 text-left">School</th>
                        <th className="px-3 py-2 text-left">District / Block</th>
                        <th className="px-3 py-2 text-center text-emerald-600">Present</th>
                        <th className="px-3 py-2 text-center text-red-600">Absent</th>
                        <th className="px-3 py-2 text-center text-amber-600">Late</th>
                        <th className="px-3 py-2 text-center text-slate-400">Not Marked</th>
                        <th className="px-3 py-2 text-center">Marked %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {attDrilldown
                        .filter(r => r[attDrillMetric!] > 0 || r.present > 0 || r.absent > 0)
                        .map((row, i) => (
                          <tr key={row.schoolId} className={`hover:bg-slate-50 ${row[attDrillMetric!] > 0 ? '' : 'opacity-50'}`}>
                            <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                            <td className="px-3 py-2 font-medium text-slate-800 max-w-[160px] truncate">{row.name}</td>
                            <td className="px-3 py-2 text-slate-400">{row.district}{row.block ? ` / ${row.block}` : ''}</td>
                            <td className="px-3 py-2 text-center font-semibold text-emerald-600">{row.present || '—'}</td>
                            <td className="px-3 py-2 text-center font-semibold text-red-600">{row.absent || '—'}</td>
                            <td className="px-3 py-2 text-center font-semibold text-amber-600">{row.late || '—'}</td>
                            <td className="px-3 py-2 text-center text-slate-400">{row.notMarked}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full font-semibold ${
                                row.markedPct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                                row.markedPct >= 50 ? 'bg-amber-100 text-amber-700' :
                                row.markedPct > 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {row.markedPct > 0 ? `${row.markedPct}%` : '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── KPI stat cards ────────────────────────────────────── */}
      <div className={`grid gap-4 grid-cols-2 ${isSchoolScoped ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3 lg:grid-cols-6'}`}>
        {!isSchoolScoped && (
          <StatCard
            label="Districts"
            value={overview.totalDistricts.toLocaleString()}
            icon="fas fa-map"
            accent="linear-gradient(135deg,#1e3a8a,#3b82f6)"
            onClick={() => setDrilldown(drilldown === 'districts' ? null : 'districts')}
            active={drilldown === 'districts'}
          />
        )}
        {!isSchoolScoped && (
          <StatCard
            label="Blocks"
            value={overview.totalBlocks.toLocaleString()}
            icon="fas fa-th-large"
            accent="linear-gradient(135deg,#5b21b6,#8b5cf6)"
            onClick={() => setDrilldown(drilldown === 'blocks' ? null : 'blocks')}
            active={drilldown === 'blocks'}
          />
        )}
        <StatCard
          label={isSchoolScoped ? 'Your School' : 'Schools'}
          value={isSchoolScoped ? '1 School' : overview.schools.toLocaleString()}
          sub={isSchoolScoped && districtLabel ? `District: ${districtLabel}` : `${overview.virtualClassroomSchools.toLocaleString()} with Virtual`}
          icon="fas fa-school"
          accent="linear-gradient(135deg,#003087,#0076BC)"
          onClick={isSchoolScoped ? undefined : () => setDrilldown(drilldown === 'schools' ? null : 'schools')}
          active={drilldown === 'schools'}
        />
        <StatCard
          label="Students"
          value={overview.totalStudents.toLocaleString()}
          icon="fas fa-user-graduate"
          accent="linear-gradient(135deg,#065f46,#059669)"
          onClick={() => setDrilldown(drilldown === 'students' ? null : 'students')}
          active={drilldown === 'students'}
        />
        <StatCard
          label="Teachers"
          value={teacherStats ? teacherStats.totalTeachers.toLocaleString() : '…'}
          sub="ICT Lab schools"
          icon="fas fa-chalkboard-teacher"
          accent="linear-gradient(135deg,#0e7490,#06b6d4)"
          onClick={() => setDrilldown(drilldown === 'teachers' ? null : 'teachers')}
          active={drilldown === 'teachers'}
        />
        <StatCard
          label="Annual Pass Rate (APR)"
          value={`${pct(overview.avgPass10th)}`}
          sub={`Class 12: ${pct(overview.avgPass12th)}`}
          icon="fas fa-award"
          accent="linear-gradient(135deg,#b45309,#f59e0b)"
        />
      </div>

      {/* ── Drill-down panel (districts / blocks / students / teachers) ── */}
      {drilldown && <DrillPanel
        type={drilldown}
        districts={districts}
        teacherStats={teacherStats}
        drillDistrictId={drillDistrictId}
        drillBlocks={drillBlocks}
        drillBlockId={drillBlockId}
        drillSchools={drillSchools}
        onSelectDistrict={selectDrillDistrict}
        onSelectBlock={selectDrillBlock}
        onBackToDistricts={() => { setDrillDistrictId(null); setDrillBlocks([]); setDrillBlockId(null); setDrillSchools([]); }}
        onBackToBlocks={() => { setDrillBlockId(null); setDrillSchools([]); }}
        onClose={closeDrilldown}
      />}

      {/* ── Uttarakhand map — always shown below tabs/drilldown ── */}
      {districts.length > 0 && (
        <UttarakhandMap
          districts={districts}
          onDistrictClick={async (districtId) => {
            setDrilldown('schools');
            if (drillDistrictId !== districtId) {
              setDrillDistrictId(districtId);
              setDrillBlockId(null);
              setDrillSchools([]);
              setDrillBlocks(await api.blocks(districtId));
            }
          }}
        />
      )}

      {/* ── Student gender ratio (from 500 Virtual2526 enrolment) ── */}
      {enrollment && <GenderPanel data={enrollment} />}

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
                  Teachers: d.teachers,
                  Boys: d.boys,
                  Girls: d.girls,
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
            <col style={{ width: '80px' }} />
            <col style={{ width: '80px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
            <col style={{ width: '100px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">District / Block / School</th>
              <th className="text-right">Schools</th>
              <th className="text-right">Teachers</th>
              <th className="text-right">Boys</th>
              <th className="text-right">Girls</th>
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

// ── DrillPanel ────────────────────────────────────────────────────────────────

type DrillType = 'districts' | 'blocks' | 'schools' | 'students' | 'teachers';

const PANEL_META: Record<DrillType, { icon: string; iconClass: string; title: string; hint: string }> = {
  districts: { icon: 'fas fa-map',                 iconClass: 'text-blue-600',    title: 'District Overview',      hint: 'click a district to see its blocks' },
  blocks:    { icon: 'fas fa-th-large',             iconClass: 'text-violet-600',  title: 'Block Directory',        hint: 'click a district to see its blocks' },
  schools:   { icon: 'fas fa-school',               iconClass: 'text-sky-600',     title: 'School Directory',       hint: 'select district → block → schools' },
  students:  { icon: 'fas fa-user-graduate',        iconClass: 'text-emerald-600', title: 'Students by District',   hint: 'click a district to see blocks' },
  teachers:  { icon: 'fas fa-chalkboard-teacher',   iconClass: 'text-cyan-600',    title: 'Teachers by District',   hint: 'click a district to see blocks' },
};

function DrillPanel({
  type, districts, teacherStats,
  drillDistrictId, drillBlocks, drillBlockId, drillSchools,
  onSelectDistrict, onSelectBlock, onBackToDistricts, onBackToBlocks, onClose,
}: {
  type: DrillType;
  districts: DistrictSummary[];
  teacherStats: TeacherStats | null;
  drillDistrictId: string | null;
  drillBlocks: BlockSummary[];
  drillBlockId: string | null;
  drillSchools: SchoolRow[];
  onSelectDistrict: (id: string) => void;
  onSelectBlock: (id: string) => void;
  onBackToDistricts: () => void;
  onBackToBlocks: () => void;
  onClose: () => void;
}) {
  const meta = PANEL_META[type];
  const selectedDistrict = drillDistrictId
    ? districts.find((d) => d.districtId === drillDistrictId) ?? null
    : null;
  const selectedBlock = drillBlockId
    ? drillBlocks.find((b) => b.blockId === drillBlockId) ?? null
    : null;

  // Which columns to show in the district list
  const showStudentCols = type === 'districts' || type === 'students';
  const showTeacherCols = type === 'teachers';
  // 'blocks' shows a minimal district selector (Schools + Students only)

  return (
    <div className="panel overflow-hidden">
      {/* Header / breadcrumb */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-sky-50/50">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <i className={`fas flex-shrink-0 ${meta.icon.replace('fas ', '')} ${meta.iconClass}`} />
          {selectedBlock ? (
            /* Level 3 breadcrumb: Title > District > Block */
            <>
              <button onClick={onBackToDistricts} className="text-sky-500 hover:text-sky-700 text-xs font-semibold flex items-center gap-1">
                <i className="fas fa-arrow-left text-[10px]" />{meta.title}
              </button>
              <i className="fas fa-chevron-right text-slate-300 text-[10px]" />
              <button onClick={onBackToBlocks} className="text-sky-500 hover:text-sky-700 text-xs font-semibold">
                {selectedDistrict?.district}
              </button>
              <i className="fas fa-chevron-right text-slate-300 text-[10px]" />
              <span className="font-semibold text-navy-700 text-sm">{selectedBlock.block}</span>
              <span className="text-xs text-slate-400">— schools</span>
            </>
          ) : selectedDistrict ? (
            /* Level 2 breadcrumb: Title > District */
            <>
              <button onClick={onBackToDistricts} className="text-sky-500 hover:text-sky-700 text-xs font-semibold flex items-center gap-1">
                <i className="fas fa-arrow-left text-[10px]" />{meta.title}
              </button>
              <i className="fas fa-chevron-right text-slate-300 text-[10px]" />
              <span className="font-semibold text-navy-700 text-sm">{selectedDistrict.district}</span>
              <span className="text-xs text-slate-400">— {type === 'schools' ? 'select a block' : 'blocks'}</span>
            </>
          ) : (
            <h3 className="font-semibold text-navy-700 text-sm">
              {meta.title}
              <span className="ml-1.5 text-xs font-normal text-slate-400">— {meta.hint}</span>
            </h3>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm flex-shrink-0 ml-3">
          <i className="fas fa-times" />
        </button>
      </div>

      {/* ── District list ── */}
      {!selectedDistrict && (
        <table className="w-full text-sm data-table" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 'auto' }} />
            <col style={{ width: '80px' }} />
            {showStudentCols && <><col style={{ width: '110px' }} /><col style={{ width: '100px' }} /><col style={{ width: '100px' }} /></>}
            {showTeacherCols && <><col style={{ width: '110px' }} /><col style={{ width: '120px' }} /></>}
            {type === 'blocks'  && <col style={{ width: '110px' }} />}
          </colgroup>
          <thead>
            <tr>
              <th className="text-left">District</th>
              <th className="text-right">Schools</th>
              {showStudentCols && <><th className="text-right">Students</th><th className="text-right">Pass 10th</th><th className="text-right">Pass 12th</th></>}
              {showTeacherCols && <th className="text-right">Teachers</th>}
              {type === 'blocks'  && <th className="text-right">Students</th>}
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Normalise both sources into a common shape before rendering.
              type Row = {
                districtId: string; district: string; schools: number;
                totalStudents: number | null; avgPass10th: number | null; avgPass12th: number | null;
                teachers: number | null;
              };
              const rows: Row[] = type === 'teachers'
                ? (teacherStats?.byDistrict ?? [])
                    .sort((a, b) => a.district.localeCompare(b.district))
                    .map((d) => ({ districtId: d.districtId, district: d.district, schools: d.schools,
                      totalStudents: null, avgPass10th: null, avgPass12th: null,
                      teachers: d.teachers }))
                : [...districts]
                    .sort((a, b) => a.district.localeCompare(b.district))
                    .map((d) => ({ districtId: d.districtId, district: d.district, schools: d.schools,
                      totalStudents: d.totalStudents, avgPass10th: d.avgPass10th, avgPass12th: d.avgPass12th,
                      teachers: null }));

              return rows.map((row) => (
                <tr key={row.districtId} className="cursor-pointer hover:bg-sky-50/60 transition-colors" onClick={() => onSelectDistrict(row.districtId)}>
                  <td className="font-medium text-navy-700">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded mr-1.5 bg-slate-100 text-slate-400 text-[9px]">
                      <i className="fas fa-chevron-right" />
                    </span>
                    {row.district}
                  </td>
                  <td className="text-right">{row.schools}</td>
                  {showStudentCols && (
                    <>
                      <td className="text-right font-semibold">{row.totalStudents?.toLocaleString() ?? '—'}</td>
                      <td className="text-right font-semibold" style={{ color: passColor(row.avgPass10th ?? 0) }}>{pct(row.avgPass10th)}</td>
                      <td className="text-right font-semibold" style={{ color: passColor(row.avgPass12th ?? 0) }}>{pct(row.avgPass12th)}</td>
                    </>
                  )}
                  {showTeacherCols && (
                    <td className="text-right font-semibold">{row.teachers?.toLocaleString() ?? '—'}</td>
                  )}
                  {type === 'blocks' && (
                    <td className="text-right">{row.totalStudents?.toLocaleString() ?? '—'}</td>
                  )}
                </tr>
              ));
            })()}
          </tbody>
        </table>
      )}

      {/* ── Level 3: School list for selected block (schools type only) ── */}
      {selectedBlock && selectedDistrict && (
        <>
          <div className="px-5 py-2.5 bg-indigo-50 border-b border-indigo-100 flex items-center gap-3 flex-wrap text-sm">
            <i className="fas fa-map-pin text-indigo-400 text-xs" />
            <span className="font-bold text-navy-700">{selectedBlock.block}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 text-xs">{selectedDistrict.district}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 text-xs"><strong>{selectedBlock.schools}</strong> schools</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600 text-xs"><strong>{selectedBlock.totalStudents.toLocaleString()}</strong> students</span>
          </div>
          <table className="w-full text-sm data-table" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 'auto' }} />
              <col style={{ width: '80px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '100px' }} />
              <col style={{ width: '100px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="text-left">School — <span className="font-normal text-slate-400">{selectedBlock.block}, {selectedDistrict.district}</span></th>
                <th className="text-right">Virtual</th>
                <th className="text-right">Students</th>
                <th className="text-right">Pass 10th</th>
                <th className="text-right">Pass 12th</th>
              </tr>
            </thead>
            <tbody>
              {drillSchools.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400 text-xs"><i className="fas fa-circle-notch fa-spin mr-1.5" />Loading schools…</td></tr>
              ) : drillSchools.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="font-medium text-navy-700 truncate">{s.name}</div>
                    {s.udiseCode && <div className="text-[10px] text-slate-400 font-mono">{s.udiseCode}</div>}
                  </td>
                  <td className="text-right">
                    {s.hasVirtualClassroom
                      ? <span className="badge-virtual text-[10px] px-1.5 py-0.5"><i className="fas fa-video mr-1" />VC</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="text-right font-semibold">{(s.enrolledStudents ?? s.students)?.toLocaleString() ?? '—'}</td>
                  <td className="text-right font-semibold" style={s.avgPass10th != null ? { color: passColor(s.avgPass10th) } : {}}>{pct(s.avgPass10th)}</td>
                  <td className="text-right font-semibold" style={s.avgPass12th != null ? { color: passColor(s.avgPass12th) } : {}}>{pct(s.avgPass12th)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* ── Level 2: Block list for selected district ── */}
      {selectedDistrict && !selectedBlock && (() => {
        const isTeacherDrill = type === 'teachers';
        const districtTeachers = isTeacherDrill
          ? teacherStats?.byDistrict.find(d => d.districtId === drillDistrictId)?.teachers
          : null;
        return (
          <>
            <div className="px-5 py-2.5 bg-sky-50 border-b border-sky-100 flex items-center gap-3 flex-wrap text-sm">
              <i className="fas fa-map text-sky-500 text-xs" />
              <span className="font-bold text-navy-700">{selectedDistrict.district}</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600 text-xs"><strong>{selectedDistrict.schools}</strong> schools</span>
              <span className="text-slate-300">|</span>
              {isTeacherDrill ? (
                <span className="text-slate-600 text-xs"><strong>{districtTeachers?.toLocaleString() ?? '—'}</strong> teachers</span>
              ) : (
                <>
                  <span className="text-slate-600 text-xs"><strong>{selectedDistrict.totalStudents.toLocaleString()}</strong> students</span>
                  <span className="text-slate-300">|</span>
                  <span className="text-xs font-semibold" style={{ color: passColor(selectedDistrict.avgPass10th ?? 0) }}>10th: {pct(selectedDistrict.avgPass10th)}</span>
                  <span className="text-xs font-semibold" style={{ color: passColor(selectedDistrict.avgPass12th ?? 0) }}>12th: {pct(selectedDistrict.avgPass12th)}</span>
                </>
              )}
            </div>
            <table className="w-full text-sm data-table" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 'auto' }} />
                <col style={{ width: '80px' }} />
                {!isTeacherDrill && <col style={{ width: '90px' }} />}
                <col style={{ width: '110px' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="text-left">Block — <span className="font-normal text-slate-400">{selectedDistrict.district}</span></th>
                  <th className="text-right">Schools</th>
                  {!isTeacherDrill && <th className="text-right">Virtual</th>}
                  <th className="text-right">{isTeacherDrill ? 'Teachers' : 'Students'}</th>
                </tr>
              </thead>
              <tbody>
                {drillBlocks.length === 0 ? (
                  <tr><td colSpan={isTeacherDrill ? 3 : 4} className="py-6 text-center text-slate-400 text-xs"><i className="fas fa-circle-notch fa-spin mr-1.5" />Loading blocks…</td></tr>
                ) : [...drillBlocks].sort((a, b) => a.block.localeCompare(b.block)).map((b) => (
                  <tr
                    key={b.blockId}
                    className={type === 'schools' ? 'cursor-pointer hover:bg-sky-50/60 transition-colors' : ''}
                    onClick={type === 'schools' ? () => onSelectBlock(b.blockId) : undefined}
                  >
                    <td className="text-slate-700">
                      {type === 'schools' && (
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded mr-1.5 bg-slate-100 text-slate-400 text-[9px]">
                          <i className="fas fa-chevron-right" />
                        </span>
                      )}
                      <i className="fas fa-map-pin text-sky-400 mr-1.5 text-xs" />
                      <span className="font-medium">{b.block}</span>
                      <span className="ml-1.5 text-xs text-slate-400">{selectedDistrict.district}</span>
                    </td>
                    <td className="text-right">{b.schools}</td>
                    {!isTeacherDrill && <td className="text-right">{b.virtualClassroomSchools}</td>}
                    <td className="text-right font-semibold">
                      {isTeacherDrill ? (b.teachers ?? 0).toLocaleString() : b.totalStudents.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        );
      })()}
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
    if (openBlock === blockId) { setOpenBlock(null); setBlockSchools([]); return; }
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
        <td className="text-right font-medium">{d.teachers > 0 ? d.teachers.toLocaleString() : '—'}</td>
        <td className="text-right text-blue-600 font-medium">{d.boys > 0 ? d.boys.toLocaleString() : '—'}</td>
        <td className="text-right text-pink-600 font-medium">{d.girls > 0 ? d.girls.toLocaleString() : '—'}</td>
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
              {/* Block name + district breadcrumb */}
              <span className="font-medium">{b.block}</span>
              <span className="ml-1.5 text-xs text-slate-400">{d.district}</span>
            </td>
            <td className="text-right text-slate-500 font-medium">{b.schools}</td>
            <td className="text-right text-slate-500 font-medium">{b.teachers > 0 ? b.teachers.toLocaleString() : '—'}</td>
            <td className="text-right text-blue-500 font-medium">{b.boys > 0 ? b.boys.toLocaleString() : '—'}</td>
            <td className="text-right text-pink-500 font-medium">{b.girls > 0 ? b.girls.toLocaleString() : '—'}</td>
            <td className="text-right text-slate-500">{b.totalStudents.toLocaleString()}</td>
            <td className="text-right font-semibold" style={b.avgPass10th != null ? { color: passColor(b.avgPass10th) } : {}}>
              {pct(b.avgPass10th)}
            </td>
            <td className="text-right font-semibold" style={b.avgPass12th != null ? { color: passColor(b.avgPass12th) } : {}}>
              {pct(b.avgPass12th)}
            </td>
          </tr>

          {/* School rows under this block */}
          {openBlock === b.blockId && (
            loadingBlock ? (
              <tr>
                <td colSpan={8} className="pl-20 py-2 text-xs text-slate-400">
                  <i className="fas fa-circle-notch fa-spin mr-1" />Loading schools…
                </td>
              </tr>
            ) : blockSchools.map((s) => (
              <tr key={s.id} className="bg-blue-50/30 text-slate-600 text-xs">
                <td className="pl-20">
                  <i className="fas fa-school text-slate-300 mr-1.5" />
                  <span className="font-medium text-slate-700">{s.name}</span>
                  {/* School → breadcrumb: District > Block */}
                  <span className="ml-1.5 text-slate-400 text-[10px]">
                    {d.district} › {b.block}
                  </span>
                  {s.udiseCode && (
                    <span className="ml-1.5 text-slate-300 font-mono">{s.udiseCode}</span>
                  )}
                </td>
                <td className="text-right text-slate-400">—</td>
                <td className="text-right text-slate-400 text-[11px]">
                  {s.teachers != null ? s.teachers.toLocaleString() : '—'}
                </td>
                <td className="text-right text-blue-400 text-[11px]">{s.boys != null && s.boys > 0 ? s.boys.toLocaleString() : '—'}</td>
                <td className="text-right text-pink-400 text-[11px]">{s.girls != null && s.girls > 0 ? s.girls.toLocaleString() : '—'}</td>
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
