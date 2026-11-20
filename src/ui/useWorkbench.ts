import { computed, nextTick, ref, watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { ProgramInstruction } from '@/core/shared/program';
import { useCommands, type PageActions, type PaletteCommand } from './useCommands';
import type { CpuControls } from './useCpu';
import { usePanelColumns } from './usePanelOrder';
import { usePanels, type UsesDevices } from './usePanels';
import { useSidebarLayout } from './useSidebarLayout';
import { useSoundEffects, type SoundOf } from './useSoundEffects';
import { useWorkbenchView } from './useWorkbenchView';

/** What the page asks of the panels a workbench shows; they own the elements these act on. */
export type WorkbenchPage = Omit<PageActions, 'askClearProgram' | 'askReset'> & {
  /** Folds the builder's choices away, so the program below it stays in view. */
  foldBuilder: () => void;
};

/** What a workbench tells the shared logic about its architecture. */
export interface WorkbenchHooks<Instruction, Record> {
  usesDevices: UsesDevices<Instruction, Record>;
  soundOf: SoundOf<Record>;
  page: WorkbenchPage;
  /** Palette commands for the architecture's own panels, labelled for the current state. */
  commands?: () => PaletteCommand[];
}

/**
 * Everything around the panels that works the same for every architecture: which panels are
 * shown and in what order, the command palette, the confirmations, and the sounds.
 */
export function useWorkbench<
  Instruction extends ProgramInstruction,
  Record extends ExecutionRecord
>(cpu: CpuControls<Instruction, Record>, hooks: WorkbenchHooks<Instruction, Record>) {
  useSoundEffects(cpu, hooks.soundOf);
  const panels = usePanels(cpu, hooks.usesDevices);
  const columns = usePanelColumns(panels);
  const sidebar = useSidebarLayout();
  const { show } = useWorkbenchView();
  const paletteOpen = ref(false);
  const examplesOpen = ref(false);
  /** True while the user is asked to confirm clearing the program. */
  const clearAsked = ref(false);
  /** True while the user is asked to confirm a reset, which would lose the history. */
  const resetAsked = ref(false);
  /** Instructions a reset would lose, undone ones included. */
  const historyLength = computed(() => cpu.history.value.length + cpu.future.value.length);

  /** With nothing in the history there is nothing to lose, so the reset happens at once. */
  function askReset(): void {
    if (historyLength.value === 0) cpu.reset();
    else resetAsked.value = true;
  }

  const commands = useCommands(
    cpu,
    panels,
    {
      ...hooks.page,
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
      askReset
    },
    hooks.commands,
    columns.leftKeys
  );

  // Stepping the program folds the builder's choices, so the line at IP stays in view below it.
  watch([() => cpu.history.value.length, () => cpu.pending.value?.phase], () => {
    const fromProgram = cpu.pending.value !== null || (cpu.lastRecord.value?.line ?? null) !== null;
    if (fromProgram) hooks.page.foldBuilder();
  });

  return {
    panels,
    commands,
    columns,
    paletteOpen,
    examplesOpen,
    clearAsked,
    resetAsked,
    historyLength,
    askReset
  };
}
