import { computed, shallowRef, watch, type Ref } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { ProgramInstruction } from '@/core/shared/program';
import type { CpuState } from '@/core/shared/state';
import type { Answer, Predictor, Question } from './prediction';
import type { CpuOf } from './useCpu';
import { usePredictionRun } from './usePredictionRun';
import { usePredictionScore } from './usePredictionScore';
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
  const { last, tally, skipped, grades, forgetLast, noteSkipped } = usePredictionScore(
    cpu,
    predictor
  );
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
    forgetLast();
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
    const outcome = grades(asked.question, given, record);
    // A wrong answer stops a run, so its explanation can be read.
    if (asked.from === 'run') run.answered(outcome.correct);
  }

  /** Runs the instruction without an answer, and without counting it. */
  function skip(): void {
    const asked = asking.value;
    if (!asked) return;
    asking.value = null;
    const ran = execute(asked);
    if (ran) noteSkipped();
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
  // without its instruction.
  watch([executed, cpu.program, cpu.nextLine], () => {
    if (asking.value && asking.value.from !== 'builder') dismiss();
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
    skipped,
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
