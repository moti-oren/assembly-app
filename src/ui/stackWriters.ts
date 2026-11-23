import type { ExecutionRecord } from '@/core/shared/executionRecord';

/**
 * Which instruction of the history wrote each byte of memory last. It follows a history that
 * grows a record at a time without reading it all again.
 */
export interface StackWriters {
  /** For every address written, the place in the history of the record that wrote it last. */
  readonly byAddress: Map<number, number>;
  /** How many records were read, and the last of them: a history that still has it only grew. */
  seen: number;
  last: ExecutionRecord | null;
}

export function newWriters(): StackWriters {
  return { byAddress: new Map(), seen: 0, last: null };
}

/**
 * Brings `writers` up to `history`. After an undo, a seek or a reset the history no longer
 * continues the one read so far, and it is read again from its start.
 */
export function followHistory(writers: StackWriters, history: readonly ExecutionRecord[]): void {
  const grew = writers.seen <= history.length;
  const continues = writers.seen === 0 || history[writers.seen - 1] === writers.last;
  if (!grew || !continues) {
    writers.byAddress.clear();
    writers.seen = 0;
  }
  for (let step = writers.seen; step < history.length; step++) {
    for (const write of history[step].memoryWrites) writers.byAddress.set(write.address, step);
  }
  writers.seen = history.length;
  writers.last = history.at(-1) ?? null;
}

/** The place in the history of the record that last wrote any of `size` bytes from `address`. */
export function writerOf(writers: StackWriters, address: number, size: number): number | null {
  let latest: number | null = null;
  for (let offset = 0; offset < size; offset++) {
    const step = writers.byAddress.get(address + offset);
    if (step !== undefined && (latest === null || step > latest)) latest = step;
  }
  return latest;
}
