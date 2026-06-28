import React, { useRef, useState } from 'react';
import type { DistrictSummary } from '@edubeam/shared';

interface Props {
  districts: DistrictSummary[];
  onDistrictClick?: (districtId: string) => void;
}

// SVG viewBox of the administrative map: 0 0 623.622 666.142
// Hover-area centers taken from the original number-label positions in the SVG.
// Colors match the district fills in the SVG (st0–st10 CSS classes, extended for 12 & 13).
const DISTRICT_CONFIG = [
  { num: 1,  key: 'uttarkashi',  name: 'Uttarkashi',        cx: 175.6, cy: 123.7, color: '#A8D5A2' },
  { num: 2,  key: 'chamoli',     name: 'Chamoli',           cx: 345.9, cy: 218.9, color: '#8EC6E6' },
  { num: 3,  key: 'rudraprayag', name: 'Rudraprayag',       cx: 255.3, cy: 208.8, color: '#F4A7B4' },
  { num: 4,  key: 'tehri',       name: 'Tehri Garhwal',     cx: 160.0, cy: 232.1, color: '#F9C4A4' },
  { num: 5,  key: 'dehradun',    name: 'Dehradun',          cx: 54.7,  cy: 226.4, color: '#8DC48D' },
  { num: 6,  key: 'pauri',       name: 'Pauri Garhwal',     cx: 203.1, cy: 338.4, color: '#B8D9AA' },
  { num: 7,  key: 'pithoragarh', name: 'Pithoragarh',       cx: 490.2, cy: 284.8, color: '#F0A0B8' },
  { num: 8,  key: 'bageshwar',   name: 'Bageshwar',         cx: 398.3, cy: 311.7, color: '#A8DCFA' },
  { num: 9,  key: 'almora',      name: 'Almora',            cx: 328.6, cy: 370.4, color: '#B8AED8' },
  { num: 10, key: 'champawat',   name: 'Champawat',         cx: 422.9, cy: 450.6, color: '#F0E870' },
  { num: 11, key: 'nainital',    name: 'Nainital',          cx: 316.3, cy: 443.9, color: '#E8D85A' },
  { num: 12, key: 'usn',         name: 'Udham Singh Nagar', cx: 329.3, cy: 509.3, color: '#98D898' },
  { num: 13, key: 'haridwar',    name: 'Haridwar',          cx: 59.8,  cy: 329.1, color: '#D4A8D4' },
] as const;

const NAME_MAP: Record<string, string> = {
  uttarkashi:       'uttarkashi',
  chamoli:          'chamoli',
  pithoragarh:      'pithoragarh',
  tehrigarhwal:     'tehri',
  tehrigarhval:     'tehri',
  rudraprayag:      'rudraprayag',
  rudrapryag:       'rudraprayag',
  dehradun:         'dehradun',
  paurigarhwal:     'pauri',
  paurigarhval:     'pauri',
  haridwar:         'haridwar',
  hardwar:          'haridwar',
  bageshwar:        'bageshwar',
  almora:           'almora',
  champawat:        'champawat',
  nainital:         'nainital',
  udhamsighnagar:   'usn',
  udhamsinghnagar:  'usn',
  ussagarnagar:     'usn',
  usnagar:          'usn',
};

// Single fluorescent-green marker color (markers no longer use per-district fills,
// which merged into the pastel map background).
const NEON = '#39FF14';

