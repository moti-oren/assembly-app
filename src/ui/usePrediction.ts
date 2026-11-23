import { computed, ref, shallowRef, watch, type Ref } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { ProgramInstruction } from '@/core/shared/program';
import type { CpuState } from '@/core/shared/state';
import { analytics } from './analyticsClient';
import {
  counted,
  grade,
  wrongFlags,
  type Answer,
  type Outcome,
  type Predictor,
  type Question,
  type Tally
} from './prediction';
import type { CpuOf } from './useCpu';
import { usePredictionRun } from './usePredictionRun';
import { usePreferences } from './usePreferences';

/** Where an instruction that is asked about comes from. */
export type AskedFrom = 'step' | 'builder' | 'run';

/** A question waiting for its answer, and the instruction that runs once it has one. */
export interface Asking<Instruction = unknown> {
  question: Question;
  from: AskedFrom;
  instruction: Instruction;
}

/** What the page's builder is asked to do once its instruction was answered and ran. */
export interface PredictionHooks {
  clearBuilder: () => void;
}

/** An answer on show: what was asked, how it did, and how many instructions had run by then. */
export interface Answered {
  question: Question;
  outcome: Outcome;
  at: number;
}

const NO_ANSWERS: Tally = { right: 0, asked: 0 };

/**
 * Prediction mode for one CPU: before an instruction runs, the learner is asked what it will
 * do. `controls` is the CPU with its step, run and builder actions going through that question;
 * with the mode off they are the CPU's own.
 */
export function usePrediction<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(
  cpu: CpuOf<Instruction, State, Record>,
  predictor: Predictor<Instruction, State, Record>,
  hooks: PredictionHooks
) {
  const { prediction, predictStep, predictBuilder, predictRun } = usePreferences();
  const enabled = { step: predictStep, builder: predictBuilder, run: predictRun };
  const asking = shallowRef<Asking<Instruction> | null>(null);
  /** The last answer, until another instruction runs. */
  const last = shallowRef<Answered | null>(null);
  const tally = ref<Tally>(NO_ANSWERS);
  const executed = computed(() => cpu.history.value.length);

  function questionFor(from: AskedFrom, instruction: Instruction | undefined): Question | null {
    if (!prediction.value || !enabled[from].value || !instruction) return null;
    return predictor.question(instruction);
  }

  /** The line a step would run, if there is one. */
  function nextInstruction(): Instruction | undefined {
    return cpu.finished.value ? undefined : cpu.program.value[cpu.nextLine.value];
  }

  function ask(from: AskedFrom, instruction: Instruction, question: Question): void {
    last.value = null;
    asking.value = { question, from, instruction };
  }

  /** Runs the instruction a question was about; false when the CPU refused it. */
  function execute(asked: Asking<Instruction>): boolean {
    const before = executed.value;
    if (asked.from === 'builder') {
      if (cpu.run([asked.instruction])) hooks.clearBuilder();
    } else {
      cpu.stepProgram();
    }
    return executed.value > before;
  }

  const run = usePredictionRun(cpu, {
    next: () => {
      const instruction = nextInstruction();
      const question = questionFor('run', instruction);
      if (!instruction || !question) return false;
      ask('run', instruction, question);
      return true;
    },
    stopped: () => {
      if (asking.value?.from === 'run') asking.value = null;
    }
  });

  function answer(given: Answer): void {
    const asked = asking.value;
    if (!asked) return;
    asking.value = null;
    const record = execute(asked) ? cpu.lastRecord.value : null;
    if (!record) return run.stop();
    const state = cpu.state as unknown as State;
    const truth = predictor.truth(asked.question, record, state);
    const why = predictor.why(
      asked.question,
      record,
      state,
      wrongFlags(asked.question, given, truth)
    );
    const outcome = grade(asked.question, given, truth, why, predictor.formatValue);
    tally.value = counted(tally.value, outcome);
    analytics.track({
      name: 'prediction-answered',
      architecture: cpu.architecture.id,
      result: outcome.correct ? 'right' : 'wrong'
    });
    last.value = { question: asked.question, outcome, at: executed.value };
    // A wrong answer stops a run, so its explanation can be read.
    if (asked.from === 'run') run.answered(outcome.correct);
  }

  /** Runs the instruction without an answer, and without counting it. */
  function skip(): void {
    const asked = asking.value;
    if (!asked) return;
    asking.value = null;
    const ran = execute(asked);
    if (asked.from === 'run') run.answered(ran);
  }

  /** Gives the question up without running anything. */
  function dismiss(): void {
    asking.value = null;
    run.stop();
  }

  function stepProgram(): void {
    if (asking.value) return skip();
    run.stop();
    const instruction = nextInstruction();
    const question = questionFor('step', instruction);
    if (instruction && question) ask('step', instruction, question);
    else cpu.stepProgram();
  }

  /** Only the last phase runs the instruction: the question comes before it. */
  function stepPhase(): void {
    if (asking.value) return skip();
    run.stop();
    const instruction = nextInstruction();
    const question = cpu.pending.value?.phase === 'decode' && questionFor('step', instruction);
    if (instruction && question) ask('step', instruction, question);
    else cpu.stepPhase();
  }

  /** The builder's instruction. One that asks is not run yet, so the builder keeps its words. */
  function runInstructions(instructions: readonly Instruction[]): boolean {
    dismiss();
    const question = instructions.length === 1 && questionFor('builder', instructions[0]);
    if (!question) return cpu.run(instructions);
    ask('builder', instructions[0], question);
    return false;
  }

  // Whatever else moved the CPU or the program (undo, an edit, a reset) leaves the question
  // without its instruction, and the answer on show without the step it was about.
  watch([executed, cpu.program, cpu.nextLine], () => {
    if (asking.value && asking.value.from !== 'builder') dismiss();
  });
  watch(executed, (count) => {
    if (last.value && last.value.at !== count) last.value = null;
    if (count === 0 && cpu.future.value.length === 0) tally.value = NO_ANSWERS;
  });
  /** `draft` is what the builder holds: once it changes, a question about it is about nothing. */
  function followBuilder(draft: Ref<unknown>): void {
    watch(draft, () => {
      if (asking.value?.from === 'builder') asking.value = null;
    });
  }

  watch(prediction, (on) => {
    if (!on) dismiss();
  });

  return {
    asking,
    last,
    tally,
    answer,
    skip,
    followBuilder,
    controls: {
      ...cpu,
      running: run.running,
      pause: run.pause,
      runProgram: run.runProgram,
      stepProgram,
      stepPhase,
      run: runInstructions
    }
  };
}
