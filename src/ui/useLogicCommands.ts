import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { FREE_OPERATIONS, WIDTHS } from './logicView';
import type { PaletteCommand } from './paletteCommand';
import { useAppCommands } from './useAppCommands';
import type { LogicLens } from './useLogicLens';

/** What the palette asks of the page of the logic topic. */
export interface LogicPageActions {
  seek: (position: number) => void;
  back: () => void;
}

/** Everything the command palette offers in the logic topic, labelled for the current state. */
export function useLogicCommands(
  lens: LogicLens,
  moment: () => CpuMoment<unknown>,
  page: LogicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const { cpu, previous, next } = moment();
    const width = lens.request.value.width;
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
        group: 'Circuit',
        label: lens.fromCpu.value ? 'Put back the CPU’s values' : 'Put back the starting values',
        disabled: !lens.isEdited.value,
        run: lens.restore
      },
      ...FREE_OPERATIONS.map((choice) => ({
        group: 'Circuit',
        label: `Try the circuit: ${choice.label}`,
        disabled: lens.operation.value === choice.id,
        run: () => lens.pick(choice.id)
      })),
      ...WIDTHS.map((each) => ({
        group: 'Circuit',
        label: `Make the circuit ${each} bits wide`,
        disabled: width === each,
        run: () => lens.setWidth(each)
      })),
      ...app.value
    ];
  });
}