function normKey(s: string) {
  return s.toLowerCase().replace(/[\s.'-]/g, '');
}

interface TipState { key: string; x: number; y: number }

export function UttarakhandMap({ districts, onDistrictClick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);

  const districtByKey: Record<string, DistrictSummary> = {};
  for (const d of districts) {
    const k = NAME_MAP[normKey(d.district)] ?? normKey(d.district);
    districtByKey[k] = d;
  }

  // Only count districts that match this map's known UK districts
  const knownKeys = new Set<string>(DISTRICT_CONFIG.map(d => d.key));
  const mappedDistricts = districts.filter(d => {
    const k = NAME_MAP[normKey(d.district)] ?? normKey(d.district);
    return knownKeys.has(k);
  });
  const totalSchools  = mappedDistricts.reduce((s, d) => s + d.schools, 0);
  const totalStudents = mappedDistricts.reduce((s, d) => s + d.totalStudents, 0);
  const pct = (v: number | null | undefined) =>
    v == null ? '—' : `${(v * 100).toFixed(1)}%`;

  const hovered = tip ? districtByKey[tip.key] : null;
  const hoveredConfig = tip ? DISTRICT_CONFIG.find(d => d.key === tip.key) : null;

  function onEnter(e: React.MouseEvent, key: string) {
    if (!wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setTip({ key, x: e.clientX - r.left, y: e.clientY - r.top });
  }
  function onMove(e: React.MouseEvent) {
    if (!tip || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    setTip(t => t ? { ...t, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  }

  return (
    <div className="panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading font-semibold text-navy-700">
              Uttarakhand — Active Schools
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            District-wise installation view · {districts.length} districts · hover districts for details
          </p>
        </div>
      </div>

      {/* Map + legend row */}
      <div className="flex gap-0 bg-gradient-to-br from-slate-50 to-blue-50 min-h-0">

        {/* Map area */}
        <div
          ref={wrapRef}
          className="relative flex-1 flex justify-center items-start py-4 px-4 min-w-0"
          onMouseLeave={() => setTip(null)}
          onMouseMove={onMove}
        >
          {/* Tooltip */}
          {tip && hovered && hoveredConfig && (
            <div
              className="pointer-events-none absolute z-20 bg-white border border-slate-200 rounded-2xl shadow-xl px-4 py-3"
              style={{
                left: tip.x + 16,
                top: tip.y - 10,
                minWidth: 220,
                transform: tip.x > (wrapRef.current?.offsetWidth ?? 600) * 0.55
                  ? 'translateX(-110%)' : undefined,
              }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="w-3 h-3 rounded-full border border-white shadow-sm shrink-0"
                  style={{ background: hoveredConfig.color }}
                />
                <span className="font-bold text-slate-800 text-[15px]">{hovered.district}</span>
                <span className="ml-auto bg-emerald-100 text-emerald-700 text-[11px] font-bold px-2 py-0.5 rounded-full">Active</span>
              </div>
              <div className="space-y-1 text-[13px] text-slate-700">
                <div className="flex items-center gap-2">
                  <i className="fas fa-school text-blue-400 w-4" />
                  <span><strong>{hovered.schools}</strong> schools active</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-user-graduate text-emerald-400 w-4" />
                  <span><strong>{hovered.totalStudents.toLocaleString()}</strong> students enrolled</span>
                </div>
                <div className="flex items-center gap-2">
                  <i className="fas fa-award text-amber-400 w-4" />
                  <span>Pass 10th: <strong>{pct(hovered.avgPass10th)}</strong> · 12th: <strong>{pct(hovered.avgPass12th)}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Base map image */}
          <div className="relative w-full" style={{ maxWidth: 520 }}>
            <img
              src="/uk-map.svg"
              alt="Uttarakhand districts map"
              className="w-full h-auto select-none"
              draggable={false}
            />

            {/* Invisible hover-area overlay — same viewBox as the SVG */}
            <svg
              viewBox="0 0 623.622 666.142"
              className="absolute inset-0 w-full h-full"
              style={{ top: 0, left: 0 }}
            >
              <style>{`
                @keyframes ukRadar {
                  0%   { r: 11px; opacity: 0.7; }
                  70%  { opacity: 0; }
                  100% { r: 34px; opacity: 0; }
                }
                @keyframes ukRadar2 {
                  0%   { r: 11px; opacity: 0.5; }
                  70%  { opacity: 0; }
                  100% { r: 28px; opacity: 0; }
                }
                @keyframes ukGlow {
                  0%, 100% { filter: drop-shadow(0 0 2px ${NEON}) drop-shadow(0 0 4px ${NEON}); }
                  50%      { filter: drop-shadow(0 0 5px ${NEON}) drop-shadow(0 0 9px ${NEON}); }
                }
                .uk-radar  { animation: ukRadar  2.4s ease-out infinite; }
                .uk-radar2 { animation: ukRadar2 2.4s ease-out infinite; }
                .uk-pin    { animation: ukGlow 1.8s ease-in-out infinite; }
                .uk-grp:hover .uk-radar,
                .uk-grp:hover .uk-radar2 { animation-duration: 1.1s; }
              `}</style>

              <defs>
                <radialGradient id="ukg-neon" cx="38%" cy="32%" r="75%">
                  <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="30%"  stopColor="#9dff6b" stopOpacity="1" />
                  <stop offset="100%" stopColor={NEON} stopOpacity="1" />
                </radialGradient>
              </defs>

              {DISTRICT_CONFIG.map((d, i) => {
                const isHovered = tip?.key === d.key;
                const delay = `${(i % 7) * 0.28}s`;
                return (
                  <g
                    key={d.key}
                    className="uk-grp"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => onEnter(e, d.key)}
                    onClick={() => {
                      const data = districtByKey[d.key];
                      if (data && onDistrictClick) onDistrictClick(data.districtId);
                    }}
                  >
                    {/* Large invisible hit area */}
                    <circle cx={d.cx} cy={d.cy} r={30} fill="transparent" />

                    {/* Radar pulse rings — the "live location" effect */}
                    <circle
                      cx={d.cx} cy={d.cy} r={11}
                      fill="none" stroke={NEON} strokeWidth={3}
                      className="uk-radar"
                      style={{ animationDelay: delay }}
                      pointerEvents="none"
                    />
                    <circle
                      cx={d.cx} cy={d.cy} r={11}
                      fill="none" stroke="#eaffd6" strokeWidth={1.5}
                      className="uk-radar2"
                      style={{ animationDelay: delay }}
                      pointerEvents="none"
                    />

                    {/* Glowing fluorescent-green pin */}
                    <circle
                      cx={d.cx} cy={d.cy}
                      r={isHovered ? 14 : 11}
                      fill="url(#ukg-neon)"
                      stroke={isHovered ? '#0a3d0a' : '#ffffff'}
                      strokeWidth={isHovered ? 2.5 : 2}
                      className={isHovered ? undefined : 'uk-pin'}
                      style={{ animationDelay: delay, transition: 'r 0.15s' }}
                      pointerEvents="none"
                    />
                    <text
                      x={d.cx}
                      y={d.cy + 4}
                      textAnchor="middle"
                      fontSize={isHovered ? 12 : 11}
                      fontWeight="800"
                      fontFamily="system-ui,sans-serif"
                      fill="#0a3d0a"
                      pointerEvents="none"
                      style={{ userSelect: 'none' }}
                    >
                      {d.num}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* District legend panel */}
        <div className="w-52 shrink-0 border-l border-slate-100 py-4 px-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Districts</p>
          <div className="space-y-1">
            {DISTRICT_CONFIG.map(d => {
              const data = districtByKey[d.key];
              const isHov = tip?.key === d.key;
              return (
                <div
                  key={d.key}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-default transition-colors ${
                    isHov ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                  onMouseEnter={e => {
                    if (!wrapRef.current) return;
                    const r = wrapRef.current.getBoundingClientRect();
                    setTip({ key: d.key, x: e.clientX - r.left - 220, y: e.clientY - r.top });
                  }}
                  onMouseLeave={() => setTip(null)}
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 border border-white shadow-sm"
                    style={{ background: d.color }}
                  />
                  <span className="text-[11px] font-medium text-slate-500 w-4 shrink-0">{d.num}.</span>
                  <span className={`text-[12px] leading-tight ${isHov ? 'font-bold text-slate-800' : 'text-slate-600'}`}>
                    {d.name}
                  </span>
                  {data && (
                    <span className="ml-auto text-[11px] font-semibold text-blue-600 shrink-0">
                      {data.schools}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 text-right">schools →</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 border-t border-slate-100">
        {[
          { icon: 'fas fa-school',         bg: '#eff6ff', color: '#1d4ed8', value: totalSchools.toLocaleString(),  label: 'Active Schools',    sub: 'Across Uttarakhand' },
          { icon: 'fas fa-map-marker-alt', bg: '#f0fdf4', color: '#15803d', value: String(mappedDistricts.length), label: 'Districts',         sub: 'All covered' },
          { icon: 'fas fa-user-graduate',  bg: '#fffbeb', color: '#d97706', value: totalStudents.toLocaleString(), label: 'Students Enrolled', sub: '2025–26 session' },
          { icon: 'fas fa-clock',          bg: '#faf5ff', color: '#7c3aed',
            value: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
            label: 'Last Refreshed',
            sub: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) },
        ].map((s, i) => (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < 3 ? 'border-r border-slate-100' : ''}`}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0" style={{ background: s.bg }}>
              <i className={s.icon} style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-lg font-extrabold leading-none" style={{ color: s.color }}>{s.value}</div>
              <div className="text-[11px] font-semibold text-slate-600 mt-0.5">{s.label}</div>
              <div className="text-[10px] text-slate-400">{s.sub}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
