import { computed, onScopeDispose, reactive, ref, shallowRef } from 'vue';
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

/** Delay between two program lines while running; `instant` runs to the end in one go. */
export const RUN_SPEEDS = { slow: 1100, normal: 600, fast: 150, instant: 0 } as const;
export type RunSpeed = keyof typeof RUN_SPEEDS;

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
  const speed = ref<RunSpeed>('normal');
  /** True while the program is running line by line on a timer. */
  const running = ref(false);
  let runTimer: number | undefined;

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
    pause();
    attempt(() => record([step(state, program.value)]));
  }

  function pause(): void {
    running.value = false;
    window.clearTimeout(runTimer);
  }

  function runNextLine(): void {
    const stepped = !finished.value && attempt(() => record([step(state, program.value)]));
    if (!stepped || finished.value) {
      pause();
      return;
    }
    runTimer = window.setTimeout(runNextLine, RUN_SPEEDS[speed.value]);
  }

  function runProgram(): void {
    pause();
    if (speed.value === 'instant') {
      const result = runToEnd(state, program.value);
      record(result.records);
      error.value = result.error?.message ?? null;
      return;
    }
    running.value = true;
    runNextLine();
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
    pause();
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
    pause();
    const last = lastRecord.value;
    if (!last) return;
    undo(state, last);
    history.value = history.value.slice(0, -1);
    error.value = null;
  }

  /** Resets registers, flags and memory. The program is kept, and IP goes back to L0. */
  function reset(): void {
    pause();
    Object.assign(state, createCpuState());
    history.value = [];
    error.value = null;
  }

  onScopeDispose(pause);

  return {
    state,
    history,
    error,
    program,
    insertAt,
    lastRecord,
    lastMemoryWrites,
    finished,
    speed,
    running,
    pause,
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
