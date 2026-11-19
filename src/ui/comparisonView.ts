import type { ComparedId, Measurement } from '@/core/comparison';
import type { Messages } from './messages/en';

/** The columns of the comparison, in the order the architecture switch lists them. */
export const COMPARED: readonly ComparedId[] = ['x86', 'rv32', 'mos6502'];

/** One measure, across the three architectures. */
export interface MetricRow {
  label: string;
  hint: string;
  values: Record<ComparedId, string>;
  /** The architectures that need the least, when they do not all need the same. */
  least: ComparedId[];
}

type Metric = keyof Messages['compare']['metrics'];

/** Each measure, in the order of the table, and how to read it from a measurement. */
const METRICS: Record<Metric, (measurement: Measurement) => number | null> = {
  lines: (measurement) => measurement.listing.length,
  bytes: (measurement) => measurement.bytes,
  steps: (measurement) => measurement.steps,
  memoryWrites: (measurement) => measurement.memoryWrites,
  cycles: (measurement) => measurement.cycles
};

function least(values: Record<ComparedId, number | null>): ComparedId[] {
  const counted = COMPARED.filter((id) => values[id] !== null);
  if (counted.length < 2) return [];
  const lowest = Math.min(...counted.map((id) => values[id]!));
  const winners = counted.filter((id) => values[id] === lowest);
  return winners.length === counted.length ? [] : winners;
}

/** The rows of the comparison table, each with who needs the least. */
export function metricRows(
  m: Messages,
  measurements: Record<ComparedId, Measurement>
): MetricRow[] {
  return (Object.keys(METRICS) as Metric[]).map((metric) => {
    const value = METRICS[metric];
    const { label, hint } = m.compare.metrics[metric];
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
