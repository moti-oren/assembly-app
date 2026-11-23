import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { WIDTHS } from './logicView';
import { momentCommands, type TopicPageActions } from './momentCommands';
import { LENSES, widthAllowed } from './numbersView';
import type { PaletteCommand } from './paletteCommand';
import { useAppCommands } from './useAppCommands';
import type { NumberLens } from './useNumberLens';

/** Everything the command palette offers in the number topic, labelled for the current state. */
export function useNumbersCommands(
  lens: NumberLens,
  moment: () => CpuMoment<unknown>,
  page: TopicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const { kind } = lens.request.value;
    return [
      ...momentCommands(moment(), page),
      {
        group: 'Numbers',
        label: lens.fromCpu.value ? 'Put back the CPU’s values' : 'Put back the starting values',
        disabled: !lens.isEdited.value,
        run: lens.restore
      },
      ...LENSES.map((choice) => ({
        group: 'Numbers',
        label: `Try the numbers: ${choice.label}`,
        disabled: kind === choice.id,
        run: () => lens.pick(choice.id)
      })),
      ...WIDTHS.map((each) => ({
        group: 'Numbers',
        label: `Make the numbers ${each} bits wide`,
        disabled: lens.width.value === each || !widthAllowed(lens.request.value, each),
        run: () => lens.setWidth(each)
      })),
      ...app.value
    ];
  });
}
