import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { WIDTHS } from './logicView';
import { momentCommands, type TopicPageActions } from './momentCommands';
import type { PaletteCommand } from './paletteCommand';
import { CELLS, CLOCK_ACTION } from './storageView';
import { useAppCommands } from './useAppCommands';
import type { StorageLens } from './useStorageLens';

/** Everything the command palette offers in the storage topic, labelled for the current state. */
export function useStorageCommands(
  lens: StorageLens,
  moment: () => CpuMoment<unknown>,
  page: TopicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const phase = lens.phase.value;
    return [
      ...momentCommands(moment(), page),
      { group: 'Register', label: CLOCK_ACTION[phase], run: lens.clock },
      {
        group: 'Register',
        label: 'Go back to before the clock rose',
        disabled: phase === 'before',
        run: lens.rewind
      },
      {
        group: 'Register',
        label: lens.fromCpu.value ? 'Put back the CPU’s values' : 'Put back the starting values',
        disabled: !lens.isEdited.value,
        run: lens.restore
      },
      ...WIDTHS.map((each) => ({
        group: 'Register',
        label: `Make the register ${each} bits wide`,
        disabled: lens.request.value.width === each,
        run: () => lens.setWidth(each)
      })),
      ...CELLS.map((choice) => ({
        group: 'Memory cell',
        label: `Show the gates of: ${choice.label}`,
        disabled: lens.cell.cell.value === choice.id,
        run: () => lens.cell.pick(choice.id)
      })),
      ...app.value
    ];
  });
}
