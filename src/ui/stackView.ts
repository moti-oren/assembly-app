/**
 * The stack as its panel lists it: one row per value on it, the top first, each with what it is
 * and the instruction that put it there.
 */
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { formatLabel } from '@/core/shared/program';
import { writerOf, type StackWriters } from './stackWriters';

/** One value on the stack, or one the last instruction took off it. */
export interface StackEntry {
  /** Its lowest address, which no other entry has. */
  key: number;
  address: string;
  value: string;
  /** What the value is: a register's, a return address, the flags. */
  label: string;
  /** The instruction that wrote it; null when nothing in the history did. */
  source: string | null;
  /** The entry the stack pointer points at. */
  top: boolean;
  /** Taken off by the last instruction: no longer on the stack, though memory still holds it. */
  popped: boolean;
  /** What the last instruction did to it. */
  change: 'write' | 'read' | null;
  /** A return address: what is above it in the list belongs to the routine that was called. */
  returns: boolean;
}

export interface StackView {
  /** The stack pointer, as the architecture writes it. */
  pointer: string;
  entries: StackEntry[];
  /** Older values left out below the ones listed. */
  hidden: number;
  /** What to say in place of the list when it is empty. */
  empty: string;
  /** Something to say about the stack itself, as that more was taken off than was put on. */
  note?: string;
}

/** Some bytes of the stack that are read as one value; `address` is the lowest. */
export interface StackCell {
  address: number;
  size: number;
}

/** What a cell holds, in the architecture's words. */
export interface CellText {
  address: string;
  value: string;
  label: string;
  returns?: boolean;
}

/** The values listed; a deeper stack says how many more it holds. */
export const STACK_ROWS = 16;
/** The values just taken off that stay in sight, greyed, above the top. */
const POPPED_ROWS = 3;

/** The cells of `size` bytes from `from` up to `to`, lowest address first. */
export function cellsBetween(from: number, to: number, size: number): StackCell[] {
  const cells: StackCell[] = [];
  for (let address = from; address + size <= to; address += size) cells.push({ address, size });
  return cells;
}

/** Where an instruction came from and what it was: `L3 · push ax`. */
export function sourceOf<R extends ExecutionRecord>(
  record: R,
  format: (instruction: R['instruction']) => string
): string {
  const from = record.line === null ? 'run directly' : formatLabel(record.line);
  return `${from} · ${format(record.instruction)}`;
}

export interface StackParts<R extends ExecutionRecord> {
  /** The cells on the stack, the top first. */
  live: StackCell[];
  /** The cells the last instruction took off, lowest address first. */
  popped: StackCell[];
  history: readonly R[];
  writers: StackWriters;
  format: (instruction: R['instruction']) => string;
  /** A cell in words, given the record that wrote it last. */
  describe: (cell: StackCell, writer: R | null) => CellText;
}

/** The rows of the panel: what was just taken off, then the stack from its top down. */
export function stackEntries<R extends ExecutionRecord>(
  parts: StackParts<R>
): {
  entries: StackEntry[];
  hidden: number;
} {
  const { live, popped, history, writers, format, describe } = parts;
  const last = history.length - 1;
  const entry = (cell: StackCell, index: number, isPopped: boolean): StackEntry => {
    const step = writerOf(writers, cell.address, cell.size);
    const writer = step === null ? null : history[step];
    const text = describe(cell, writer);
    return {
      key: cell.address,
      address: text.address,
      value: text.value,
      label: text.label,
      source: writer ? sourceOf(writer, format) : null,
      top: !isPopped && index === 0,
      popped: isPopped,
      change: isPopped ? 'read' : step === last && last >= 0 ? 'write' : null,
      returns: text.returns ?? false
    };
  };
  const shown = live.slice(0, STACK_ROWS);
  return {
    entries: [
      ...popped.slice(-POPPED_ROWS).map((cell, index) => entry(cell, index, true)),
      ...shown.map((cell, index) => entry(cell, index, false))
    ],
    hidden: live.length - shown.length
  };
}
