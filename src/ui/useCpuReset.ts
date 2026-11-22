import { computed, ref } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { CpuControls } from './useCpu';
import { usePreferences } from './usePreferences';

/**
 * Resetting the CPU, which loses its history: when that needs confirming first, and running the
 * program again once it is done.
 */
export function useCpuReset<Instruction, Record extends ExecutionRecord>(
  cpu: CpuControls<Instruction, Record>
) {
  /** True while the user is asked to confirm a reset, which would lose the history. */
  const resetAsked = ref(false);
  /** Instructions a reset would lose, undone ones included. */
  const historyLength = computed(() => cpu.history.value.length + cpu.future.value.length);
  /** Whether the reset being confirmed came from "Run again", which runs the program after it. */
  let runsAfter = false;
  const { confirmReset: asksFirst } = usePreferences();

  /**
   * True when a reset loses nothing: there is no history, or all of it is the program run to its
   * end, which running it again brings back.
   */
  function nothingToLose(): boolean {
    if (historyLength.value === 0) return true;
    return (
      cpu.finished.value &&
      cpu.future.value.length === 0 &&
      cpu.history.value.every((record) => record.line !== null)
    );
  }

  function start(run: boolean): void {
    runsAfter = run;
    if (!asksFirst.value || nothingToLose()) confirmReset();
    else resetAsked.value = true;
  }

  /** Resets, asking first when the history would be lost, unless the user chose not to be asked. */
  function askReset(): void {
    start(false);
  }

  /** Resets and runs the program from its first line, asking first as a reset does. */
  function runAgain(): void {
    start(true);
  }

  /** The reset itself, once nothing stands in its way. */
  function confirmReset(): void {
    cpu.reset();
    if (runsAfter) cpu.runProgram();
    runsAfter = false;
  }

  return { resetAsked, historyLength, askReset, runAgain, confirmReset };
}
