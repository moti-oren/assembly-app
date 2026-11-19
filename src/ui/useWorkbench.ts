import { computed, ref, watch } from 'vue';
import type { ExecutionRecord } from '@/core/shared/executionRecord';
import type { ProgramInstruction } from '@/core/shared/program';
import type { Messages } from './messages/en';
import { useCommands, type PageActions, type PaletteCommand } from './useCommands';
import type { CpuControls } from './useCpu';
import { usePanelColumns } from './usePanelOrder';
import { usePanels, type UsesDevices } from './usePanels';
import { useSoundEffects, type SoundOf } from './useSoundEffects';

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
  commands?: (m: Messages) => PaletteCommand[];
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
      askClearProgram: () => {
        clearAsked.value = true;
      },
      askReset
    },
    hooks.commands
  );

  // Stepping the program folds the builder's choices, so the line at IP stays in view below it.
  watch([() => cpu.history.value.length, () => cpu.pending.value?.phase], () => {
    const fromProgram = cpu.pending.value !== null || (cpu.lastRecord.value?.line ?? null) !== null;
    if (fromProgram) hooks.page.foldBuilder();
  });

  return {
    panels,
    commands,
    columns: usePanelColumns(panels),
    paletteOpen,
    examplesOpen,
    clearAsked,
    resetAsked,
    historyLength,
    askReset
  };
}
