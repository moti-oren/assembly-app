import type { MemoryWrite } from '@/core/shared/state';

/** One value the last step wrote or moved: what it held before, and what it holds now. */
export interface ValueChange {
  before: string;
  after: string;
  /** Written with the value it already held: a write happened, but nothing changed. */
  unchanged: boolean;
  /** The instruction pointer went somewhere other than the next instruction. */
  jump: boolean;
}

export type DiffKind = 'register' | 'memory' | 'flag' | 'pointer';

/** One line of a step's diff, e.g. `CX 0000 → 000A`. */
export interface DiffEntry extends ValueChange {
  name: string;
  kind: DiffKind;
}

/** A byte the last step wrote: the first value it held, and the last one written. */
export interface ByteChange {
  before: number;
  after: number;
}

/**
 * A value's change, or null when the step neither wrote nor changed it. `written` counts a write
 * that left the value as it was.
 */
export function valueChange(
  before: number,
  after: number,
  written: boolean,
  format: (value: number) => string
): ValueChange | null {
  if (!written && before === after) return null;
  return { before: format(before), after: format(after), unchanged: before === after, jump: false };
}

/**
 * Where the instruction pointer went. `fallThrough` is where it goes when nothing jumps: the
 * next instruction, or the same place for an instruction run straight from the builder.
 */
export function pointerChange(
  before: number,
  after: number,
  fallThrough: number,
  format: (value: number) => string
): ValueChange | null {
  if (before === after && after === fallThrough) return null;
  return {
    before: format(before),
    after: format(after),
    unchanged: before === after,
    jump: after !== fallThrough
  };
}

/** Every byte the writes touched, each once, from its first value to its last. */
export function byteChanges(writes: readonly MemoryWrite[]): Map<number, ByteChange> {
  const bytes = new Map<number, ByteChange>();
  for (const write of writes) {
    const known = bytes.get(write.address);
    bytes.set(write.address, { before: known?.before ?? write.before, after: write.after });
  }
  return bytes;
}

function littleEndianHex(values: number[]): string {
  return values
    .map((value) => value.toString(16).toUpperCase().padStart(2, '0'))
    .reverse()
    .join('');
}

/**
 * The memory a step wrote, as entries: bytes at consecutive addresses are read together as one
 * little-endian value, up to `maxBytes` (a word store is one entry, not two).
 */
export function memoryEntries(
  writes: readonly MemoryWrite[],
  maxBytes: number,
  formatAddress: (address: number) => string
): DiffEntry[] {
  const runs: { address: number; bytes: ByteChange[] }[] = [];
  for (const [address, change] of byteChanges(writes)) {
    const run = runs.at(-1);
    if (run && run.bytes.length < maxBytes && run.address + run.bytes.length === address) {
      run.bytes.push(change);
    } else {
      runs.push({ address, bytes: [change] });
    }
  }
  return runs.map(({ address, bytes }) => {
    const before = littleEndianHex(bytes.map((byte) => byte.before));
    const after = littleEndianHex(bytes.map((byte) => byte.after));
    return {
      name: formatAddress(address),
      kind: 'memory',
      before,
      after,
      unchanged: before === after,
      jump: false
    };
  });
}

/** Flags as 0 or 1, for the flags whose bit the step changed. */
export function flagEntries(
  names: readonly string[],
  before: number,
  after: number,
  bitOf: (name: string) => number
): DiffEntry[] {
  return names.flatMap((name) => {
    const bit = bitOf(name);
    if (((before ^ after) & bit) === 0) return [];
    const was = before & bit ? '1' : '0';
    const now = after & bit ? '1' : '0';
    return [
      { name, kind: 'flag' as const, before: was, after: now, unchanged: false, jump: false }
    ];
  });
}

/** An entry for a value, or nothing when the step left it alone. */
export function entry(name: string, kind: DiffKind, change: ValueChange | null): DiffEntry[] {
  return change ? [{ name, kind, ...change }] : [];
}

/**
 * The order a learner reads a step in: what it wrote (registers and memory, as written), then a
 * jump, then the flags, and last the instruction pointer simply moving on.
 */
export function prioritize(entries: readonly DiffEntry[]): DiffEntry[] {
  const rank = (item: DiffEntry): number => {
    if (item.kind === 'register' || item.kind === 'memory') return 0;
    if (item.kind === 'pointer') return item.jump ? 1 : 3;
    return 2;
  };
  return [...entries].sort((a, b) => rank(a) - rank(b));
}

/** The change as words, for a tooltip, a title or a screen reader. */
export function describeChange(change: ValueChange): string {
  if (change.unchanged) return `written, value unchanged: ${change.after}`;
  return `${change.before} → ${change.after}${change.jump ? ' (jump)' : ''}`;
}

/** How many entries the result strip has room for on a phone, and on a wider screen. */
export const STRIP_ENTRIES = { phone: 1, wide: 4 } as const;

/** How many entries are left out of a strip that shows `room` of `total`. */
export function leftOut(total: number, room: number): number {
  return Math.max(0, total - room);
}

/**
 * What an instruction did to a flag, in words: `ZF 0 → 1`, `ZF = 1 (unchanged)` when it set the
 * flag to what it was, `ZF unchanged` when it left it alone (`after` null).
 */
export function describeFlag(name: string, before: boolean, after: boolean | null): string {
  if (after === null) return `${name} unchanged`;
  if (after === before) return `${name} = ${Number(after)} (unchanged)`;
  return `${name} ${Number(before)} → ${Number(after)}`;
}

/** A byte's change in the last step, or null when the step did not write it. */
export function writtenByte(
  bytes: ReadonlyMap<number, ByteChange>,
  address: number
): ValueChange | null {
  const byte = bytes.get(address);
  if (!byte) return null;
  const hex = (value: number) => value.toString(16).toUpperCase().padStart(2, '0');
  return valueChange(byte.before, byte.after, true, hex);
}

/** A value's hover text: its name, then what the last step did to it, if anything. */
export function changeTitle(label: string, change: ValueChange | null): string {
  return change ? `${label}: ${describeChange(change)}` : label;
}
