import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { FREE_OPERATIONS, WIDTHS } from './logicView';
import { momentCommands, type TopicPageActions } from './momentCommands';
import type { PaletteCommand } from './paletteCommand';
import { useAppCommands } from './useAppCommands';
import type { LogicLens } from './useLogicLens';

/** Everything the command palette offers in the logic topic, labelled for the current state. */
export function useLogicCommands(
  lens: LogicLens,
  moment: () => CpuMoment<unknown>,
  page: TopicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const width = lens.request.value.width;
    return [
      ...momentCommands(moment(), page),
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
