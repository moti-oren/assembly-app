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
      ...timeCommands(lens),
      ...app.value
    ];
  });
}

/** The commands of the adder's gate delays; a circuit that is not the adder has none. */
function timeCommands(lens: LogicLens): PaletteCommand[] {
  const { time } = lens;
  if (!time.available.value) return [];
  const group = 'Gate delays';
  const longest = { group, label: 'Try the longest carry', run: lens.tryLongestCarry };
  if (!time.on.value) return [{ group, label: 'Slow down time', run: time.toggle }, longest];
  return [
    { group, label: 'Back to full speed', run: time.toggle },
    {
      group,
      label: time.playing.value ? 'Pause the gate delays' : 'Play the gate delays',
      disabled: time.last.value === 0,
      run: time.playing.value ? time.pause : time.play
    },
    { group, label: 'Step one gate delay', disabled: time.settled.value, run: time.stepOn },
    {
      group,
      label: 'Step back one gate delay',
      disabled: time.step.value === 0,
      run: time.stepBack
    },
    {
      group,
      label: 'Rewind to the moment the inputs changed',
      disabled: time.step.value === 0,
      run: time.rewind
    },
    longest
  ];
}
