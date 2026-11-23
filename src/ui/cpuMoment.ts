/** A point in a CPU's history, as another topic shows it. `Link` is where it leads there. */
export interface CpuMoment<Link> {
  /** The CPU's name: `8086`. */
  cpu: string;
  /** How many instructions have run, and how many there are with the undone ones. */
  position: number;
  total: number;
  /** The last instruction as text, or null when nothing has run. */
  instruction: string | null;
  /** Where that instruction leads in the topic. */
  link: Link | null;
  /** The nearest positions, back and forward, whose instruction has something to show there. */
  previous: number | null;
  next: number | null;
}

/** A CPU's timeline, and how its records are read. */
export interface MomentSource<Record, Link> {
  cpu: string;
  history: readonly Record[];
  /** The undone instructions, in the order they would run again. */
  future: readonly Record[];
  format: (record: Record) => string;
  link: (record: Record) => Link;
  /** Whether the topic has something to show for a link, or only a reason why not. */
  shows: (link: Link) => boolean;
  /**
   * The same question asked of a record, for a caller that remembers the answers: the steps are
   * found by asking it of the whole history.
   */
  has?: (record: Record) => boolean;
}

export function momentOf<Record, Link>(source: MomentSource<Record, Link>): CpuMoment<Link> {
  const { history, future, link, shows } = source;
  const has = source.has ?? ((record: Record) => shows(link(record)));
  const position = history.length;
  const last = history.at(-1);
  let previous: number | null = null;
  for (let at = position - 1; at >= 1 && previous === null; at--) {
    if (has(history[at - 1])) previous = at;
  }
  const ahead = future.findIndex(has);
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
