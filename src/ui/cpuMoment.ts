import { hasCircuit, type AluLink } from '@/core/aluLink';

/** A point in a CPU's history, as the logic topic shows it. */
export interface CpuMoment {
  /** The CPU's name: `8086`. */
  cpu: string;
  /** How many instructions have run, and how many there are with the undone ones. */
  position: number;
  total: number;
  /** The last instruction as text, or null when nothing has run. */
  instruction: string | null;
  /** Where that instruction leads in the logic topic. */
  link: AluLink | null;
  /** The nearest positions, back and forward, whose instruction has a circuit to show. */
  previous: number | null;
  next: number | null;
}

/** A CPU's timeline, and how its records are read. */
export interface MomentSource<Record> {
  cpu: string;
  history: readonly Record[];
  /** The undone instructions, in the order they would run again. */
  future: readonly Record[];
  format: (record: Record) => string;
  link: (record: Record) => AluLink;
}

export function momentOf<Record>(source: MomentSource<Record>): CpuMoment {
  const { history, future, link } = source;
  const position = history.length;
  const last = history.at(-1);
  let previous: number | null = null;
  for (let at = position - 1; at >= 1 && previous === null; at--) {
    if (hasCircuit(link(history[at - 1]))) previous = at;
  }
  const ahead = future.findIndex((record) => hasCircuit(link(record)));
  return {
    cpu: source.cpu,
    position,
    total: position + future.length,
    instruction: last === undefined ? null : source.format(last),
    link: last === undefined ? null : link(last),
    previous,
    next: ahead === -1 ? null : position + ahead + 1
  };
}
