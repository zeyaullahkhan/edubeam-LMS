import type { AuthUser } from '@edubeam/shared';

export interface StateConfig {
  tenantId: string;
  name: string;
  govLabel: string;
  logo: string;
}

export const STATE_MAP: Record<string, StateConfig> = {
  t_uk: { tenantId: 't_uk', name: 'Uttarakhand', govLabel: 'Uttarakhand Government Schools', logo: '/uk-logo.png' },
  t_mh: { tenantId: 't_mh', name: 'Maharashtra', govLabel: 'Maharashtra Government Schools', logo: '/mh-logo.png' },
  t_od: { tenantId: 't_od', name: 'Odisha', govLabel: 'Odisha Government Schools', logo: '/od-logo.png' },
};

/** Returns the state config for the logged-in user, or null for Platform Admin. */
export function stateFor(user: Pick<AuthUser, 'role' | 'tenantId'>): StateConfig | null {
  if (!user.tenantId) return null;
  return STATE_MAP[user.tenantId] ?? null;
}

/** Global marketing stats shown on the public landing page. */
export const GLOBAL_STATS = [
  { value: '2,100,000+', label: 'Students Served' },
  { value: '100,000+',   label: 'Teachers Trained' },
  { value: '7',          label: 'State Governments' },
  { value: '96%',        label: 'System Uptime' },
];
