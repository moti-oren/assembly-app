import { computed, reactive, type Ref } from 'vue';
import type { Architecture } from '@/core/shared/architecture';
import { keptGiven } from '@/core/shared/challenge';
import { undo, type ExecutionRecord } from '@/core/shared/executionRecord';
import {
  isFinished,
  MAX_RUN_WRITES,
  MAX_STEPS,
  runToEnd,
  step,
  tooManySteps,
  tooManyWrites,
  type ProgramInstruction
} from '@/core/shared/program';
import { setInputPort, type CpuState } from '@/core/shared/state';
import { analytics } from './analyticsClient';
import { useChallenges } from './useChallenges';
import { useCpuError, type ErrorSource } from './useCpuError';
import { useCpuHistory } from './useCpuHistory';
import { usePhaseStepping } from './usePhaseStepping';
import { useProgramLines, type ProgramSource } from './useProgramLines';
import { useProgramRun } from './useProgramRun';
import type { RunSpeed } from './runSpeeds';
import type { ByteChange } from './stepDiff';

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
  const {
    history,
    lastRecord,
    afterOf,
    lastAfter,
    lastWrites,
    future,
    memoryHeat,
    record,
    ...timeline
  } = useCpuHistory<Record>(state);
  const challenges = useChallenges();
  /** The given lines of the challenge the program is for, while it still starts with them. */
  const givenIn = (lines: readonly Instruction[]): number => {
    const id = challenges.active.value[architecture.id];
    const challenge = architecture.challenges.find((each) => each.id === id);
    return challenge ? keptGiven(challenge, lines) : 0;
  };
  const {
    program,
    locked: lockedLines,
    source: programSource,
    stale: programStale,
    lastMove: lastLineMove,
    insertAt,
    editing,
    editLine,
    replaceEditedLine,
    addToProgram,
    removeProgramLine,
    moveProgramLine,
    replaceProgram,
    clearProgram: clearLines
  } = useProgramLines(
    architecture,
    state,
    timeline.forgetFuture,
    () => [...history.value, ...future.value].some((entry) => entry.line !== null),
    givenIn
  );
  const { error, errorFrom, attempt, report, clearError } = useCpuError();
  /** The program line the instruction pointer points at: the one that runs next. */
  const nextLine = computed(() => architecture.nextLine(state, program.value));
  const finished = computed(() => isFinished(architecture, state, program.value));

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
    // The end of the program is where it stops, not a fault: the panel already says Finished.
    if (finished.value) return;
    attempt('program', () => record([step(architecture, state, program.value)]));
  }

  const { speed, running, pause, runProgram } = useProgramRun(finished, {
    stepLine({ steps, writes }) {
      let entry: Record | null = null;
      attempt('program', () => {
        if (steps >= MAX_STEPS) throw tooManySteps();
        if (writes >= MAX_RUN_WRITES) throw tooManyWrites();
        entry = step(architecture, state, program.value);
        record([entry]);
      });
      return entry;
    },
    runToEnd() {
      const result = runToEnd(architecture, state, program.value);
      record(result.records);
      report('program', result.error?.message ?? null);
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

  /**
   * Empties the program; a challenge's given lines are not the user's to clear, and stay. The CPU
   * keeps its registers and history, its instruction pointer included.
   */
  function clearProgram(): void {
    pause();
    clearLines(lockedLines.value);
  }

  /** Replaces the program and starts the CPU afresh, without its history. */
  function loadProgram(lines: readonly Instruction[], from: ProgramSource | null = null): void {
    reset();
    replaceProgram(lines, from);
  }

  function loadExample(index: number): void {
    const { program: lines, name, description } = architecture.examples[index];
    loadProgram(lines, { name, description });
    analytics.track({ name: 'example-loaded', architecture: architecture.id, example: name });
  }

  /** Moves through time: undoes or redoes until exactly `position` instructions have run. */
  function seek(position: number): void {
    pause();
    timeline.seek(position);
    clearError();
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
    programStale.value = false;
    timeline.clear();
    clearError();
  }

  return {
    architecture,
    state,
    history,
    error,
    errorFrom,
    program,
    programSource,
    lockedLines,
    programStale,
    lastLineMove,
    insertAt,
    lastRecord,
    afterOf,
    lastAfter,
    lastWrites,
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
    moveProgramLine,
    editing,
    editLine,
    replaceEditedLine,
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
    examples: readonly { name: string; description: string }[];
    challenges: readonly { id: string }[];
  };
  program: Readonly<Ref<readonly Instruction[]>>;
  /** The example the program was loaded from, until it is edited. */
  programSource: Readonly<Ref<ProgramSource | null>>;
  /** Lines at the top of the program that a challenge gives, and that are not edited or moved. */
  lockedLines: Readonly<Ref<number>>;
  history: Readonly<Ref<readonly Record[]>>;
  future: Readonly<Ref<readonly Record[]>>;
  lastRecord: Readonly<Ref<Record | null>>;
  /** The CPU as the last instruction left it; see useCpuHistory. */
  lastAfter: Readonly<Ref<Record['before'] | null>>;
  /** The bytes the last instruction wrote. */
  lastWrites: Readonly<Ref<ReadonlyMap<number, ByteChange>>>;
  insertAt: Ref<number | null>;
  /** The program line being edited in the builder, if one is. */
  editing: Readonly<Ref<{ line: number } | null>>;
  /** The program line that runs next. */
  nextLine: Readonly<Ref<number>>;
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
  /** Starts editing a program line in the builder, or stops with null. */
  editLine(index: number | null): void;
  moveProgramLine(from: number, to: number): void;
  loadExample(index: number): void;
  reset(): void;
}
