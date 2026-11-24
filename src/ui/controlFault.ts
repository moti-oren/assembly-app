import type { ControlSolution } from '@/core/controlLink';
import type { Faults } from '@/core/logic/fault';
import type { Bit } from '@/core/logic/gates';
import { controlLines, type LineRow } from './controlView';

/** A control line beside what it would be with nothing broken. */
export interface FaultRow extends LineRow {
  /** The value the line is stuck at, or null when it works. */
  stuck: Bit | null;
  /** Whether the line would be 1 with every line working. */
  healthy: boolean;
}

/** The lines of both decoders as they are with the broken ones, those that are on first. */
export function faultRows(
  broken: ControlSolution,
  healthy: ControlSolution,
  faults: Faults
): FaultRow[] {
  const whole = new Map(controlLines(healthy).map((row) => [row.id, row.on]));
  return controlLines(broken).map((row) => ({
    ...row,
    stuck: faults[row.id] ?? null,
    healthy: whole.get(row.id) ?? false
  }));
}

/** A line's button by name: what it shows, with its value and whether it is broken. */
export function lineName({ label, on, stuck }: FaultRow): string {
  return `${label} = ${on ? 1 : 0}${stuck === null ? '' : ', stuck'}`;
}

/** What breaking the line picked does to the instruction on show. */
export function faultNote({ label, does, stuck, healthy }: FaultRow): string {
  if (stuck === null) {
    return `${label} works: it is ${healthy ? 1 : 0} because the decoder says so. At 1, ${does}.`;
  }
  if ((stuck === 1) === healthy) {
    return `${label} is stuck at ${stuck}, which is what this instruction asks for anyway. Nothing changes until an instruction asks for ${stuck ^ 1}.`;
  }
  return stuck
    ? `${label} is stuck at 1 though the decoder asks for 0, so now ${does}.`
    : `${label} is stuck at 0 though the decoder asks for 1, so it no longer holds that ${does}.`;
}

/** The broken lines and how far they reach, or null when every line works. */
export function faultSummary(rows: readonly FaultRow[]): { broken: string; effect: string } | null {
  const stuck = rows.filter((row) => row.stuck !== null);
  if (stuck.length === 0) return null;
  const names = stuck.map((row) => `${row.label} at ${row.stuck}`).join(', ');
  const changed = rows.filter((row) => row.on !== row.healthy);
  const effect =
    changed.length === 0
      ? 'This instruction asks for the same, so its lines are as they would be.'
      : `Not as the decoders would set ${changed.length === 1 ? 'it' : 'them'}: ${changed
          .map((row) => `${row.label} is ${row.on ? 1 : 0}`)
          .join(', ')}.`;
  return { broken: `Stuck: ${names}.`, effect };
}
