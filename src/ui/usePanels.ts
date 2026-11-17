import { ref, watch, type Ref } from 'vue';
import { decode } from '@/core/decode';
import type { Instruction } from '@/core/instructions';
import type { Cpu } from './useCpu';

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

const usesPort = (instruction: Instruction): boolean => decode(instruction).port !== null;

export function usePanels(cpu: Cpu): Panels {
  const { history, program, lastRecord } = cpu;
  const historyShown = ref(false);
  const bytesShown = ref(false);
  const devicesShown = ref(false);
  const inspectedLine = ref<number | null>(null);

  watch([() => history.value.length, program], () => {
    inspectedLine.value = null;
  });

  watch([program, lastRecord], ([lines, record]) => {
    const inProgram = lines.some(usesPort);
    if (inProgram || (record && usesPort(record.instruction))) devicesShown.value = true;
  });

  function inspect(line: number): void {
    inspectedLine.value = line;
    bytesShown.value = true;
  }

  return { historyShown, bytesShown, devicesShown, inspectedLine, inspect };
}
