import { computed, type ComputedRef } from 'vue';
import { EXAMPLE_PROGRAMS } from '@/core/program';
import type { PaletteCommand } from './components/CommandPalette.vue';
import { RUN_SPEEDS, type Cpu, type RunSpeed } from './useCpu';
import type { Panels } from './usePanels';
import { usePreferences } from './usePreferences';

/** Everything the command palette offers, labelled for the current state. */
export function useCommands(cpu: Cpu, panels: Panels): ComputedRef<PaletteCommand[]> {
  const { isDark, soundOn, cpuView, toggleTheme } = usePreferences();
  const { history, program, future, finished, speed, running } = cpu;
  const { historyShown, bytesShown, devicesShown } = panels;

  return computed<PaletteCommand[]>(() => [
    {
      group: 'Program',
      label: 'Step one line',
      disabled: finished.value,
      run: cpu.stepProgram
    },
    {
      group: 'Program',
      label: 'Step one phase (fetch, decode, execute)',
      disabled: finished.value,
      run: cpu.stepPhase
    },
    running.value
      ? { group: 'Program', label: 'Pause', run: cpu.pause }
      : { group: 'Program', label: 'Run', disabled: finished.value, run: cpu.runProgram },
    {
      group: 'Program',
      label: 'Clear the program',
      disabled: program.value.length === 0,
      run: cpu.clearProgram
    },
    { group: 'History', label: 'Undo', disabled: history.value.length === 0, run: cpu.undoLast },
    { group: 'History', label: 'Redo', disabled: future.value.length === 0, run: cpu.redo },
    {
      group: 'History',
      label: historyShown.value ? 'Hide the history list' : 'Show the history list',
      run: () => {
        historyShown.value = !historyShown.value;
      }
    },
    { group: 'History', label: 'Reset the CPU', run: cpu.reset },
    {
      group: 'Program',
      label: bytesShown.value ? 'Hide the machine code' : 'Show the machine code',
      run: () => {
        bytesShown.value = !bytesShown.value;
      }
    },
    {
      group: 'Devices',
      label: devicesShown.value ? 'Hide the I/O devices' : 'Show the I/O devices',
      run: () => {
        devicesShown.value = !devicesShown.value;
      }
    },
    ...(Object.keys(RUN_SPEEDS) as RunSpeed[]).map((name) => ({
      group: 'Run speed',
      label: name[0].toUpperCase() + name.slice(1),
      disabled: speed.value === name,
      run: () => {
        speed.value = name;
      }
    })),
    ...EXAMPLE_PROGRAMS.map((example, index) => ({
      group: 'Examples',
      label: `Load "${example.name}"`,
      run: () => cpu.loadExample(index)
    })),
    {
      group: 'Preferences',
      label: isDark.value ? 'Switch to light theme' : 'Switch to dark theme',
      run: toggleTheme
    },
    {
      group: 'Preferences',
      label: cpuView.value === 'diagram' ? 'Show the CPU as tables' : 'Show the CPU as a diagram',
      run: () => {
        cpuView.value = cpuView.value === 'diagram' ? 'table' : 'diagram';
      }
    },
    {
      group: 'Preferences',
      label: soundOn.value ? 'Turn sound off' : 'Turn sound on',
      run: () => {
        soundOn.value = !soundOn.value;
      }
    }
  ]);
}
