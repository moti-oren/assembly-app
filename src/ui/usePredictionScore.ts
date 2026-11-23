import { ref, shallowRef, watch } from 'vue';
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

  /** Checks `given` against what `record`, which has just run, did. */
  function grades(question: Question, given: Answer, record: Record): Outcome {
    const truth = predictor.truth(question, record, cpu.state);
    const wrong = wrongFlags(question, given, truth);
    const why = predictor.why(question, record, cpu.state, wrong);
    const outcome = grade(question, given, truth, why, predictor.formatValue);
    tally.value = counted(tally.value, outcome);
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
  }

  // An answer is about one step: undo it or run another, and it has nothing to stand beside.
  watch(
    () => cpu.history.value.length,
    (count) => {
      if (last.value && last.value.at !== count) last.value = null;
      if (count === 0 && cpu.future.value.length === 0) tally.value = NO_ANSWERS;
    }
  );

  return { last, tally, grades, forgetLast };
}
