import { ref, watch, type Ref } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { CpuControls } from './useCpu';
import { useSidebarLayout } from './useSidebarLayout';

/** The panels that can be shown or hidden, and the program line whose bytes are on show. */
export interface Panels {
  /** The full list of executed instructions; the timeline itself is always in the bar. */
  historyShown: Ref<boolean>;
  bytesShown: Ref<boolean>;
  /** The LEDs, switches, digits and terminal. They open by themselves when a program uses a port. */
  devicesShown: Ref<boolean>;
  /** A program line whose bytes were clicked; it stays on show until the program moves on. */
  inspectedLine: Ref<number | null>;
  inspect: (line: number) => void;
}

/** Whether a program, or the instruction that ran last, uses the I/O devices. */
export type UsesDevices<Instruction, Record> = (
  program: readonly Instruction[],
  last: Record | null
) => boolean;

export function usePanels<Instruction, Record extends ExecutionRecord>(
  cpu: CpuControls<Instruction, Record>,
  usesDevices: UsesDevices<Instruction, Record>
): Panels {
  const { history, program, lastRecord } = cpu;
  const historyShown = ref(false);
  const bytesShown = ref(false);
  const devicesShown = ref(false);
  const inspectedLine = ref<number | null>(null);
  const sidebar = useSidebarLayout();

  watch([() => history.value.length, program], () => {
    inspectedLine.value = null;
  });

  watch([program, lastRecord], ([lines, record]) => {
    if (usesDevices(lines, record)) devicesShown.value = true;
  });

  function inspect(line: number): void {
    inspectedLine.value = line;
    bytesShown.value = true;
    sidebar.expand('encoding');
  }

  return { historyShown, bytesShown, devicesShown, inspectedLine, inspect };
}
