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
      ...faultCommands(lens),
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

/** Breaking and mending the gate picked in the drawing of one bit. */
function faultCommands(lens: LogicLens): PaletteCommand[] {
  const group = 'Faults';
  const gate = lens.chosenGate.value;
  const repairAll = {
    group,
    label: 'Repair every gate',
    disabled: lens.faultCount.value === 0,
    run: lens.repairAll
  };
  if (!gate) return [repairAll];
  const stuck = lens.faults.value[gate.id];
  const name = `${gate.kind.toUpperCase()} gate picked`;
  return [
    {
      group,
      label: `Break the ${name}: stuck at 0`,
      disabled: stuck === 0,
      run: () => lens.stickGate(gate.id, 0)
    },
    {
      group,
      label: `Break the ${name}: stuck at 1`,
      disabled: stuck === 1,
      run: () => lens.stickGate(gate.id, 1)
    },
    {
      group,
      label: `Repair the ${name}`,
      disabled: stuck === undefined,
      run: () => lens.repairGate(gate.id)
    },
    repairAll
  ];
}
