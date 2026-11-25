import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { momentCommands, type TopicPageActions } from './momentCommands';
import type { PaletteCommand } from './paletteCommand';
import { CLOCK_ACTION } from './storageView';
import { useAppCommands } from './useAppCommands';
import type { ControlLens } from './useControlLens';

/** What the palette asks of the control topic's page. */
export interface ControlPageActions extends TopicPageActions {
  /** Puts the keyboard in the box the word is typed in. */
  focusWord: () => void;
}

/** Everything the command palette offers in the control topic, labelled for the current state. */
export function useControlCommands(
  lens: ControlLens,
  moment: () => CpuMoment<unknown>,
  page: ControlPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const phase = lens.phase.value;
    const counted = lens.pc.value !== null;
    return [
      ...momentCommands(moment(), page),
      {
        group: 'Control unit',
        label: 'Type an instruction word',
        moves: 'focus',
        run: page.focusWord
      },
      {
        group: 'Control unit',
        label: lens.fromCpu.value ? 'Put back the CPU’s word' : 'Put back the starting word',
        disabled: !lens.isEdited.value,
        run: lens.restore
      },
      {
        group: 'Control unit',
        label: 'Mend every control line',
        disabled: !lens.anyBroken.value,
        run: lens.repairLines
      },
      {
        group: 'Program counter',
        label: CLOCK_ACTION[phase],
        disabled: !counted,
        run: lens.clock
      },
      {
        group: 'Program counter',
        label: 'Rewind the clock',
        disabled: !counted || phase === 'before',
        run: lens.rewind
      },
      ...app.value
    ];
  });
}
