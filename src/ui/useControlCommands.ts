import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { momentCommands, type TopicPageActions } from './momentCommands';
import type { PaletteCommand } from './paletteCommand';
import { CLOCK_ACTION } from './storageView';
import { useAppCommands } from './useAppCommands';
import type { ControlLens } from './useControlLens';

/** Everything the command palette offers in the control topic, labelled for the current state. */
export function useControlCommands(
  lens: ControlLens,
  moment: () => CpuMoment<unknown>,
  page: TopicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const phase = lens.phase.value;
    const counted = lens.pc.value !== null;
    return [
      ...momentCommands(moment(), page),
      {
        group: 'Control unit',
        label: lens.fromCpu.value ? 'Put back the CPU’s word' : 'Put back the starting word',
        disabled: !lens.isEdited.value,
        run: lens.restore
      },
      {
        group: 'Program counter',
        label: CLOCK_ACTION[phase],
        disabled: !counted,
        run: lens.clock
      },
      {
        group: 'Program counter',
        label: 'Start the clock cycle over',
        disabled: !counted || phase === 'before',
        run: lens.rewind
      },
      ...app.value
    ];
  });
}
