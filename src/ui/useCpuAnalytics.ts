import { watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import { analytics } from './analyticsClient';
import type { CpuControls } from './useCpu';

/** Counts what a CPU is used for: its first instruction of the visit, each run, each error. */
export function useCpuAnalytics<Instruction, Record extends ExecutionRecord>(
  cpu: CpuControls<Instruction, Record>
): void {
  const { history, future, running, error } = cpu;
  const architecture = cpu.architecture.id;
  let stepped = false;

  watch([history, future], ([now], [before, wasAhead]) => {
    const last = now.at(-1);
    // Moving through the history runs nothing new.
    if (!last || now.length <= before.length || wasAhead.includes(last)) return;
    if (!stepped) {
      stepped = true;
      analytics.track({ name: 'first-step', architecture });
    }
    // Several lines at once is an instant run, which never sets `running`.
    if (now.length > before.length + 1 && last.line !== null)
      analytics.track({ name: 'program-run', architecture });
  });
  watch(running, (isRunning) => {
    if (isRunning) analytics.track({ name: 'program-run', architecture });
  });
  watch(error, (message) => {
    if (message) analytics.track({ name: 'cpu-error', architecture });
  });
}
