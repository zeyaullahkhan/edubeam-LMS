import type { Metric } from '@edubeam/shared';

export function formatMetric(m: Metric): string {
  if (m.value == null) return '—';
  if (typeof m.value === 'string') return m.value;
  switch (m.format) {
    case 'percent':
      return `${(m.value * 100).toFixed(1)}%`;
    case 'hours':
      return `${m.value.toLocaleString()} hrs`;
    case 'minutes':
    case 'duration':
      return `${m.value} min`;
    default:
      return m.value.toLocaleString() + (m.unit ? ` ${m.unit}` : '');
  }
}

export function trendLabel(t: number | null | undefined): { text: string; cls: string } | null {
  if (t == null) return null;
  const up = t >= 0;
  return {
    text: `${up ? '▲' : '▼'} ${Math.abs(t * 100).toFixed(1)}%`,
    cls: up ? 'text-emerald-600' : 'text-red-600',
  };
}
