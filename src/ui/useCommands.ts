import { computed, type ComputedRef } from 'vue';
import { ARCHITECTURE_CHOICES } from './architectures';
import { messagesFor } from './locale';
import type { Messages } from './messages/en';
import { RUN_SPEED_NAMES } from './runSpeeds';
import type { CpuControls } from './useCpu';
import { usePanelOrder } from './usePanelOrder';
import { useComparison } from './useComparison';
import { useLocale } from './useLocale';
import type { Panels } from './usePanels';
import { usePreferences } from './usePreferences';

/** One entry in the command palette. */
export interface PaletteCommand {
  group: string;
  label: string;
  /** More words the palette's search matches: the English names, when they are not on show. */
  keywords?: string;
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
 * Everything the command palette offers, labelled for the current state and language. `extra`
 * adds the commands of one architecture's own panels, in the language of the messages it gets.
 */
export function useCommands(
  cpu: CpuControls,
  panels: Panels,
  page: PageActions,
  extra: (m: Messages) => PaletteCommand[] = () => []
): ComputedRef<PaletteCommand[]> {
  const { isDark, soundOn, cpuView, architecture, reduceMotion, systemReducesMotion, toggleTheme } =
    usePreferences();
  const { locale, t, toggleLocale } = useLocale();
  const panelOrder = usePanelOrder();
  const comparison = useComparison();
  const { history, program, insertAt, future, finished, speed, running } = cpu;
  const { historyShown, bytesShown, devicesShown } = panels;
  const hasLastAccess = computed(page.hasLastAccess);

  /** The commands in one language; every language lists the same ones in the same order. */
  const build = (m: Messages): PaletteCommand[] => [
    {
      group: m.commandGroups.program,
      label: m.commands.writeInstruction,
      moves: 'focus',
      run: page.focusBuilder
    },
    {
      group: m.commandGroups.program,
      label: m.commands.stepLine,
      disabled: finished.value,
      run: cpu.stepProgram
    },
    {
      group: m.commandGroups.program,
      label: m.commands.stepPhase,
      disabled: finished.value,
      run: cpu.stepPhase
    },
    running.value
      ? { group: m.commandGroups.program, label: m.commands.pause, run: cpu.pause }
      : {
          group: m.commandGroups.program,
          label: m.commands.run,
          disabled: finished.value,
          run: cpu.runProgram
        },
    // Only while new lines go above a chosen line; at the end is where they go otherwise.
    ...(insertAt.value === null
      ? []
      : [
          {
            group: m.commandGroups.program,
            label: m.commands.addAtEnd,
            run: () => {
              insertAt.value = null;
            }
          }
        ]),
    {
      group: m.commandGroups.program,
      label: m.commands.clearProgram,
      disabled: program.value.length === 0,
      // The dialog takes focus; the palette must not take it back as it closes.
      moves: 'focus',
      run: page.askClearProgram
    },
    {
      group: m.commandGroups.program,
      label: m.commands.machineCode(bytesShown.value),
      run: () => {
        bytesShown.value = !bytesShown.value;
      }
    },
    {
      group: m.commandGroups.history,
      label: m.commands.undo,
      disabled: history.value.length === 0,
      run: cpu.undoLast
    },
    {
      group: m.commandGroups.history,
      label: m.commands.redo,
      disabled: future.value.length === 0,
      run: cpu.redo
    },
    {
      group: m.commandGroups.history,
      label: m.commands.toStart,
      disabled: history.value.length === 0,
      run: () => cpu.seek(0)
    },
    {
      group: m.commandGroups.history,
      label: m.commands.toLatest,
      disabled: future.value.length === 0,
      run: () => cpu.seek(history.value.length + future.value.length)
    },
    {
      group: m.commandGroups.history,
      label: m.commands.historyList(historyShown.value),
      run: () => {
        historyShown.value = !historyShown.value;
      }
    },
    { group: m.commandGroups.cpu, label: m.commands.reset, run: page.askReset },
    {
      group: m.commandGroups.cpu,
      label: m.commands.stackTop,
      moves: 'scroll',
      run: page.showStackTop
    },
    {
      group: m.commandGroups.cpu,
      label: m.commands.lastAccess,
      disabled: !hasLastAccess.value,
      moves: 'scroll',
      run: page.showLastAccess
    },
    ...extra(m),
    {
      group: m.commandGroups.devices,
      label: m.commands.devices(devicesShown.value),
      run: () => {
        devicesShown.value = !devicesShown.value;
      }
    },
    ...RUN_SPEED_NAMES.map((name) => ({
      group: m.commandGroups.runSpeed,
      label: m.speeds[name],
      disabled: speed.value === name,
      run: () => {
        speed.value = name;
      }
    })),
    ...ARCHITECTURE_CHOICES.filter((choice) => choice.id !== architecture.value).map((choice) => ({
      group: m.commandGroups.cpu,
      label: m.commands.switchTo(choice.label),
      run: () => {
        architecture.value = choice.id;
      }
    })),
    {
      group: m.commandGroups.cpu,
      label: m.commands.compare,
      // The dialog takes focus; the palette must not take it back as it closes.
      moves: 'focus',
      run: () => {
        comparison.open.value = true;
      }
    },
    ...cpu.architecture.examples.map((example, index) => ({
      group: m.commandGroups.examples,
      label: m.commands.loadExample(example.name),
      run: () => cpu.loadExample(index)
    })),
    {
      group: m.commandGroups.preferences,
      label: m.commands.theme(isDark.value),
      run: toggleTheme
    },
    { group: m.commandGroups.preferences, label: m.language.switch, run: toggleLocale },
    {
      group: m.commandGroups.preferences,
      label: cpuView.value === 'diagram' ? m.cpuView.table : m.cpuView.diagram,
      run: () => {
        cpuView.value = cpuView.value === 'diagram' ? 'table' : 'diagram';
      }
    },
    {
      group: m.commandGroups.preferences,
      label: m.commands.sound(soundOn.value),
      run: () => {
        soundOn.value = !soundOn.value;
      }
    },
    // While the system asks for less motion, the app's own setting cannot bring it back.
    systemReducesMotion.value
      ? {
          group: m.commandGroups.preferences,
          label: m.commands.motionBySystem,
          disabled: true,
          run: () => {}
        }
      : {
          group: m.commandGroups.preferences,
          label: m.commands.motion(reduceMotion.value),
          run: () => {
            reduceMotion.value = !reduceMotion.value;
          }
        },
    {
      group: m.commandGroups.preferences,
      label: m.commands.resetCardOrder,
      disabled: panelOrder.isDefault.value,
      run: panelOrder.reset
    }
  ];

  return computed(() => {
    const commands = build(t.value);
    if (locale.value === 'en') return commands;
    // Searching for a command by its English name finds it too.
    const english = build(messagesFor('en'));
    return commands.map((command, index) => ({
      ...command,
      keywords: `${english[index].group} ${english[index].label}`
    }));
  });
}
