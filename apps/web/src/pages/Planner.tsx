import { useState, useMemo } from 'react';
import {
  SCHEDULE, HOLIDAYS, EVENTS, STUDIO_LABELS, SUBJECT_COLOR,
  type ScheduleSession, type Holiday, type SchoolEvent,
} from '../data/schedule';

// ─── helpers ──────────────────────────────────────────────────────────────────

const JUNE_DAYS = 30;
const JUNE_START_DOW = 1; // Monday (0=Sun)

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function holidayForDate(date: string): Holiday | undefined {
  return HOLIDAYS.find(h => h.date === date);
}

function pad2(d: number) { return String(d).padStart(2, '0'); }
function dateKey(y: number, m: number, d: number) { return `${y}-${pad2(m)}-${pad2(d)}`; }

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const TIME_SLOTS = ['10:00-10:40','10:40-11:20','11:20-12:00','12:00-12:40'];

const HOLIDAY_COLOR: Record<string,string> = {
  weekly:       'bg-red-100 text-red-700 border-red-300',
  national:     'bg-orange-100 text-orange-700 border-orange-300',
  institutional:'bg-amber-100 text-amber-700 border-amber-300',
};

const EVENT_TYPE_COLOR: Record<string,string> = {
  ceremony:   'bg-violet-100 text-violet-700 border-violet-300',
  workshop:   'bg-sky-100 text-sky-700 border-sky-300',
  assessment: 'bg-rose-100 text-rose-700 border-rose-300',
  meeting:    'bg-teal-100 text-teal-700 border-teal-300',
  other:      'bg-slate-100 text-slate-600 border-slate-300',
};

// ─── Calendar Widget ───────────────────────────────────────────────────────────

