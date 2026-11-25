import { ARCHITECTURE_CHOICES } from './architectures';
import { programKey } from './programStorage';
import { STORAGE_KEYS } from './storageKeys';

/** Every key the app may have written: its settings and layout, and a program per architecture. */
export function storedKeys(): string[] {
  // Nothing is stored under the bare program key: each architecture adds its id to it.
  const settings = Object.values(STORAGE_KEYS).filter((key) => key !== STORAGE_KEYS.program);
  return [...settings, ...ARCHITECTURE_CHOICES.map((choice) => programKey(choice.id))];
}

/** Forgets everything the app remembers; the page must be loaded again to start from it. */
export function clearStoredData(storage: Pick<Storage, 'removeItem'>): void {
  for (const key of storedKeys()) storage.removeItem(key);
}

/** Left in the session by Clear everything, so the page it reloads into can say it was done. */
const CLEARED_MARK = 'cpu-playground-cleared';

/** Marks the session as cleared, before the page is loaded again. */
export function markCleared(session: Pick<Storage, 'setItem'>): void {
  try {
    session.setItem(CLEARED_MARK, '1');
  } catch {
    // Without the mark the page only starts afresh, as it would anyway.
  }
}

/** Whether the page was loaded by Clear everything; the mark is taken, so it is said once. */
export function takeCleared(session: Pick<Storage, 'getItem' | 'removeItem'>): boolean {
  try {
    const cleared = session.getItem(CLEARED_MARK) !== null;
    session.removeItem(CLEARED_MARK);
    return cleared;
  } catch {
    return false;
  }
}
