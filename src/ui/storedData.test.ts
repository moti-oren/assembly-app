import { describe, expect, it } from 'vitest';
import { programKey } from './programStorage';
import { STORAGE_KEYS } from './storageKeys';
import { clearStoredData, storedKeys } from './storedData';

describe('the stored data', () => {
  it('lists every setting and the program of every architecture', () => {
    const keys = storedKeys();
    expect(keys).toContain(STORAGE_KEYS.theme);
    expect(keys).toContain(STORAGE_KEYS.sidebarLayout);
    for (const id of ['x86', 'rv32', 'mos6502']) expect(keys).toContain(programKey(id));
  });

  it('leaves out the bare program key, which nothing is stored under', () => {
    expect(storedKeys()).not.toContain(STORAGE_KEYS.program);
  });

  it('removes its own keys and no other', () => {
    const stored = new Map([
      [STORAGE_KEYS.sound, 'true'],
      [programKey('x86'), '[]'],
      ['another-app', 'kept']
    ]);
    clearStoredData({ removeItem: (key) => stored.delete(key) });
    expect([...stored.keys()]).toEqual(['another-app']);
  });
});
