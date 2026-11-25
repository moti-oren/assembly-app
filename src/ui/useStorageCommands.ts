import { computed, type ComputedRef } from 'vue';
import type { CpuMoment } from './cpuMoment';
import { WIDTHS } from './logicView';
import { momentCommands, type TopicPageActions } from './momentCommands';
import type { PaletteCommand } from './paletteCommand';
import { SEQUENCE_INPUT, sequenceLabel, SEQUENCES } from './storageSequence';
import { PULSE_WIRE } from './storageTiming';
import { CELLS, CLOCK_ACTION } from './storageView';
import { useAppCommands } from './useAppCommands';
import type { StorageFile } from './useStorageFile';
import type { StorageLens } from './useStorageLens';
import type { StorageSequence } from './useStorageSequence';

function registerCommands(lens: StorageLens): PaletteCommand[] {
  const phase = lens.phase.value;
  return [
    { group: 'Register', label: CLOCK_ACTION[phase], run: lens.clock },
    {
      group: 'Register',
      label: 'Rewind the clock',
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
    }))
  ];
}

function cellCommands({ cell }: StorageLens): PaletteCommand[] {
  const free = cell.free.value;
  const pulsed = free ? PULSE_WIRE[free] : undefined;
  return [
    ...CELLS.map((choice) => ({
      group: 'Memory cell',
      label: `Show the gates of: ${choice.label}`,
      disabled: cell.cell.value === choice.id,
      run: () => cell.pick(choice.id)
    })),
    ...(pulsed
      ? [
          {
            group: 'Memory cell',
            label: `Pulse ${pulsed.label}`,
            run: () => cell.pulse(pulsed.signal)
          }
        ]
      : []),
    {
      group: 'Memory cell',
      label: 'Clear the timing diagram',
      disabled: cell.trace.value.length < 2,
      run: cell.clearTrace
    }
  ];
}

function fileCommands(file: StorageFile): PaletteCommand[] {
  const phase = file.phase.value;
  return [
    {
      group: 'Register file',
      label: `${CLOCK_ACTION[phase]} of the register file`,
      run: file.clock
    },
    {
      group: 'Register file',
      label: 'Rewind the register file’s clock',
      disabled: phase === 'before',
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
    }
  ];
}

function sequenceCommands(sequence: StorageSequence): PaletteCommand[] {
  const group = 'Counter and shift register';
  const kind = sequence.kind.value;
  const name = sequenceLabel(kind).toLowerCase();
  const input = SEQUENCE_INPUT[kind];
  return [
    ...SEQUENCES.map((choice) => ({
      group,
      label: `Show the ${choice.label.toLowerCase()}`,
      disabled: kind === choice.id,
      run: () => sequence.pick(choice.id)
    })),
    { group, label: `Pulse the clock of the ${name}`, run: sequence.pulse },
    {
      group,
      label: `Set ${input.label} of the ${name} to ${sequence.inputs.value[input.signal] ? 0 : 1}`,
      run: sequence.flipInput
    },
    {
      group,
      label: `Clear the ${name}`,
      disabled: sequence.trace.value.length < 2,
      run: sequence.reset
    }
  ];
}

/** Everything the command palette offers in the storage topic, labelled for the current state. */
export function useStorageCommands(
  lens: StorageLens,
  file: StorageFile,
  sequence: StorageSequence,
  moment: () => CpuMoment<unknown>,
  page: TopicPageActions
): ComputedRef<PaletteCommand[]> {
  const app = useAppCommands();

  return computed<PaletteCommand[]>(() => [
    ...momentCommands(moment(), page),
    ...registerCommands(lens),
    ...cellCommands(lens),
    ...fileCommands(file),
    ...sequenceCommands(sequence),
    ...app.value
  ]);
}
