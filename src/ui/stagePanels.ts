import type { PhoneView } from './layoutMode';

/**
 * The stage's panels, top to bottom. Its order is fixed (only the sidebar's panels can be
 * moved), and it differs between the CPU views, since the diagram and the tables show
 * different panels.
 */
export const STAGE = {
  diagram: ['cycle', 'cpu', 'stack', 'devices', 'memory'],
  table: ['cycle', 'registers', 'operation', 'flags', 'stack', 'devices', 'memory']
} as const;

export type StageKey = (typeof STAGE)[keyof typeof STAGE][number];

/**
 * On a phone the stage is two views: the CPU, and what is on its bus. The stack goes with the
 * CPU, as on a desktop's stage, where it sits beside it: under "Memory & I/O" no one looks for it.
 */
const PHONE_VIEW: Record<StageKey, PhoneView> = {
  cycle: 'cpu',
  cpu: 'cpu',
  registers: 'cpu',
  operation: 'cpu',
  flags: 'cpu',
  stack: 'cpu',
  devices: 'memory',
  memory: 'memory'
};

export function phoneViewOf(panel: StageKey): PhoneView {
  return PHONE_VIEW[panel];
}
