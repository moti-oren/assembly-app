import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { WIDTHS } from './logicView';
import { LENSES, widthAllowed } from './numbersView';
import type { PaletteCommand } from './paletteCommand';
import { useAppCommands } from './useAppCommands';
import type { NumberLens } from './useNumberLens';

/** What the palette asks of the page of the number topic. */
export interface NumbersPageActions {
  seek: (position: number) => void;
  back: () => void;
}

/** Everything the command palette offers in the number topic, labelled for the current state. */
export function useNumbersCommands(
  lens: NumberLens,
  moment: () => CpuMoment<unknown>,
  page: NumbersPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const { cpu, previous, next } = moment();
    const { kind } = lens.request.value;
    return [
      {
        group: 'CPU',
        label: `Go back to the ${cpu}`,
        // The CPU's page takes focus; the palette must not take it back as it closes.
        moves: 'focus',
        run: page.back
      },
      {
        group: 'CPU',
        label: 'Show the operation before this one',
        disabled: previous === null,
        run: () => previous !== null && page.seek(previous)
      },
      {
        group: 'CPU',
        label: 'Show the operation after this one',
        disabled: next === null,
        run: () => next !== null && page.seek(next)
      },
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
