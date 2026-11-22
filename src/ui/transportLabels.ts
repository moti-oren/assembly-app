import { CYCLE_PHASES, type CyclePhase } from '@/core/shared/cycle';

const PHASE_NAMES: Record<CyclePhase, string> = {
  fetch: 'Fetch',
  decode: 'Decode',
  execute: 'Execute'
};

/** What the phase button says: the phase it runs next and its place among the three. */
export interface PhaseLabel {
  name: string;
  /** `1/3`, `2/3` or `3/3`. */
  place: string;
  /** For a screen reader; it starts with the text on the button, so speech input finds it. */
  spoken: string;
}

/** The label of the phase button, given the phase the line has reached (null between lines). */
export function nextPhaseLabel(reached: CyclePhase | null): PhaseLabel {
  const index = reached === null ? 0 : (CYCLE_PHASES.indexOf(reached) + 1) % CYCLE_PHASES.length;
  const name = PHASE_NAMES[CYCLE_PHASES[index]];
  const place = `${index + 1}/${CYCLE_PHASES.length}`;
  return { name, place, spoken: `${name} ${place}: step one phase` };
}

/** Why the buttons that step and run the program are off, or null when they are on. */
export function blockedReason(finished: boolean, empty: boolean): string | null {
  if (!finished) return null;
  return empty
    ? 'Add a line to the program first'
    : 'The program has ended. Run it again, or undo to step back.';
}
