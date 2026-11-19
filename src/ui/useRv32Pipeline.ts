import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from './storageKeys';
import type { Messages } from './messages/en';
import type { PaletteCommand } from './useCommands';

/**
 * How RISC-V's cycle card shows the instructions: one at a time, or overlapped in the five-stage
 * pipeline, with or without forwarding. Both are remembered.
 */
export const useRv32Pipeline = createGlobalState(() => {
  const shown = useLocalStorage(STORAGE_KEYS.rv32Pipeline, false);
  const forwarding = useLocalStorage(STORAGE_KEYS.rv32Forwarding, true);

  /** The palette's commands for both, labelled for their current state. */
  function commands(m: Messages): PaletteCommand[] {
    return [
      {
        group: m.commandGroups.cpu,
        label: m.commands.pipeline(shown.value),
        run: () => {
          shown.value = !shown.value;
        }
      },
      {
        group: m.commandGroups.cpu,
        label: m.commands.forwarding(forwarding.value),
        run: () => {
          forwarding.value = !forwarding.value;
        }
      }
    ];
  }

  return { shown, forwarding, commands };
});
