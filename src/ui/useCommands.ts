import { computed, type ComputedRef, type Ref } from 'vue';
import { formatLabel } from '@/core/shared/program';
import { ARCHITECTURE_CHOICES } from './architectures';
import { PHONE_VIEW_LABELS, PHONE_VIEWS } from './layoutMode';
import type { PaletteCommand } from './paletteCommand';
import { isApple } from './platform';
import { RUN_SPEED_NAMES, SPEED_LABELS } from './runSpeeds';
import { transportKeys } from './transportKeys';
import { useAppCommands } from './useAppCommands';
import type { CpuControls } from './useCpu';
import { PANEL_LABELS, usePanelOrder } from './usePanelOrder';
import { useComparison } from './useComparison';
import type { Panels } from './usePanels';
import { useShare } from './useShare';
import { CPU_VIEW_LABELS, usePreferences } from './usePreferences';
import type { SidebarKey } from './sidebarLayout';
import { useLayoutMode } from './useLayoutMode';
import { useSidebarLayout } from './useSidebarLayout';
import { useTopic } from './useTopic';
import { useWorkbenchView } from './useWorkbenchView';

/** What the palette asks of components on the page, which own the state these act on. */
export interface PageActions {
  focusBuilder: () => void;
  /** Opens the confirmation; clearing cannot be undone. */
  askClearProgram: () => void;
  /** Resets, asking first when the history would be lost. */
  askReset: () => void;
  /** Resets and runs the program from its first line, asking first as a reset does. */
  runAgain: () => void;
  showStackTop: () => void;
  showLastAccess: () => void;
  /** Whether the last instruction read or wrote memory, so there is an access to show. */
  hasLastAccess: () => boolean;
  /** Whether the last instruction has a circuit of gates to show in the logic topic. */
  hasCircuit: () => boolean;
  /** Whether the last instruction can be shown as arithmetic in the number topic. */
  hasNumbers: () => boolean;
  /** Whether the last instruction wrote a register to show in the storage topic. */
  hasRegisters: () => boolean;
  /** Whether the last instruction has a control unit to show in the control topic. */
  hasControl: () => boolean;
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
  const { cpuView, architecture } = usePreferences();
  const app = useAppCommands();
  const { showCircuit, showNumbers, showStorage, showControl } = useTopic();
  const panelOrder = usePanelOrder();
  const sidebar = useSidebarLayout();
  const comparison = useComparison();
  const share = useShare();
  const mode = useLayoutMode();
  const { view, drawerOpen } = useWorkbenchView();
  const { history, program, insertAt, future, finished, speed, running, nextLine } = cpu;
  const { historyShown, bytesShown, devicesShown } = panels;
  const hasLastAccess = computed(page.hasLastAccess);
  const hasCircuit = computed(page.hasCircuit);
  const hasNumbers = computed(page.hasNumbers);
  const hasRegisters = computed(page.hasRegisters);
  const hasControl = computed(page.hasControl);
  const keys = transportKeys(isApple);

  return computed<PaletteCommand[]>(() => [
    { group: 'Program', label: 'Write an instruction', moves: 'focus', run: page.focusBuilder },
    {
      group: 'Program',
      label: 'Step one line',
      keys: keys.step,
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
      ? { group: 'Program', label: 'Pause', keys: keys.run, run: cpu.pause }
      : finished.value && program.value.length > 0
        ? // A dialog may ask first; the palette must not take focus back from it.
          {
            group: 'Program',
            label: 'Run the program again',
            keys: keys.run,
            moves: 'focus',
            run: page.runAgain
          }
        : {
            group: 'Program',
            label: 'Run the program',
            keys: keys.run,
            disabled: finished.value,
            run: cpu.runProgram
          },
    // A line has no name the palette could ask for, so these act on the one that runs next.
    ...(finished.value
      ? []
      : [
          {
            group: 'Program',
            label: `Edit the next line (${formatLabel(nextLine.value)})`,
            moves: 'focus' as const,
            run: () => cpu.editLine(nextLine.value)
          },
          {
            group: 'Program',
            label: 'Move the next line up',
            disabled: nextLine.value === 0,
            run: () => cpu.moveProgramLine(nextLine.value, nextLine.value - 1)
          },
          {
            group: 'Program',
            label: 'Move the next line down',
            disabled: nextLine.value >= program.value.length - 1,
            run: () => cpu.moveProgramLine(nextLine.value, nextLine.value + 1)
          }
        ]),
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
      label: 'Share this program…',
      disabled: program.value.length === 0,
      moves: 'focus',
      run: () => {
        share.open.value = true;
      }
    },
    {
      group: 'Program',
      label: bytesShown.value ? 'Hide the machine code' : 'Show the machine code',
      run: () => {
        bytesShown.value = !bytesShown.value;
      }
    },
    {
      group: 'History',
      label: 'Undo',
      keys: keys.undo,
      disabled: history.value.length === 0,
      run: cpu.undoLast
    },
    {
      group: 'History',
      label: 'Redo',
      keys: keys.redo,
      disabled: future.value.length === 0,
      run: cpu.redo
    },
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
    {
      group: 'CPU',
      label: 'Show the gates behind the last operation',
      disabled: !hasCircuit.value,
      // The logic topic's page takes focus; the palette must not take it back as it closes.
      moves: 'focus',
      run: () => showCircuit()
    },
    {
      group: 'CPU',
      label: 'Show the last operation as numbers',
      disabled: !hasNumbers.value,
      moves: 'focus',
      run: () => showNumbers()
    },
    {
      group: 'CPU',
      label: 'Show how the last register written is kept',
      disabled: !hasRegisters.value,
      moves: 'focus',
      run: () => showStorage()
    },
    {
      group: 'CPU',
      label: 'Show how the last instruction was decoded',
      disabled: !hasControl.value,
      moves: 'focus',
      run: () => showControl()
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
      label: cpuView.value === 'diagram' ? CPU_VIEW_LABELS.table : CPU_VIEW_LABELS.diagram,
      run: () => {
        cpuView.value = cpuView.value === 'diagram' ? 'table' : 'diagram';
      }
    },
    ...app.value,
    // What a narrow screen keeps out of sight: a phone's other views, a tablet's drawer.
    ...(mode.value === 'phone'
      ? PHONE_VIEWS.filter((each) => each !== view.value).map((each) => ({
          group: 'View',
          label: `Show the ${PHONE_VIEW_LABELS[each]} view`,
          run: () => {
            view.value = each;
          }
        }))
      : []),
    ...(mode.value === 'tablet'
      ? [
          {
            group: 'View',
            label: drawerOpen.value ? 'Hide the code drawer' : 'Show the code drawer',
            run: () => {
              drawerOpen.value = !drawerOpen.value;
            }
          }
        ]
      : []),
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
