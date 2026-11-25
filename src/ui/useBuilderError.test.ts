import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { useBuilderError } from './useBuilderError';

describe('useBuilderError', () => {
  it('shows an error until another instruction is being written, and a new one again', async () => {
    const error = ref<string | null>(null);
    const filter = ref('');
    const shown = useBuilderError(() => error.value, [filter]);
    error.value = 'Store into code';
    await nextTick();
    expect(shown.value).toBe('Store into code');
    filter.value = 'li';
    await nextTick();
    expect(shown.value).toBeNull();
    error.value = 'Another';
    await nextTick();
    expect(shown.value).toBe('Another');
  });
});
