import type { ComparedId, Measurement } from '@/core/comparison';

/** The columns of the comparison, in the order the architecture switch lists them. */
export const COMPARED: readonly ComparedId[] = ['x86', 'rv32', 'mos6502'];

/** What sets each architecture apart, under its name in the comparison. */
export const TRAITS: Record<ComparedId, string> = {
  x86: '16-bit registers · instructions of 1 to 6 bytes',
  rv32: '32-bit registers · every instruction 4 bytes',
  mos6502: '8-bit registers · instructions of 1 to 3 bytes'
};

/** One measure, across the three architectures. */
export interface MetricRow {
  label: string;
  hint: string;
  values: Record<ComparedId, string>;
  /** The architectures that need the least, when they do not all need the same. */
  least: ComparedId[];
}

const METRICS: {
  label: string;
  hint: string;
  value: (measurement: Measurement) => number | null;
}[] = [
  { label: 'Lines', hint: 'Instructions in the program', value: (m) => m.listing.length },
  { label: 'Code bytes', hint: 'The size of its machine code', value: (m) => m.bytes },
  {
    label: 'Instructions run',
    hint: 'Steps to the end; a REP instruction is one step',
    value: (m) => m.steps
  },
  {
    label: 'Memory writes',
    hint: 'Bytes written to memory, the stack included',
    value: (m) => m.memoryWrites
  },
  { label: 'Clock cycles', hint: 'Only the 6502 counts them here', value: (m) => m.cycles }
];

function least(values: Record<ComparedId, number | null>): ComparedId[] {
  const counted = COMPARED.filter((id) => values[id] !== null);
  if (counted.length < 2) return [];
  const lowest = Math.min(...counted.map((id) => values[id]!));
  const winners = counted.filter((id) => values[id] === lowest);
  return winners.length === counted.length ? [] : winners;
}

/** The rows of the comparison table, each with who needs the least. */
export function metricRows(measurements: Record<ComparedId, Measurement>): MetricRow[] {
  return METRICS.map(({ label, hint, value }) => {
    const numbers = Object.fromEntries(
      COMPARED.map((id) => [id, value(measurements[id])])
    ) as Record<ComparedId, number | null>;
    const values = Object.fromEntries(
      COMPARED.map((id) => [id, numbers[id] === null ? '—' : String(numbers[id])])
    ) as Record<ComparedId, string>;
    return { label, hint, values, least: least(numbers) };
  });
}

/** Machine code as the listing shows it: `B8 34 12`. */
export function codeText(bytes: readonly number[]): string {
  return bytes.map((byte) => byte.toString(16).toUpperCase().padStart(2, '0')).join(' ');
}
