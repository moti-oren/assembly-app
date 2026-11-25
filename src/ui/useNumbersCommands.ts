import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { WIDTHS } from './logicView';
import { momentCommands, type TopicPageActions } from './momentCommands';
import { DIRECTIONS, FILLS, withCount, withDirection } from './numbersShift';
import { LENSES, widthAllowed } from './numbersView';
import type { PaletteCommand } from './paletteCommand';
import { useAppCommands } from './useAppCommands';
import type { NumberLens } from './useNumberLens';

/** The one more coming in to a sum or a difference: the carry or the borrow. */
function extraCommand(lens: NumberLens): PaletteCommand {
  const { value: request } = lens.request;
  const sum = request.kind === 'add' || request.kind === 'subtract';
  const extra = sum && request.extra === 1;
  const what =
    request.kind === 'subtract' ? 'one more taken off (a borrow)' : 'one more added (a carry)';
  return {
    group: 'Numbers',
    label: extra ? `Leave out the ${what}` : `Bring in ${what}`,
    keywords: 'carry in borrow in',
    disabled: !sum,
    run: lens.flipExtra
  };
}

/** The shift's direction, its fill and how many places, while the numbers show a shift. */
function shiftCommands(lens: NumberLens): PaletteCommand[] {
  const { value: request } = lens.request;
  if (request.kind !== 'shift') return [];
  const group = 'Shift';
  return [
    ...DIRECTIONS.map((direction) => ({
      group,
      label: `Shift ${direction.label}`,
      current: request.direction === direction.id,
      run: () => lens.change(withDirection(request, direction.id))
    })),
    ...FILLS.map((fill) => ({
      group,
      label: `Shift right: ${fill.label.toLowerCase()}`,
      current: request.direction === 'right' && request.fill === fill.id,
      disabled: request.direction === 'left',
      run: () => lens.change({ ...request, fill: fill.id })
    })),
    {
      group,
      label: 'Shift one place more',
      disabled: request.count >= request.width,
      run: () => lens.change(withCount(request, request.count + 1))
    },
    {
      group,
      label: 'Shift one place fewer',
      disabled: request.count <= 0,
      run: () => lens.change(withCount(request, request.count - 1))
    }
  ];
}

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
      {
        group: 'Numbers',
        label:
          lens.byteOrder.value === 'little'
            ? 'Show the value’s bytes high byte first'
            : 'Show the value’s bytes low byte first',
        disabled: kind !== 'value' || lens.width.value === 8,
        run: () => lens.setByteOrder(lens.byteOrder.value === 'little' ? 'big' : 'little')
      },
      extraCommand(lens),
      ...shiftCommands(lens),
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
