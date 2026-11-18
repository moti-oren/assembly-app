import { computed, reactive, ref } from 'vue';
import { CpuError } from '@/core/shared/cpuError';
import { execute, type ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import {
  EXAMPLE_PROGRAMS,
  isFinished,
  MAX_RUN_WRITES,
  runToEnd,
  step,
  tooManyWrites
} from '@/core/x86/program';
import { createCpuState, setInputPort } from '@/core/x86/state';
import { useCpuHistory } from './useCpuHistory';
import { usePhaseStepping } from './usePhaseStepping';
import { useProgramLines } from './useProgramLines';
import { useProgramRun } from './useProgramRun';

/** What raised the error on show: the builder's own instruction, or the program. */
export type ErrorSource = 'builder' | 'program';

/**
 * Wraps the framework-free CPU core in Vue reactivity. The core mutates `state` through the
 * reactive proxy, so every panel re-renders by itself; nothing needs to emit events.
 */
export function useCpu() {
  const state = reactive(createCpuState());
  const { history, lastRecord, future, memoryHeat, record, ...timeline } = useCpuHistory(state);
  const { program, insertAt, addToProgram, removeProgramLine, replaceProgram } = useProgramLines(
    state,
    timeline.forgetFuture
  );
  const error = ref<string | null>(null);
  /** What raised `error`: the builder's own instruction, or the program. Each shows its own. */
  const errorFrom = ref<ErrorSource>('builder');
  const finished = computed(() => isFinished(state, program.value));

  /** Runs a CPU operation, turning a CpuError into the visible error message. */
  function attempt(from: ErrorSource, operation: () => void): boolean {
    try {
      operation();
      error.value = null;
      return true;
    } catch (caught) {
      if (caught instanceof CpuError) {
        error.value = caught.message;
        errorFrom.value = from;
        return false;
      }
      throw caught;
    }
  }

  function run(instruction: Instruction): boolean {
    return attempt('builder', () => record([execute(state, instruction)]));
  }

  function stepProgram(): void {
    pause();
    attempt('program', () => record([step(state, program.value)]));
  }

  const { speed, running, pause, runProgram } = useProgramRun(finished, {
    stepLine(writes) {
      let entry: ExecutionRecord | null = null;
      attempt('program', () => {
        if (writes >= MAX_RUN_WRITES) throw tooManyWrites();
        entry = step(state, program.value);
        record([entry]);
      });
      return entry;
    },
    runToEnd() {
      const result = runToEnd(state, program.value);
      record(result.records);
      error.value = result.error?.message ?? null;
      errorFrom.value = 'program';
    }
  });

  const { pending, stepPhase } = usePhaseStepping({
    state,
    program,
    executed: () => history.value.length,
    finished,
    pause,
    stepProgram
  });

  function clearProgram(): void {
    pause();
    replaceProgram([]);
  }

  function loadExample(index: number): void {
    reset();
    replaceProgram(EXAMPLE_PROGRAMS[index].program);
  }

  /** Moves through time: undoes or redoes until exactly `position` instructions have run. */
  function seek(position: number): void {
    pause();
    timeline.seek(position);
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
    timeline.clear();
    error.value = null;
  }

  return {
    state,
    history,
    error,
    errorFrom,
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
