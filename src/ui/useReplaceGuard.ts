import { shallowRef } from 'vue';
import { createGlobalState } from '@vueuse/core';
import type { ProgramInstruction } from '@/core/shared/program';
import { replacesProgram } from './shareLink';

/** A program waiting to replace the learner's: what it is, and what loading it does. */
export interface PendingReplace {
  /** What would come in its place: an example's name, a challenge's title. */
  name: string;
  /** How many lines the program on show has, which would be lost. */
  lines: number;
  proceed: () => void;
}

/**
 * Asks before a program is replaced by another, as a shared link does: an example, a challenge
 * or a comparison task loaded over the learner's own lines would lose them, and Undo cannot
 * bring them back. One question at a time, for every CPU.
 */
export const useReplaceGuard = createGlobalState(() => {
  const pending = shallowRef<PendingReplace | null>(null);
  /** The last question asked: the dialog keeps its words while it closes. */
  const asked = shallowRef<PendingReplace | null>(null);

  /** Runs `proceed` at once when nothing would be lost, or after the learner agrees. */
  function guard(
    current: readonly ProgramInstruction[],
    next: readonly ProgramInstruction[],
    name: string,
    proceed: () => void
  ): void {
    if (!replacesProgram(current, next)) {
      proceed();
      return;
    }
    pending.value = { name, lines: current.length, proceed };
    asked.value = pending.value;
  }

  function confirm(): void {
    const waiting = pending.value;
    pending.value = null;
    waiting?.proceed();
  }

  function cancel(): void {
    pending.value = null;
  }

  return { pending, asked, guard, confirm, cancel };
});
