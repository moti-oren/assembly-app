import type { PhoneView } from './layoutMode';

/**
 * The stage's panels, top to bottom. Its order is fixed (only the sidebar's panels can be
 * moved), and it differs between the CPU views, since the diagram and the tables show
 * different panels.
 */
export const STAGE = {
  diagram: ['cycle', 'cpu', 'devices', 'memory'],
  table: ['cycle', 'registers', 'operation', 'flags', 'devices', 'memory']
} as const;

export type StageKey = (typeof STAGE)[keyof typeof STAGE][number];

/** On a phone the stage is two views: the CPU, and what is on its bus. */
const PHONE_VIEW: Record<StageKey, PhoneView> = {
  cycle: 'cpu',
  cpu: 'cpu',
  registers: 'cpu',
  operation: 'cpu',
  flags: 'cpu',
  devices: 'memory',
  memory: 'memory'
};

export function phoneViewOf(panel: StageKey): PhoneView {
  return PHONE_VIEW[panel];
}
