import { computed, nextTick, ref, watch } from 'vue';
import { hasCircuit, type AluLink } from '@/core/aluLink';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { ProgramInstruction } from '@/core/shared/program';
import type { PaletteCommand } from './paletteCommand';
import { useCommands, type PageActions } from './useCommands';
import { useCpuAnalytics } from './useCpuAnalytics';
import type { CpuControls } from './useCpu';
import { useCpuReset } from './useCpuReset';
import { usePanelColumns } from './usePanelOrder';
import { usePanels, type UsesDevices } from './usePanels';
import { useSidebarLayout } from './useSidebarLayout';
import { useSoundEffects, type SoundOf } from './useSoundEffects';
import { useTransportKeys } from './useTransportKeys';
import { useWorkbenchView } from './useWorkbenchView';

/** What the page asks of the panels a workbench shows; they own the elements these act on. */
export type WorkbenchPage = Omit<
  PageActions,
  'askClearProgram' | 'askReset' | 'runAgain' | 'hasCircuit'
> & {
  /** Folds the builder's choices away, so the program below it stays in view. */
  foldBuilder: () => void;
};

/** What a workbench tells the shared logic about its architecture. */
export interface WorkbenchHooks<Instruction, Record> {
  usesDevices: UsesDevices<Instruction, Record>;
  soundOf: SoundOf<Record>;
  page: WorkbenchPage;
  /** The circuit of gates behind an executed instruction, for the link into the logic topic. */
  aluLink: (record: Record) => AluLink;
  /** Palette commands for the architecture's own panels, labelled for the current state. */
  commands?: () => PaletteCommand[];
}

/**
 * Everything around the panels that works the same for every architecture: which panels are
 * shown and in what order, the command palette, the confirmations, the sounds, and what is
 * counted.
 */
export function useWorkbench<
  Instruction extends ProgramInstruction,
  Record extends ExecutionRecord
>(cpu: CpuControls<Instruction, Record>, hooks: WorkbenchHooks<Instruction, Record>) {
  useSoundEffects(cpu, hooks.soundOf);
  useCpuAnalytics(cpu);
  const panels = usePanels(cpu, hooks.usesDevices);
  const columns = usePanelColumns(panels);
  const sidebar = useSidebarLayout();
  const { show } = useWorkbenchView();
  const paletteOpen = ref(false);
  const examplesOpen = ref(false);
  /** True while the user is asked to confirm clearing the program. */
  const clearAsked = ref(false);
  const { resetAsked, historyLength, askReset, runAgain, confirmReset } = useCpuReset(cpu);
  useTransportKeys(cpu, runAgain);

  /** Where the last instruction leads in the logic topic; null before anything has run. */
  const aluLink = computed(() => {
    const record = cpu.lastRecord.value;
    return record && hooks.aluLink(record);
  });

  const commands = useCommands(
    cpu,
    panels,
    {
      ...hooks.page,
      hasCircuit: () => aluLink.value !== null && hasCircuit(aluLink.value),
      // A builder out of sight or collapsed is brought back first; its input can only take
      // focus once it is drawn.
      focusBuilder: () => {
        show('code');
        sidebar.expand('builder');
        void nextTick(hooks.page.focusBuilder);
      },
      // On a phone the memory is a view of its own, which may not be the one on show.
      showStackTop: () => {
        show('memory');
        void nextTick(hooks.page.showStackTop);
      },
      showLastAccess: () => {
        show('memory');
        void nextTick(hooks.page.showLastAccess);
      },
      askClearProgram: () => {
        clearAsked.value = true;
      },
      askReset,
      runAgain
    },
    hooks.commands,
    columns.leftKeys
  );

  // Stepping the program folds the builder's choices, so the line at IP stays in view below it.
  watch([() => cpu.history.value.length, () => cpu.pending.value?.phase], () => {
    const fromProgram = cpu.pending.value !== null || (cpu.lastRecord.value?.line ?? null) !== null;
    if (fromProgram) hooks.page.foldBuilder();
  });

  // So does opening the history: its list needs the room the choices take.
  watch(panels.historyShown, (shown) => {
    if (shown) hooks.page.foldBuilder();
  });

  // Editing a line happens in the builder, which may be collapsed or, on a phone, out of sight.
  watch(cpu.editing, (editing) => {
    if (!editing) return;
    show('code');
    sidebar.expand('builder');
  });

  return {
    panels,
    commands,
    aluLink,
    columns,
    paletteOpen,
    examplesOpen,
    clearAsked,
    resetAsked,
    historyLength,
    askReset,
    runAgain,
    confirmReset
  };
}
