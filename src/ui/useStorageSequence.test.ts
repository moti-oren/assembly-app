import { describe, expect, it } from 'vitest';
import { SEQUENCE } from '@/core/logic/sequence';
import { SEQUENCE_INPUT } from './storageSequence';
import { useStorageSequence } from './useStorageSequence';

describe('useStorageSequence', () => {
  it('starts each circuit with its input at 1, so the first tick changes a bit', () => {
    const sequence = useStorageSequence();
    for (const kind of ['shift', 'counter'] as const) {
      sequence.pick(kind);
      expect(sequence.inputs.value[SEQUENCE_INPUT[kind].signal]).toBe(1);
      const before = { ...sequence.signals.value };
      sequence.pulse();
      expect(sequence.signals.value).not.toEqual(before);
      expect(sequence.inputs.value[SEQUENCE.clock]).toBe(0);
    }
  });
});
