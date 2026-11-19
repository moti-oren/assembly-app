import { computed, reactive, ref, type Ref } from 'vue';
import type { Architecture } from '@/core/shared/architecture';
import { CpuError } from '@/core/shared/cpuError';
import { useLocale } from './useLocale';
import { undo, type ExecutionRecord } from '@/core/shared/executionRecord';
import {
  isFinished,
  MAX_RUN_WRITES,
  runToEnd,
  step,
  tooManyWrites,
  type ProgramInstruction
} from '@/core/shared/program';
import { setInputPort, type CpuState } from '@/core/shared/state';
import { useCpuHistory } from './useCpuHistory';
import { usePhaseStepping } from './usePhaseStepping';
import { useProgramLines } from './useProgramLines';
import { useProgramRun } from './useProgramRun';
import type { RunSpeed } from './runSpeeds';

/** What raised the error on show: the builder's own instruction, or the program. */
export type ErrorSource = 'builder' | 'program';

/**
 * Wraps a framework-free CPU core in Vue reactivity. The core mutates `state` through the
 * reactive proxy, so every panel re-renders by itself; nothing needs to emit events.
 */
export function useCpu<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(architecture: Architecture<Instruction, State, Record>) {
  // The state holds no refs, so the reactive proxy has the same shape as the state itself.
  const state = reactive(architecture.createState()) as State;
  const { history, lastRecord, future, memoryHeat, record, ...timeline } =
    useCpuHistory<Record>(state);
  const { program, insertAt, addToProgram, removeProgramLine, replaceProgram } = useProgramLines(
    architecture,
    state,
    timeline.forgetFuture
  );
  const { t } = useLocale();
  /** The error the CPU raised last, until the next operation succeeds. */
  const failure = ref<CpuError | null>(null);
  /** Its message in the language of the interface, which follows a change of language. */
  const error = computed<string | null>(() => {
    const caught = failure.value;
    if (!caught) return null;
    return caught.said ? t.value.cpuError(caught.said.key, caught.said.params) : caught.message;
  });
  /** What raised `error`: the builder's own instruction, or the program. Each shows its own. */
  const errorFrom = ref<ErrorSource>('builder');
  /** The program line the instruction pointer points at: the one that runs next. */
  const nextLine = computed(() => architecture.nextLine(state, program.value));
  const finished = computed(() => isFinished(architecture, state, program.value));

  /** Runs a CPU operation, turning a CpuError into the visible error message. */
  function attempt(from: ErrorSource, operation: () => void): boolean {
    try {
      operation();
      failure.value = null;
      return true;
    } catch (caught) {
      if (caught instanceof CpuError) {
        failure.value = caught;
        errorFrom.value = from;
        return false;
      }
      throw caught;
    }
  }

  /**
   * Runs instructions straight from the builder, as one: what one builder entry stands for, like
   * the two lines of a RISC-V `li`. If one fails, the ones before it are undone.
   */
  function run(instructions: readonly Instruction[]): boolean {
    return attempt('builder', () => {
      const records: Record[] = [];
      try {
        for (const instruction of instructions) {
          records.push(architecture.execute(state, instruction, null, program.value));
        }
      } catch (caught) {
        for (const done of records.reverse()) undo(state, done);
        throw caught;
      }
      record(records);
    });
  }

  function stepProgram(): void {
    pause();
    attempt('program', () => record([step(architecture, state, program.value)]));
  }

  const { speed, running, pause, runProgram } = useProgramRun(finished, {
    stepLine(writes) {
      let entry: Record | null = null;
      attempt('program', () => {
        if (writes >= MAX_RUN_WRITES) throw tooManyWrites();
        entry = step(architecture, state, program.value);
        record([entry]);
      });
      return entry;
    },
    runToEnd() {
      const result = runToEnd(architecture, state, program.value);
      record(result.records);
      failure.value = result.error;
      errorFrom.value = 'program';
    }
  });

  const { pending, stepPhase } = usePhaseStepping({
    nextLine,
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

  /** Replaces the program and starts the CPU afresh, without its history. */
  function loadProgram(lines: readonly Instruction[]): void {
    reset();
    replaceProgram(lines);
  }

  function loadExample(index: number): void {
    loadProgram(architecture.examples[index].program);
  }

  /** Moves through time: undoes or redoes until exactly `position` instructions have run. */
  function seek(position: number): void {
    pause();
    timeline.seek(position);
    failure.value = null;
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
    Object.assign(state, architecture.createState());
    state.io.in = inputs;
    timeline.clear();
    failure.value = null;
  }

  return {
    architecture,
    state,
    history,
    error,
    errorFrom,
    program,
    insertAt,
    lastRecord,
    future,
    memoryHeat,
    nextLine,
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
    loadProgram,
    loadExample,
    undoLast,
    redo,
    seek,
    setInput,
    reset
  };
}

/** A CPU of one architecture, with everything its panels can use. */
export type CpuOf<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
> = ReturnType<typeof useCpu<Instruction, State, Record>>;

/**
 * What the page around the panels needs of a CPU, whatever its architecture: the program and
 * its history, and the controls that step, run and rewind them.
 */
export interface CpuControls<
  Instruction = ProgramInstruction,
  Record extends ExecutionRecord = ExecutionRecord
> {
  architecture: {
    id: string;
    name: string;
    examples: readonly { id: string }[];
  };
  program: Readonly<Ref<readonly Instruction[]>>;
  history: Readonly<Ref<readonly Record[]>>;
  future: Readonly<Ref<readonly Record[]>>;
  lastRecord: Readonly<Ref<Record | null>>;
  insertAt: Ref<number | null>;
  error: Readonly<Ref<string | null>>;
  errorFrom: Readonly<Ref<ErrorSource>>;
  finished: Readonly<Ref<boolean>>;
  running: Readonly<Ref<boolean>>;
  speed: Ref<RunSpeed>;
  pending: Readonly<Ref<{ phase: 'fetch' | 'decode' } | null>>;
  pause(): void;
  stepProgram(): void;
  stepPhase(): void;
  runProgram(): void;
  undoLast(): void;
  redo(): void;
  seek(position: number): void;
  clearProgram(): void;
  loadExample(index: number): void;
  reset(): void;
}
