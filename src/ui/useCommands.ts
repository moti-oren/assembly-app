import { computed, type ComputedRef, type Ref } from 'vue';
import { ARCHITECTURE_CHOICES } from './architectures';
import { RUN_SPEED_NAMES, SPEED_LABELS } from './runSpeeds';
import type { CpuControls } from './useCpu';
import { PANEL_LABELS, usePanelOrder } from './usePanelOrder';
import { useComparison } from './useComparison';
import type { Panels } from './usePanels';
import { CPU_VIEW_LABELS, usePreferences } from './usePreferences';
import type { SidebarKey } from './sidebarLayout';
import { useSidebarLayout } from './useSidebarLayout';

/** One entry in the command palette. */
export interface PaletteCommand {
  group: string;
  label: string;
  disabled?: boolean;
  /**
   * What the command does to the page beyond its own state. Either way it runs once the palette
   * has closed, since an open palette locks page scrolling and then hands focus back. `focus`
   * also stops that hand-back, which would undo the command's work.
   */
  moves?: 'focus' | 'scroll';
  run: () => void;
}

/** What the palette asks of components on the page, which own the state these act on. */
export interface PageActions {
  focusBuilder: () => void;
  /** Opens the confirmation; clearing cannot be undone. */
  askClearProgram: () => void;
  /** Resets, asking first when the history would be lost. */
  askReset: () => void;
  showStackTop: () => void;
  showLastAccess: () => void;
  /** Whether the last instruction read or wrote memory, so there is an access to show. */
  hasLastAccess: () => boolean;
}

/**
 * Everything the command palette offers, labelled for the current state. `extra` adds the
 * commands of one architecture's own panels; `sidebarKeys` are the sidebar panels on show.
 */
export function useCommands(
  cpu: CpuControls,
  panels: Panels,
  page: PageActions,
  extra: () => PaletteCommand[] = () => [],
  sidebarKeys?: Ref<readonly SidebarKey[]>
): ComputedRef<PaletteCommand[]> {
  const { isDark, soundOn, cpuView, architecture, reduceMotion, systemReducesMotion, toggleTheme } =
    usePreferences();
  const panelOrder = usePanelOrder();
  const sidebar = useSidebarLayout();
  const comparison = useComparison();
  const { history, program, insertAt, future, finished, speed, running } = cpu;
  const { historyShown, bytesShown, devicesShown } = panels;
  const hasLastAccess = computed(page.hasLastAccess);

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
    { group: 'CPU', label: 'Reset the CPU and clear the history', run: page.askReset },
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
    ...extra(),
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
    ...ARCHITECTURE_CHOICES.filter((choice) => choice.id !== architecture.value).map((choice) => ({
      group: 'CPU',
      label: `Switch to ${choice.label}`,
      run: () => {
        architecture.value = choice.id;
      }
    })),
    {
      group: 'CPU',
      label: 'Compare the CPUs on the same task…',
      // The dialog takes focus; the palette must not take it back as it closes.
      moves: 'focus',
      run: () => {
        comparison.open.value = true;
      }
    },
    ...cpu.architecture.examples.map((example, index) => ({
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
      label: cpuView.value === 'diagram' ? CPU_VIEW_LABELS.table : CPU_VIEW_LABELS.diagram,
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
    // While the system asks for less motion, the app's own setting cannot bring it back.
    systemReducesMotion.value
      ? {
          group: 'Preferences',
          label: 'Animations are reduced by the system',
          disabled: true,
          run: () => {}
        }
      : {
          group: 'Preferences',
          label: reduceMotion.value ? 'Use full animations' : 'Reduce animations',
          run: () => {
            reduceMotion.value = !reduceMotion.value;
          }
        },
    ...(sidebarKeys?.value ?? []).map((key) => ({
      group: 'Sidebar',
      label: `${sidebar.isCollapsed(key) ? 'Expand' : 'Collapse'} the ${PANEL_LABELS[key]} panel`,
      run: () => sidebar.toggle(key)
    })),
    {
      group: 'Preferences',
      label: 'Reset the card order and sizes',
      disabled: panelOrder.isDefault.value && sidebar.isDefault.value,
      run: () => {
        panelOrder.reset();
        sidebar.reset();
      }
    }
  ]);
}
