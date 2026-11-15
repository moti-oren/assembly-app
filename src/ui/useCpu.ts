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
import type { WordRegister } from '@/core/registers';
import { createCpuState, type CpuState } from '@/core/state';

/** Delay between two program lines while running; `instant` runs to the end in one go. */
export const RUN_SPEEDS = { slow: 1100, normal: 600, fast: 150, instant: 0 } as const;
export type RunSpeed = keyof typeof RUN_SPEEDS;

/** How many instructions back a memory write still shows as warm. */
export const HEAT_STEPS = 6;

/** An undone instruction, with the CPU as it left it, so it can be redone without re-running. */
interface Undone {
  record: ExecutionRecord;
  after: { registers: Record<WordRegister, number>; flags: number };
}

/**
 * Wraps the framework-free CPU core in Vue reactivity. The core mutates `state` through the
 * reactive proxy, so every panel re-renders by itself; nothing needs to emit events.
 */
export function useCpu() {
  const state = reactive(createCpuState()) as CpuState;
  const history = shallowRef<ExecutionRecord[]>([]);
  /** Undone instructions, the most recently undone last. */
  const undone = shallowRef<Undone[]>([]);
  const error = ref<string | null>(null);
  const program = shallowRef<Instruction[]>([]);
  /** Line that new program lines are inserted before; null means "append at the end". */
  const insertAt = ref<number | null>(null);
  const speed = ref<RunSpeed>('normal');
  /** True while the program is running line by line on a timer. */
  const running = ref(false);
  let runTimer: number | undefined;

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

  const finished = computed(() => isFinished(state, program.value));

  function record(records: ExecutionRecord[]): void {
    if (records.length > 0) {
      history.value = [...history.value, ...records];
      undone.value = [];
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
    undone.value = [];
    program.value = insertLine(program.value, index, instruction);
    state.registers.ip = ipAfterInsert(state.registers.ip, index);
    if (insertAt.value !== null) {
      insertAt.value++;
    }
  }

  function removeProgramLine(index: number): void {
    undone.value = [];
    program.value = removeLine(program.value, index);
    state.registers.ip = ipAfterRemove(state.registers.ip, index);
    if (insertAt.value !== null && insertAt.value > index) {
      insertAt.value--;
    }
  }

  function clearProgram(): void {
    pause();
    undone.value = [];
    program.value = [];
    insertAt.value = null;
    state.registers.ip = 0;
  }

  function loadExample(index: number): void {
    reset();
    program.value = [...EXAMPLE_PROGRAMS[index].program];
    insertAt.value = null;
  }

  /** Moves through time: undoes or redoes until exactly `position` instructions have run. */
  function seek(position: number): void {
    pause();
    const past = [...history.value];
    const ahead = [...undone.value];
    while (past.length > position) {
      const entry = past.pop()!;
      const after = { registers: { ...state.registers }, flags: state.flags };
      undo(state, entry);
      ahead.push({ record: entry, after });
    }
    while (past.length < position && ahead.length > 0) {
      const { record: entry, after } = ahead.pop()!;
      Object.assign(state.registers, after.registers);
      state.flags = after.flags;
      for (const write of entry.memoryWrites) {
        state.memory[write.address] = write.after;
      }
      if (entry.memoryWrites.length > 0) {
        state.memoryVersion++;
      }
      past.push(entry);
    }
    history.value = past;
    undone.value = ahead;
    error.value = null;
  }

  function undoLast(): void {
    seek(history.value.length - 1);
  }

  function redo(): void {
    seek(history.value.length + 1);
  }

  /** Resets registers, flags and memory. The program is kept, and IP goes back to L0. */
  function reset(): void {
    pause();
    Object.assign(state, createCpuState());
    history.value = [];
    undone.value = [];
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
    future,
    memoryHeat,
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
    redo,
    seek,
    reset
  };
}

export type Cpu = ReturnType<typeof useCpu>;
