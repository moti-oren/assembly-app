import { computed, ref, shallowRef, watch } from 'vue';
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

/** An answer on show: what was asked, how it did, and how many instructions had run by then. */
export interface Answered {
  question: Question;
  outcome: Outcome;
  at: number;
}

const NO_ANSWERS: Tally = { right: 0, asked: 0 };

/**
 * The answers of prediction mode for one CPU: the last one, until another instruction runs, and
 * how many of this run's were right.
 */
export function usePredictionScore<
  Instruction extends ProgramInstruction,
  State extends CpuState,
  Record extends ExecutionRecord<Instruction>
>(cpu: CpuOf<Instruction, State, Record>, predictor: Predictor<Instruction, State, Record>) {
  const last = shallowRef<Answered | null>(null);
  const tally = ref<Tally>(NO_ANSWERS);
  /** How many instructions had run when a question was skipped, while that is the last word. */
  const skippedAt = ref<number | null>(null);

  /** Checks `given` against what `record`, which has just run, did. */
  function grades(question: Question, given: Answer, record: Record): Outcome {
    const truth = predictor.truth(question, record, cpu.state);
    const wrong = wrongFlags(question, given, truth);
    const why = predictor.why(question, record, cpu.state, wrong);
    const outcome = grade(question, given, truth, why, predictor.formatValue);
    tally.value = counted(tally.value, outcome);
    skippedAt.value = null;
    last.value = { question, outcome, at: cpu.history.value.length };
    analytics.track({
      name: 'prediction-answered',
      architecture: cpu.architecture.id,
      result: outcome.correct ? 'right' : 'wrong'
    });
    return outcome;
  }

  function forgetLast(): void {
    last.value = null;
    skippedAt.value = null;
  }

  /** A question given up on, its instruction run: said in place of a verdict, with the tally. */
  function noteSkipped(): void {
    last.value = null;
    skippedAt.value = cpu.history.value.length;
  }

  // An answer is about one step: undo it or run another, and it has nothing to stand beside.
  watch(
    () => cpu.history.value.length,
    (count) => {
      if (last.value && last.value.at !== count) last.value = null;
      if (skippedAt.value !== null && skippedAt.value !== count) skippedAt.value = null;
      if (count === 0 && cpu.future.value.length === 0) tally.value = NO_ANSWERS;
    }
  );

  return {
    last,
    tally,
    skipped: computed(() => skippedAt.value !== null),
    grades,
    forgetLast,
    noteSkipped
  };
}
