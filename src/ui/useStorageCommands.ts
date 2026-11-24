import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { WIDTHS } from './logicView';
import { momentCommands, type TopicPageActions } from './momentCommands';
import type { PaletteCommand } from './paletteCommand';
import { PULSE_WIRE } from './storageTiming';
import { CELLS, CLOCK_ACTION } from './storageView';
import { useAppCommands } from './useAppCommands';
import type { StorageFile } from './useStorageFile';
import type { StorageLens } from './useStorageLens';

/** Everything the command palette offers in the storage topic, labelled for the current state. */
export function useStorageCommands(
  lens: StorageLens,
  file: StorageFile,
  moment: () => CpuMoment<unknown>,
  page: TopicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => {
    const phase = lens.phase.value;
    const free = lens.cell.free.value;
    const pulsed = free ? PULSE_WIRE[free] : undefined;
    const filePhase = file.phase.value;
    return [
      ...momentCommands(moment(), page),
      { group: 'Register', label: CLOCK_ACTION[phase], run: lens.clock },
      {
        group: 'Register',
        label: 'Start the clock cycle over',
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
      ...(pulsed
        ? [
            {
              group: 'Memory cell',
              label: `Pulse ${pulsed.label}`,
              run: () => lens.cell.pulse(pulsed.signal)
            }
          ]
        : []),
      {
        group: 'Memory cell',
        label: 'Clear the timing diagram',
        disabled: lens.cell.trace.value.length < 2,
        run: lens.cell.clearTrace
      },
      {
        group: 'Register file',
        label: `${CLOCK_ACTION[filePhase]} of the register file`,
        run: file.clock
      },
      {
        group: 'Register file',
        label: 'Start the register file’s clock cycle over',
        disabled: filePhase === 'before',
        run: file.rewind
      },
      {
        group: 'Register file',
        label: file.request.value.write
          ? 'Turn the register file’s write line off'
          : 'Turn the register file’s write line on',
        run: file.flipWrite
      },
      {
        group: 'Register file',
        label: file.fromCpu.value
          ? 'Put back the CPU’s address in the register file'
          : 'Put back the starting address in the register file',
        disabled: !file.isEdited.value,
        run: file.restore
      },
      ...app.value
    ];
  });
}
