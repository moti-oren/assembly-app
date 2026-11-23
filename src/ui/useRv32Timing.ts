import { computed, type ComputedRef } from 'vue';
import type { Program } from '@/core/shared/program';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { Instruction } from '@/core/rv32/instructions';
import {
  continues,
  followPipeline,
  startPipeline,
  timingOf,
  type PipelineRun,
  type PipelineTiming
} from '@/core/rv32/pipeline';
import { useRv32Pipeline } from './useRv32Pipeline';

/**
 * How the instructions that ran flow through the pipeline, for the chart and for the sound of a
 * step alike. It is worked out only while something reads it, and a step sends one instruction
 * through: the pipeline starts again only when the history no longer continues the one it read
 * (an undo, a seek, a reset), or the program or one of the pipeline's switches changed.
 */
export function useRv32Timing(cpu: {
  history: { readonly value: readonly ExecutionRecord[] };
  program: { readonly value: Program<Instruction> };
}): ComputedRef<PipelineTiming> {
  const { forwarding, predictor } = useRv32Pipeline();
  // A cache, brought up to the history each time the timing is worked out; nothing else reads it.
  let run: PipelineRun | null = null;

  return computed(() => {
    const records = cpu.history.value;
    const program = cpu.program.value;
    const options = { forwarding: forwarding.value, predictor: predictor.value };
    const same =
      run !== null &&
      run.program === program &&
      run.options.forwarding === options.forwarding &&
      run.options.predictor === options.predictor &&
      continues(run, records);
    if (!run || !same) run = startPipeline(program, options);
    followPipeline(run, records);
    return timingOf(run);
  });
}
