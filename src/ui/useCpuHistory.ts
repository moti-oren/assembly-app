import { computed, shallowRef, type ShallowRef } from 'vue';
import { redo as redoRecord, undo, type ExecutionRecord } from '@/core/shared/executionRecord';
import { snapshot, type CpuSnapshot, type CpuState } from '@/core/shared/state';
import { byteChanges } from './stepDiff';

/** How many instructions back a memory write still shows as warm. */
export const HEAT_STEPS = 6;

/** An undone instruction, with the CPU as it left it, so it can be redone without re-running. */
interface Undone<Record> {
  record: Record;
  after: CpuSnapshot;
}

/** The executed instructions, and the undone ones that can still be redone. */
export function useCpuHistory<Record extends ExecutionRecord>(state: CpuState) {
  const history: ShallowRef<Record[]> = shallowRef([]);
  /** Undone instructions, the most recently undone last. */
  const undone: ShallowRef<Undone<Record>[]> = shallowRef([]);

  const lastRecord = computed(() => history.value.at(-1) ?? null);
  /**
   * The CPU as each instruction left it, kept from the moment it ran. An edit to the program moves
   * the instruction pointer afterwards, and undo and redo carry that move along, so what a step
   * did is told against this, never against the live CPU.
   */
  const leftBy = new WeakMap<Record, Record['before']>();
  /** The CPU as the last instruction left it. */
  const lastAfter = computed(() => (lastRecord.value && leftBy.get(lastRecord.value)) ?? null);
  /** The bytes the last instruction wrote, each from its first value to its last. */
  const lastWrites = computed(() => byteChanges(lastRecord.value?.memoryWrites ?? []));

  /** The undone instructions in the order they would run again. */
  const future = computed(() => undone.value.map((entry) => entry.record).reverse());

  /** Recently written physical addresses, mapped to how many instructions ago (0 = the last). */
  const memoryHeat = computed(() => {
    const heat = new Map<number, number>();
    const recent = history.value.slice(-HEAT_STEPS);
    recent.forEach((entry, i) => {
      for (const write of entry.memoryWrites) {
        heat.set(write.address, recent.length - 1 - i);
      }
    });
    return heat;
  });

  /** Adds newly executed instructions; anything undone can no longer be redone. */
  function record(records: Record[]): void {
    if (records.length === 0) return;
    // Nothing runs between the records of one batch: each left the CPU as the next one found it.
    const now = snapshot(state) as Record['before'];
    records.forEach((entry, i) => leftBy.set(entry, records[i + 1]?.before ?? now));
    history.value = [...history.value, ...records];
    undone.value = [];
  }

  /** Moves through time: undoes or redoes until exactly `position` instructions have run. */
  function seek(position: number): void {
    const past = [...history.value];
    const ahead = [...undone.value];
    for (let entry = past.at(-1); entry && past.length > position; entry = past.at(-1)) {
      past.pop();
      ahead.push({ record: entry, after: snapshot(state) });
      undo(state, entry);
    }
    for (let next = ahead.at(-1); next && past.length < position; next = ahead.at(-1)) {
      ahead.pop();
      redoRecord(state, next.record, next.after);
      past.push(next.record);
    }
    history.value = past;
    undone.value = ahead;
  }

  /** Drops what was undone: after an edit to the program it can no longer be redone. */
  function forgetFuture(): void {
    undone.value = [];
  }

  function clear(): void {
    history.value = [];
    undone.value = [];
  }

  return {
    history,
    lastRecord,
    lastAfter,
    lastWrites,
    future,
    memoryHeat,
    record,
    seek,
    forgetFuture,
    clear
  };
}
