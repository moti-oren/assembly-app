import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from './storageKeys';
import { isStoredCount, isStoredText, readStoredRecord } from './storedRecord';
import { useLazyOpen } from './useLazyOpen';

const write = (value: object) => JSON.stringify(value);

/**
 * The challenges across the three CPUs: whether their list is open, the one each CPU is working
 * on, and the ones that were solved. The last two are remembered.
 */
export const useChallenges = createGlobalState(() => {
  const { open, wanted } = useLazyOpen();
  /** For each architecture, the id of the challenge its program is for. */
  const active = useLocalStorage<Record<string, string>>(
    STORAGE_KEYS.challenge,
    {},
    { serializer: { read: (raw) => readStoredRecord(raw, isStoredText), write } }
  );
  /** For each challenge solved, the fewest lines it took. */
  const solved = useLocalStorage<Record<string, number>>(
    STORAGE_KEYS.challengesSolved,
    {},
    { serializer: { read: (raw) => readStoredRecord(raw, isStoredCount), write } }
  );

  function start(architecture: string, id: string): void {
    active.value = { ...active.value, [architecture]: id };
  }

  function leave(architecture: string): void {
    active.value = Object.fromEntries(
      Object.entries(active.value).filter(([key]) => key !== architecture)
    );
  }

  /** Keeps a solution that took fewer lines than the one remembered. */
  function markSolved(id: string, lines: number): void {
    const best = solved.value[id];
    if (best !== undefined && best <= lines) return;
    solved.value = { ...solved.value, [id]: lines };
  }

  return { open, wanted, active, solved, start, leave, markSolved };
});
