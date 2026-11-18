import { computed, shallowRef } from 'vue';
import { type ExecutionRecord } from '@/core/x86/execute';
import { redo as redoRecord, undo } from '@/core/shared/executionRecord';
import { type CpuSnapshot, type CpuState } from '@/core/x86/state';
import { snapshot } from '@/core/shared/state';

/** How many instructions back a memory write still shows as warm. */
export const HEAT_STEPS = 6;

/** An undone instruction, with the CPU as it left it, so it can be redone without re-running. */
interface Undone {
  record: ExecutionRecord;
  after: CpuSnapshot;
}

/** The executed instructions, and the undone ones that can still be redone. */
export function useCpuHistory(state: CpuState) {
  const history = shallowRef<ExecutionRecord[]>([]);
  /** Undone instructions, the most recently undone last. */
  const undone = shallowRef<Undone[]>([]);

  const lastRecord = computed(() => history.value.at(-1) ?? null);

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
  function record(records: ExecutionRecord[]): void {
    if (records.length > 0) {
      history.value = [...history.value, ...records];
      undone.value = [];
    }
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

  return { history, lastRecord, future, memoryHeat, record, seek, forgetFuture, clear };
}