function CalendarWidget() {
  const [selected, setSelected] = useState<string | null>(null);

  const today = new Date();
  const todayKey = dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());

  // Build grid: blank leading cells + day cells
  const cells: Array<{ day: number | null; key: string | null }> = [];
  for (let i = 0; i < JUNE_START_DOW; i++) cells.push({ day: null, key: null });
  for (let d = 1; d <= JUNE_DAYS; d++) cells.push({ day: d, key: dateKey(2026, 6, d) });

  const nextHoliday = HOLIDAYS.find(h => h.date >= todayKey);

  return (
    <div className="space-y-4">
      {/* Next holiday banner */}
      {nextHoliday && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-2xl">🗓️</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Next Upcoming Holiday</p>
            <p className="font-bold text-amber-800 text-sm leading-tight">{nextHoliday.name}</p>
            <p className="text-xs text-amber-600">{fmtDate(nextHoliday.date)}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${HOLIDAY_COLOR[nextHoliday.type]}`}>
            {nextHoliday.type}
          </span>
        </div>
      )}

      {/* Month header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-700 text-lg">June 2026</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 border border-red-400 inline-block" /> Weekend</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-200 border border-orange-400 inline-block" /> National</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-200 border border-amber-400 inline-block" /> Institutional</span>
        </div>
      </div>

      {/* Grid header */}
      <div className="grid grid-cols-7 gap-1.5">
        {DAY_NAMES.map(d => (
          <div key={d} className={`text-xs font-bold text-center py-1.5 ${d === 'Sun' ? 'text-red-500' : 'text-slate-500'}`}>{d}</div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.key || !cell.day) return <div key={`blank-${i}`} className="rounded-lg" />;
          const holiday = holidayForDate(cell.key);
          const isSelected = selected === cell.key;
          const isToday = cell.key === todayKey;
          const eventsOnDay = EVENTS.filter(e => e.date === cell.key);
          const isWorkingDay = !holiday;

          let bg = 'bg-white hover:bg-sky-50';
          let border = 'border-slate-200';
          let labelText = '';
          let labelCls = '';
          if (holiday?.type === 'weekly') {
            bg = 'bg-red-50 hover:bg-red-100'; border = 'border-red-200';
            labelText = holiday.name === 'Sunday' ? 'Sunday' : holiday.name;
            labelCls = 'text-red-500';
          } else if (holiday?.type === 'national') {
            bg = 'bg-orange-50 hover:bg-orange-100'; border = 'border-orange-200';
            labelText = holiday.name; labelCls = 'text-orange-600';
          } else if (holiday?.type === 'institutional') {
            bg = 'bg-amber-50 hover:bg-amber-100'; border = 'border-amber-200';
            labelText = 'Camp Holiday'; labelCls = 'text-amber-600';
          }
          if (isSelected) border = 'border-sky-500 ring-2 ring-sky-300';

          return (
            <button
              key={cell.key}
              onClick={() => setSelected(cell.key === selected ? null : cell.key)}
              className={`relative rounded-xl border ${bg} ${border} px-1.5 pt-2 pb-1.5 text-left transition-all cursor-pointer flex flex-col gap-1 min-h-[80px]`}
            >
              {/* Day number */}
              <span className={`text-sm font-bold leading-none self-center ${isToday ? 'bg-sky-600 text-white rounded-full w-6 h-6 flex items-center justify-center' : holiday ? labelCls : 'text-slate-700'}`}>
                {cell.day}
              </span>
              {/* Label */}
              {holiday && (
                <span className={`text-[9px] font-bold leading-tight text-center w-full break-words ${labelCls}`}>
                  {labelText}
                </span>
              )}
              {isWorkingDay && (
                <span className="text-[9px] text-emerald-500 font-semibold text-center w-full">
                  Camp Day
                </span>
              )}
              {/* Event dots */}
              {eventsOnDay.length > 0 && (
                <span className="flex gap-0.5 justify-center mt-auto">
                  {eventsOnDay.map(e => (
                    <span key={e.id} className={`w-1.5 h-1.5 rounded-full ${e.urgent ? 'bg-rose-500 animate-pulse' : 'bg-sky-400'}`} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      {selected && (() => {
        const holiday = holidayForDate(selected);
        const eventsOnDay = EVENTS.filter(e => e.date === selected);
        return (
          <div className="border rounded-xl p-4 bg-slate-50 space-y-2">
            <p className="font-bold text-slate-700">{fmtDate(selected)}</p>
            {holiday ? (
              <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${HOLIDAY_COLOR[holiday.type]}`}>
                <i className="fas fa-calendar-times mt-0.5" />
                <div>
                  <p className="font-semibold">{holiday.name}</p>
                  {holiday.description && <p className="text-xs opacity-80">{holiday.description}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-emerald-600 flex items-center gap-1"><i className="fas fa-check-circle" /> Regular session day</p>
            )}
            {eventsOnDay.map(ev => (
              <div key={ev.id} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${EVENT_TYPE_COLOR[ev.type] ?? EVENT_TYPE_COLOR.other}`}>
                <i className={`fas fa-${ev.type === 'ceremony' ? 'star' : ev.type === 'workshop' ? 'tools' : ev.type === 'assessment' ? 'clipboard-list' : 'info-circle'} mt-0.5`} />
                <div>
                  <p className="font-semibold flex items-center gap-1">{ev.title}{ev.urgent && <span className="text-xs bg-rose-500 text-white rounded px-1">Urgent</span>}</p>
                  <p className="text-xs opacity-80">{ev.time} {ev.studio ? `· Studio ${ev.studio}` : ''}</p>
                </div>
              </div>
            ))}
            {!holiday && eventsOnDay.length === 0 && <p className="text-xs text-slate-400">No special events today.</p>}
          </div>
        );
      })()}

      {/* Holiday legend table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-700 text-white text-xs font-semibold px-4 py-2">Holiday List — June 2026</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="text-left px-4 py-2 font-semibold text-slate-600">Date</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-600">Holiday Name</th>
              <th className="text-left px-4 py-2 font-semibold text-slate-600">Type</th>
            </tr>
          </thead>
          <tbody>
            {HOLIDAYS.map(h => (
              <tr key={h.date} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 text-slate-700">{fmtDate(h.date)}</td>
                <td className="px-4 py-2 text-slate-700">{h.name}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${HOLIDAY_COLOR[h.type]}`}>{h.type}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── School Planner ────────────────────────────────────────────────────────────

function subjectColor(subject: string): string {
  return SUBJECT_COLOR[subject] ?? '#64748b';
}

function SubjectChip({ subject, teacher }: { subject: string; teacher: string }) {
  const color = subjectColor(subject);
  return (
    <div
      className="rounded-lg px-2 py-1.5 text-white text-xs font-semibold shadow-sm"
      style={{ backgroundColor: color }}
      title={`${subject} — ${teacher}`}
    >
      <p className="leading-tight truncate">{subject}</p>
      <p className="text-white/80 text-[10px] leading-tight truncate">{teacher}</p>
    </div>
  );
}

// Working days in June 2026 (skip holidays)
const OFF_DATES = new Set(HOLIDAYS.map(h => h.date));
const WORKING_DAYS: string[] = [];
for (let d = 1; d <= JUNE_DAYS; d++) {
  const key = dateKey(2026, 6, d);
  if (!OFF_DATES.has(key)) WORKING_DAYS.push(key);
}

function SchoolPlanner() {
  const [studio, setStudio] = useState<1|2|3|4>(1);
  const [view, setView] = useState<'daily'|'weekly'>('daily');
  // Default to today if it's a working day, else nearest future working day
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const today = new Date();
    const key = dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
    return WORKING_DAYS.find(d => d >= key) ?? WORKING_DAYS[0] ?? '2026-06-01';
  });

  // Week containing selected date
  const weekStart = useMemo(() => {
    const dt = new Date(selectedDate + 'T00:00:00');
    const dow = dt.getDay(); // 0=Sun
    const start = new Date(dt);
    start.setDate(dt.getDate() - (dow === 0 ? 6 : dow - 1)); // align to Monday
    return start;
  }, [selectedDate]);

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return dateKey(d.getFullYear(), d.getMonth() + 1, d.getDate());
    });
  }, [weekStart]);

  const studioSessions = useMemo(() => SCHEDULE.filter(s => s.studio === studio), [studio]);

  function sessionsFor(date: string, slot: string): ScheduleSession | undefined {
    return studioSessions.find(s => s.date === date && s.timeSlot === slot);
  }

  function prevDay() {
    const idx = WORKING_DAYS.indexOf(selectedDate);
    if (idx > 0) setSelectedDate(WORKING_DAYS[idx - 1]);
  }
  function nextDay() {
    const idx = WORKING_DAYS.indexOf(selectedDate);
    if (idx < WORKING_DAYS.length - 1) setSelectedDate(WORKING_DAYS[idx + 1]);
  }

  const isOffDay = (date: string) => OFF_DATES.has(date);

  return (
    <div className="space-y-4">
      {/* Studio tabs */}
      <div className="flex flex-wrap gap-2">
        {([1,2,3,4] as const).map(s => (
          <button
            key={s}
            onClick={() => setStudio(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              studio === s
                ? 'bg-sky-600 text-white border-sky-600 shadow'
                : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300 hover:text-sky-600'
            }`}
          >
            <i className="fas fa-tv mr-1.5" />
            {STUDIO_LABELS[s]}
          </button>
        ))}
      </div>

      {/* View toggle + date nav */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setView('daily')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${view === 'daily' ? 'bg-white text-sky-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fas fa-calendar-day mr-1.5" />Daily
          </button>
          <button
            onClick={() => setView('weekly')}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${view === 'weekly' ? 'bg-white text-sky-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <i className="fas fa-calendar-week mr-1.5" />Weekly
          </button>
        </div>

        {view === 'daily' && (
          <div className="flex items-center gap-2">
            <button onClick={prevDay} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <i className="fas fa-chevron-left text-xs" />
            </button>
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 bg-white"
            >
              {WORKING_DAYS.map(d => (
                <option key={d} value={d}>
                  {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </option>
              ))}
            </select>
            <button onClick={nextDay} className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600">
              <i className="fas fa-chevron-right text-xs" />
            </button>
          </div>
        )}

        {view === 'weekly' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const prev = new Date(weekStart);
                prev.setDate(prev.getDate() - 7);
                const key = dateKey(prev.getFullYear(), prev.getMonth() + 1, prev.getDate());
                const found = WORKING_DAYS.find(d => d >= key);
                if (found) setSelectedDate(found);
              }}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            >
              <i className="fas fa-chevron-left text-xs" />
            </button>
            <span className="text-sm font-semibold text-slate-700 px-2">
              Week of {fmtDate(weekDates[0])}
            </span>
            <button
              onClick={() => {
                const next = new Date(weekStart);
                next.setDate(next.getDate() + 7);
                const key = dateKey(next.getFullYear(), next.getMonth() + 1, next.getDate());
                const found = WORKING_DAYS.find(d => d >= key);
                if (found) setSelectedDate(found);
              }}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
            >
              <i className="fas fa-chevron-right text-xs" />
            </button>
          </div>
        )}
      </div>

      {/* ── Daily view ── */}
      {view === 'daily' && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-5 py-3 bg-slate-700 text-white flex items-center justify-between">
            <span className="font-bold">
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-sky-300 text-sm font-semibold">{STUDIO_LABELS[studio]}</span>
          </div>
          {isOffDay(selectedDate) ? (
            <div className="py-16 text-center text-slate-400">
              <i className="fas fa-calendar-times text-3xl mb-2 text-red-400" />
              <p className="font-semibold text-slate-600">{holidayForDate(selectedDate)?.name ?? 'Holiday'}</p>
              <p className="text-sm">No sessions scheduled today.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-36">Time Slot</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Subject</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Teacher</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class Group</th>
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, i) => {
                  const sess = sessionsFor(selectedDate, slot);
                  return (
                    <tr key={slot} className={`border-t border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                      <td className="px-5 py-3 font-mono text-sm font-semibold text-slate-600">{slot}</td>
                      <td className="px-5 py-3">
                        {sess ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-white text-sm font-semibold"
                            style={{ backgroundColor: subjectColor(sess.subject) }}
                          >
                            {sess.subject}
                          </span>
                        ) : <span className="text-slate-300 text-sm">—</span>}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-700">{sess?.teacher ?? '—'}</td>
                      <td className="px-5 py-3 text-sm text-slate-600">{sess?.classGroup ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Weekly view ── */}
      {view === 'weekly' && (
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="px-5 py-3 bg-slate-700 text-white flex items-center justify-between">
            <span className="font-bold">Weekly Schedule — {STUDIO_LABELS[studio]}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '110px' }} />
                {weekDates.map(d => <col key={d} />)}
              </colgroup>
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Time</th>
                  {weekDates.map(d => {
                    const dt = new Date(d + 'T00:00:00');
                    const off = isOffDay(d);
                    return (
                      <th key={d} className={`text-center px-2 py-2 text-xs font-semibold uppercase tracking-wide ${off ? 'text-red-400 bg-red-50' : 'text-slate-500'}`}>
                        <span>{DAY_NAMES[dt.getDay()]}</span>
                        <span className="block text-sm font-bold">{dt.getDate()}</span>
                        {off && <span className="text-[10px] font-normal normal-case">Holiday</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot, si) => (
                  <tr key={slot} className={`border-t border-slate-100 ${si % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-slate-500 whitespace-nowrap">{slot}</td>
                    {weekDates.map(d => {
                      const off = isOffDay(d);
                      if (off) return <td key={d} className="px-2 py-2 bg-red-50 text-center"><span className="text-red-300 text-xs">—</span></td>;
                      const sess = sessionsFor(d, slot);
                      return (
                        <td key={d} className="px-2 py-2">
                          {sess ? <SubjectChip subject={sess.subject} teacher={sess.teacher} /> : <span className="text-slate-200 text-xs text-center block">—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subject legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(SUBJECT_COLOR).map(([name, color]) => (
          <span key={name} className="flex items-center gap-1.5 text-xs font-semibold text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: color }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Event Notifications ───────────────────────────────────────────────────────

function EventNotifications() {
  const [filter, setFilter] = useState<'all'|'urgent'|'ceremony'|'workshop'|'assessment'|'meeting'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === 'urgent') return EVENTS.filter(e => e.urgent);
    if (filter === 'all') return EVENTS;
    return EVENTS.filter(e => e.type === filter);
  }, [filter]);

  const urgentCount = EVENTS.filter(e => e.urgent).length;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all','urgent','ceremony','workshop','assessment','meeting'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              filter === f
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {f === 'urgent' && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}
            {f === 'all' ? 'All Events' : f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'urgent' && urgentCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] rounded-full px-1 min-w-[16px] text-center">{urgentCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Event cards */}
      <div className="space-y-3">
        {filtered.map(ev => {
          const expanded = expandedId === ev.id;
          const colors = EVENT_TYPE_COLOR[ev.type] ?? EVENT_TYPE_COLOR.other;
          return (
            <div
              key={ev.id}
              className={`rounded-xl border-l-4 border border-slate-200 bg-white overflow-hidden transition-all ${ev.urgent ? 'border-l-rose-500' : 'border-l-sky-400'}`}
            >
              <button
                className="w-full text-left px-5 py-4 flex items-start gap-3"
                onClick={() => setExpandedId(expanded ? null : ev.id)}
              >
                <div className="mt-0.5 shrink-0">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm ${colors}`}>
                    <i className={`fas fa-${
                      ev.type === 'ceremony' ? 'star' :
                      ev.type === 'workshop' ? 'tools' :
                      ev.type === 'assessment' ? 'clipboard-list' :
                      ev.type === 'meeting' ? 'users' : 'info-circle'
                    }`} />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-800 text-sm">{ev.title}</span>
                    {ev.urgent && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-2 py-0.5 animate-pulse">
                        <i className="fas fa-exclamation-triangle" /> URGENT
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${colors}`}>{ev.type}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><i className="fas fa-calendar" /> {fmtDate(ev.date)}</span>
                    <span className="flex items-center gap-1"><i className="fas fa-clock" /> {ev.time}</span>
                    {ev.studio && <span className="flex items-center gap-1"><i className="fas fa-tv" /> Studio {ev.studio}</span>}
                  </div>
                </div>
                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-slate-400 text-xs mt-1 shrink-0`} />
              </button>
              {expanded && (
                <div className="px-5 pb-4 pt-0 border-t border-slate-100 bg-slate-50/50">
                  <p className="text-sm text-slate-600 leading-relaxed pt-3">{ev.description}</p>
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <i className="fas fa-bell-slash text-3xl mb-2" />
            <p className="font-semibold text-slate-500">No events found</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Planner Page ─────────────────────────────────────────────────────────

type Tab = 'calendar' | 'planner' | 'events';

const TABS: Array<{ id: Tab; label: string; icon: string; badge?: number }> = [
  { id: 'calendar', label: 'Holiday Calendar',     icon: 'fas fa-calendar-alt' },
  { id: 'planner',  label: 'Lecture Schedule',     icon: 'fas fa-chalkboard-teacher' },
  { id: 'events',   label: 'Event Notifications',  icon: 'fas fa-bell', badge: EVENTS.filter(e => e.urgent).length },
];

export function Planner() {
  const [tab, setTab] = useState<Tab>('calendar');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 font-heading">Summer Camp 2026</h1>
          <p className="text-sm text-slate-500 mt-0.5">June 2026 · 4 Studios · Scheduled by Valuable Group</p>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2">
          <i className="fas fa-sun text-amber-500" />
          <span className="text-sm font-bold text-emerald-700">Summer Camp</span>
          <span className="text-xs text-emerald-500 ml-1">1–30 Jun 2026</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 shadow-sm w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.id
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <i className={t.icon} />
            {t.label}
            {t.badge != null && t.badge > 0 && (
              <span className={`text-[10px] font-bold rounded-full px-1.5 min-w-[18px] text-center ${tab === t.id ? 'bg-white/30 text-white' : 'bg-rose-500 text-white'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        {tab === 'calendar' && <CalendarWidget />}
        {tab === 'planner'  && <SchoolPlanner />}
        {tab === 'events'   && <EventNotifications />}
      </div>
    </div>
  );
}
