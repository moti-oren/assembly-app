import { computed, onScopeDispose, reactive, ref, shallowRef, watch } from 'vue';
import { CpuError, execute, redo as redoRecord, undo, type ExecutionRecord } from '@/core/execute';
import type { Instruction } from '@/core/instructions';
import {
  EXAMPLE_PROGRAMS,
  insertLine,
  ipAfterInsert,
  ipAfterRemove,
  isFinished,
  MAX_RUN_WRITES,
  removeLine,
  runToEnd,
  step,
  tooManyWrites
} from '@/core/program';
import {
  createCpuState,
  setInputPort,
  snapshot,
  type CpuSnapshot,
  type CpuState
} from '@/core/state';

/** Delay between two program lines while running; `instant` runs to the end in one go. */
export const RUN_SPEEDS = { slow: 1100, normal: 600, fast: 150, instant: 0 } as const;
export type RunSpeed = keyof typeof RUN_SPEEDS;

/** How many instructions back a memory write still shows as warm. */
export const HEAT_STEPS = 6;

/** A program line that is being stepped one phase at a time and has not been executed yet. */
export interface PendingInstruction {
  phase: 'fetch' | 'decode';
  line: number;
  instruction: Instruction;
}

/** An undone instruction, with the CPU as it left it, so it can be redone without re-running. */
interface Undone {
  record: ExecutionRecord;
  after: CpuSnapshot;
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
  /** Memory writes of the run in progress, held to the same limit as an instant run. */
  let runWrites = 0;
  /**
   * How far the line at IP has got when stepping by phase. Fetch and decode only show what is
   * about to happen: the CPU itself changes at execute, exactly as with a whole step.
   */
  const phase = ref<PendingInstruction['phase'] | null>(null);

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

  const pending = computed<PendingInstruction | null>(() => {
    const line = state.registers.ip;
    const instruction = program.value[line];
    return phase.value && instruction ? { phase: phase.value, line, instruction } : null;
  });

  // Running an instruction, moving through history or editing the program starts the cycle over.
  watch(
    [() => history.value.length, program, () => state.registers.ip],
    () => {
      phase.value = null;
    },
    { flush: 'sync' }
  );

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

  /** Moves the line at IP one phase on: fetch, decode, then execute, which really runs it. */
  function stepPhase(): void {
    pause();
    if (finished.value) return;
    if (phase.value === null) {
      phase.value = 'fetch';
    } else if (phase.value === 'fetch') {
      phase.value = 'decode';
    } else {
      stepProgram();
    }
  }

  function pause(): void {
    running.value = false;
    window.clearTimeout(runTimer);
  }

  function runNextLine(): void {
    let continues = false;
    // Whatever goes wrong, even an error that is not the CPU's, the run must not stay "running".
    try {
      continues =
        !finished.value &&
        attempt(() => {
          if (runWrites >= MAX_RUN_WRITES) throw tooManyWrites();
          const entry = step(state, program.value);
          runWrites += entry.memoryWrites.length;
          record([entry]);
        }) &&
        !finished.value;
    } finally {
      if (continues) {
        runTimer = window.setTimeout(runNextLine, RUN_SPEEDS[speed.value]);
      } else {
        pause();
      }
    }
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
    runWrites = 0;
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
    error.value = null;
  }

  function undoLast(): void {
    seek(history.value.length - 1);
  }

  function redo(): void {
    seek(history.value.length + 1);
  }

  /** Flips a switch or otherwise changes what a device presents on an input port. */
  function setInput(port: number, value: number): void {
    setInputPort(state, port, value);
  }

  /**
   * Resets registers, flags, memory and the output devices. The program is kept, IP goes back
   * to L0, and the input devices stay as set: resetting a CPU does not flip its switches.
   */
  function reset(): void {
    pause();
    const inputs = state.io.in;
    Object.assign(state, createCpuState());
    state.io.in = inputs;
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
    pending,
    speed,
    running,
    pause,
    run,
    stepProgram,
    stepPhase,
    runProgram,
    addToProgram,
    removeProgramLine,
    clearProgram,
    loadExample,
    undoLast,
    redo,
    seek,
    setInput,
    reset
  };
}

export type Cpu = ReturnType<typeof useCpu>;
