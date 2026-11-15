import { computed, reactive, ref, shallowRef } from 'vue';
import { CpuError, execute, undo, type ExecutionRecord } from '@/core/execute';
import type { Instruction } from '@/core/instructions';
import {
  EXAMPLE_PROGRAMS,
  insertLine,
  ipAfterInsert,
  ipAfterRemove,
  isFinished,
  removeLine,
  runToEnd,
  step
} from '@/core/program';
import { createCpuState, type CpuState } from '@/core/state';

/**
 * Wraps the framework-free CPU core in Vue reactivity. The core mutates `state` through the
 * reactive proxy, so every panel re-renders by itself; nothing needs to emit events.
 */
export function useCpu() {
  const state = reactive(createCpuState()) as CpuState;
  const history = shallowRef<ExecutionRecord[]>([]);
  const error = ref<string | null>(null);
  const program = shallowRef<Instruction[]>([]);
  /** Line that new program lines are inserted before; null means "append at the end". */
  const insertAt = ref<number | null>(null);

  const lastRecord = computed(() => history.value.at(-1) ?? null);

  /** Physical addresses written by the last instruction, for highlighting. */
  const lastMemoryWrites = computed(
    () => new Set(lastRecord.value?.memoryWrites.map((write) => write.address))
  );

  const finished = computed(() => isFinished(state, program.value));

  function record(records: ExecutionRecord[]): void {
    if (records.length > 0) {
      history.value = [...history.value, ...records];
    }
  }

  /** Runs a CPU operation, turning a CpuError into the visible error message. */
  function attempt(operation: () => void): boolean {
    try {
      operation();
      error.value = null;
      return true;
    } catch (caught) {
      if (caught instanceof CpuError) {
        error.value = caught.message;
        return false;
      }
      throw caught;
    }
  }

  function run(instruction: Instruction): boolean {
    return attempt(() => record([execute(state, instruction)]));
  }

  function stepProgram(): void {
    attempt(() => record([step(state, program.value)]));
  }

  function runProgram(): void {
    const result = runToEnd(state, program.value);
    record(result.records);
    error.value = result.error?.message ?? null;
  }

  function addToProgram(instruction: Instruction): void {
    const index = insertAt.value ?? program.value.length;
    program.value = insertLine(program.value, index, instruction);
    state.registers.ip = ipAfterInsert(state.registers.ip, index);
    if (insertAt.value !== null) {
      insertAt.value++;
    }
  }

  function removeProgramLine(index: number): void {
    program.value = removeLine(program.value, index);
    state.registers.ip = ipAfterRemove(state.registers.ip, index);
    if (insertAt.value !== null && insertAt.value > index) {
      insertAt.value--;
    }
  }

  function clearProgram(): void {
    program.value = [];
    insertAt.value = null;
    state.registers.ip = 0;
  }

  function loadExample(index: number): void {
    reset();
    program.value = [...EXAMPLE_PROGRAMS[index].program];
    insertAt.value = null;
  }

  function undoLast(): void {
    const last = lastRecord.value;
    if (!last) return;
    undo(state, last);
    history.value = history.value.slice(0, -1);
    error.value = null;
  }

  /** Resets registers, flags and memory. The program is kept, and IP goes back to L0. */
  function reset(): void {
    Object.assign(state, createCpuState());
    history.value = [];
    error.value = null;
  }

  return {
    state,
    history,
    error,
    program,
    insertAt,
    lastRecord,
    lastMemoryWrites,
    finished,
    run,
    stepProgram,
    runProgram,
    addToProgram,
    removeProgramLine,
    clearProgram,
    loadExample,
    undoLast,
    reset
  };
}

export type Cpu = ReturnType<typeof useCpu>;
