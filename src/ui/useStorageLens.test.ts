import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { useStorageLens } from './useStorageLens';

describe('useStorageLens', () => {
  it('keeps what the flip-flops took when an input changes after the clock rose', async () => {
    const lens = useStorageLens(() => null);
    const { input, enabled } = lens.request.value;
    expect(enabled).not.toBe(0);
    lens.clock();
    const taken = lens.solution.value.stored;
    expect(taken).toBe(input);
    lens.flipBit('input', 0);
    await nextTick();
    // The register still holds what it took; the flipped input waits for the next rise.
    expect(lens.request.value.held).toBe(taken);
    expect(lens.request.value.input).toBe(input ^ 1);
    expect(lens.phase.value).toBe('before');
  });

  it('changes only the input while the clock has not yet risen', async () => {
    const lens = useStorageLens(() => null);
    const { held } = lens.request.value;
    lens.flipBit('input', 0);
    await nextTick();
    expect(lens.request.value.held).toBe(held);
  });
});
