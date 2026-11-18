import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from './storageKeys';
import type { PaletteCommand } from './useCommands';

/**
 * How RISC-V's cycle card shows the instructions: one at a time, or overlapped in the five-stage
 * pipeline, with or without forwarding. Both are remembered.
 */
export const useRv32Pipeline = createGlobalState(() => {
  const shown = useLocalStorage(STORAGE_KEYS.rv32Pipeline, false);
  const forwarding = useLocalStorage(STORAGE_KEYS.rv32Forwarding, true);

  /** The palette's commands for both, labelled for their current state. */
  function commands(): PaletteCommand[] {
    return [
      {
        group: 'CPU',
        label: shown.value ? 'Hide the pipeline' : 'Show the pipeline',
        run: () => {
          shown.value = !shown.value;
        }
      },
      {
        group: 'CPU',
        label: forwarding.value
          ? 'Turn forwarding off in the pipeline'
          : 'Turn forwarding on in the pipeline',
        run: () => {
          forwarding.value = !forwarding.value;
        }
      }
    ];
  }

  return { shown, forwarding, commands };
});
