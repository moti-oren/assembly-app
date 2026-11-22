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
