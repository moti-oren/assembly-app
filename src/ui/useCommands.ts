import { computed, type ComputedRef } from 'vue';
import { EXAMPLE_PROGRAMS } from '@/core/program';
import type { PaletteCommand } from './components/CommandPalette.vue';
import { describeMemoryAccess } from './describe';
import { RUN_SPEED_NAMES, SPEED_LABELS, type Cpu } from './useCpu';
import { usePanelOrder } from './usePanelOrder';
import type { Panels } from './usePanels';
import { usePreferences } from './usePreferences';

/** What the palette asks of components on the page, which own the state these act on. */
export interface PageActions {
  focusBuilder: () => void;
  /** Opens the confirmation; clearing cannot be undone. */
  askClearProgram: () => void;
  showStackTop: () => void;
  showLastAccess: () => void;
}

/** Everything the command palette offers, labelled for the current state. */
export function useCommands(
  cpu: Cpu,
  panels: Panels,
  page: PageActions
): ComputedRef<PaletteCommand[]> {
  const { isDark, soundOn, cpuView, toggleTheme } = usePreferences();
  const panelOrder = usePanelOrder();
  const { state, history, program, insertAt, lastRecord, future, finished, speed, running } = cpu;
  const { historyShown, bytesShown, devicesShown } = panels;

  /** Whether the last instruction read or wrote memory, so there is an access to show. */
  const hasLastAccess = computed(() => {
    void state.memoryVersion;
    return lastRecord.value !== null && describeMemoryAccess(state, lastRecord.value) !== null;
  });

  return computed<PaletteCommand[]>(() => [
    { group: 'Program', label: 'Write an instruction', moves: 'focus', run: page.focusBuilder },
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
      : {
          group: 'Program',
          label: 'Run the program',
          disabled: finished.value,
          run: cpu.runProgram
        },
    // Only while new lines go above a chosen line; at the end is where they go otherwise.
    ...(insertAt.value === null
      ? []
      : [
          {
            group: 'Program',
            label: 'Add new lines at the end',
            run: () => {
              insertAt.value = null;
            }
          }
        ]),
    {
      group: 'Program',
      label: 'Clear the program…',
      disabled: program.value.length === 0,
      // The dialog takes focus; the palette must not take it back as it closes.
      moves: 'focus',
      run: page.askClearProgram
    },
    {
      group: 'Program',
      label: bytesShown.value ? 'Hide the machine code' : 'Show the machine code',
      run: () => {
        bytesShown.value = !bytesShown.value;
      }
    },
    { group: 'History', label: 'Undo', disabled: history.value.length === 0, run: cpu.undoLast },
    { group: 'History', label: 'Redo', disabled: future.value.length === 0, run: cpu.redo },
    {
      group: 'History',
      label: 'Go back to the start',
      disabled: history.value.length === 0,
      run: () => cpu.seek(0)
    },
    {
      group: 'History',
      label: 'Go to the latest instruction',
      disabled: future.value.length === 0,
      run: () => cpu.seek(history.value.length + future.value.length)
    },
    {
      group: 'History',
      label: historyShown.value ? 'Hide the history list' : 'Show the history list',
      run: () => {
        historyShown.value = !historyShown.value;
      }
    },
    { group: 'CPU', label: 'Reset the CPU and clear the history', run: cpu.reset },
    {
      group: 'CPU',
      label: 'Show the top of the stack in memory',
      moves: 'scroll',
      run: page.showStackTop
    },
    {
      group: 'CPU',
      label: 'Show the last memory access',
      disabled: !hasLastAccess.value,
      moves: 'scroll',
      run: page.showLastAccess
    },
    {
      group: 'Devices',
      label: devicesShown.value ? 'Hide the I/O devices' : 'Show the I/O devices',
      run: () => {
        devicesShown.value = !devicesShown.value;
      }
    },
    ...RUN_SPEED_NAMES.map((name) => ({
      group: 'Run speed',
      label: SPEED_LABELS[name],
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
    },
    {
      group: 'Preferences',
      label: 'Reset the card order',
      disabled: panelOrder.isDefault.value,
      run: panelOrder.reset
    }
  ]);
}
