import { onActivated, onDeactivated, ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import { transportAction, type TransportAction } from './transportKeys';
import type { CpuControls } from './useCpu';

/** The kinds of input that hold text; a slider, a checkbox or a radio button does not. */
const TEXT_INPUTS = new Set(['text', 'search', 'url', 'email', 'tel', 'password', 'number']);

/** True when Ctrl+Z belongs to text: a field that holds some, or anything edited in place. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement) return target.value !== '';
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUTS.has(target.type) && target.value !== '';
  }
  return false;
}

/**
 * The keyboard shortcuts that drive the program: step, run or pause, undo and redo. They do
 * what the bar's buttons do, and nothing where a button would be off. `runAgain` is what Run
 * does once the program has ended.
 */
export function useTransportKeys(cpu: CpuControls, runAgain: () => void): void {
  // A workbench kept alive while another is shown still listens: only the shown one acts.
  const shown = ref(true);
  onActivated(() => (shown.value = true));
  onDeactivated(() => (shown.value = false));

  const run: Record<TransportAction, () => void> = {
    step: () => {
      if (!cpu.finished.value) cpu.stepProgram();
    },
    run: () => {
      if (cpu.running.value) cpu.pause();
      else if (!cpu.finished.value) cpu.runProgram();
      else if (cpu.program.value.length > 0) runAgain();
    },
    undo: () => {
      if (cpu.history.value.length > 0) cpu.undoLast();
    },
    redo: () => {
      if (cpu.future.value.length > 0) cpu.redo();
    }
  };

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (!shown.value || event.defaultPrevented) return;
    // A dialog or the palette is asking something: its keys are its own.
    if (document.querySelector(':is([role="dialog"], [role="alertdialog"])[data-state="open"]')) {
      return;
    }
    const action = transportAction(event, isTyping(event.target));
    if (!action) return;
    event.preventDefault();
    run[action]();
  });
}
