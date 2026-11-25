import { ref } from 'vue';
import { useEventListener } from '@vueuse/core';
import type { ProgramInstruction } from '@/core/shared/program';
import { analytics } from './analyticsClient';
import type { ArchitectureId } from './architectures';
import {
  decodeShare,
  isShareHash,
  replacesProgram,
  type ShareProblem,
  type SharedProgram
} from './shareLink';

/** What the page does for a program that arrives through a link; it owns the CPUs. */
export interface SharedProgramHooks {
  /** The program a CPU holds now, which opening a shared one would replace. */
  current: (id: ArchitectureId) => readonly ProgramInstruction[];
  /** Loads the program on its CPU and shows it. */
  load: (shared: SharedProgram) => void;
}

/**
 * The program in the address, when the page was opened through a share link or one is pasted
 * later. It is opened at once unless it would replace another program: then it waits in
 * `pending` for an answer.
 */
export function useSharedProgram(hooks: SharedProgramHooks) {
  const pending = ref<SharedProgram | null>(null);
  const problem = ref<ShareProblem | null>(null);
  /** How many lines the program a pending link would replace holds, for the question. */
  const replacedLines = ref(0);

  function openShared(shared: SharedProgram): void {
    hooks.load(shared);
    analytics.track({ name: 'link-opened', architecture: shared.id });
  }

  async function read(): Promise<void> {
    const hash = location.hash;
    if (!isShareHash(hash)) return;
    // The link is taken out of the address at once: a reload, or a copy of the address, should
    // give the program as it is by then, not this one again.
    history.replaceState(history.state, '', location.pathname + location.search);
    const shared = await decodeShare(hash);
    if (shared === null) return;
    pending.value = null;
    problem.value = null;
    if (typeof shared === 'string') problem.value = shared;
    else if (replacesProgram(hooks.current(shared.id), shared.program)) {
      replacedLines.value = hooks.current(shared.id).length;
      pending.value = shared;
    } else openShared(shared);
  }

  function accept(shared: SharedProgram): void {
    pending.value = null;
    openShared(shared);
  }

  function dismiss(): void {
    pending.value = null;
    problem.value = null;
  }

  useEventListener(window, 'hashchange', read);
  void read();

  return { pending, problem, replacedLines, accept, dismiss };
}
