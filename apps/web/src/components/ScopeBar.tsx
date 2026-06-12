import { useEffect, useState } from 'react';
import type { DistrictSummary } from '@edubeam/shared';
import { api, type BlockSummary, type SchoolRow } from '../api';
import { useAuth } from '../auth';

export interface Scope {
  districtId?: string;
  blockId?: string;
  schoolId?: string;
}

/**
 * District → Block → School drill-down selector. Only rendered for users who can
 * see more than one school (admin / state / district). School-level users are
 * pinned to their own school server-side, so the bar is hidden for them.
 */
export function ScopeBar({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const { user } = useAuth();
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [blocks, setBlocks] = useState<BlockSummary[]>([]);
  const [schools, setSchools] = useState<SchoolRow[]>([]);

  const canPick = user?.role === 'ADMIN' || user?.role === 'STATE_OFFICIAL' || user?.role === 'DISTRICT_OFFICIAL';

  useEffect(() => {
    if (canPick) api.districts().then(setDistricts).catch(() => setDistricts([]));
  }, [canPick]);

  useEffect(() => {
    if (value.districtId) api.blocks(value.districtId).then(setBlocks).catch(() => setBlocks([]));
    else setBlocks([]);
  }, [value.districtId]);

  useEffect(() => {
    if (value.districtId || value.blockId)
      api.schools({ districtId: value.districtId, blockId: value.blockId }).then(setSchools).catch(() => setSchools([]));
    else setSchools([]);
  }, [value.districtId, value.blockId]);

  if (!canPick) return null;

  const sel =
    'border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-300/50 focus:border-sky-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="no-print flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest">
        <i className="fas fa-filter" />
        Scope
      </div>
      <select
        className={sel}
        value={value.districtId ?? ''}
        onChange={(e) => onChange({ districtId: e.target.value || undefined })}
      >
        <option value="">All districts</option>
        {districts.map((d) => (
          <option key={d.districtId} value={d.districtId}>{d.district}</option>
        ))}
      </select>
      <select
        className={sel}
        disabled={!value.districtId}
        value={value.blockId ?? ''}
        onChange={(e) => onChange({ districtId: value.districtId, blockId: e.target.value || undefined })}
      >
        <option value="">All blocks</option>
        {blocks.map((b) => (
          <option key={b.blockId} value={b.blockId}>{b.block}</option>
        ))}
      </select>
      <select
        className={sel}
        disabled={!value.districtId && !value.blockId}
        value={value.schoolId ?? ''}
        onChange={(e) => onChange({ districtId: value.districtId, blockId: value.blockId, schoolId: e.target.value || undefined })}
      >
        <option value="">All schools</option>
        {schools.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      {(value.districtId || value.blockId || value.schoolId) && (
        <button onClick={() => onChange({})} className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium">
          <i className="fas fa-times-circle text-xs" />
          Reset
        </button>
      )}
    </div>
  );
}
