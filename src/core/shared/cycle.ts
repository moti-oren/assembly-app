/** The steps a CPU repeats for every instruction, whatever its architecture. */
export const CYCLE_PHASES = ['fetch', 'decode', 'execute'] as const;
export type CyclePhase = (typeof CYCLE_PHASES)[number];
