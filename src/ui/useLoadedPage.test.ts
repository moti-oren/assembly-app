import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { useLoadedPage } from './useLoadedPage';

/** A loader the test settles by hand. */
function deferred(): { load: () => Promise<unknown>; resolve: () => void; reject: () => void } {
  let resolve = (): void => undefined;
  let reject = (): void => undefined;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { load: () => promise, resolve, reject };
}

const settled = () => new Promise((resolve) => setTimeout(resolve));

describe('useLoadedPage', () => {
  it('keeps the page on show until the next one has loaded', async () => {
    const a = deferred();
    const b = deferred();
    const wanted = ref<'a' | 'b'>('a');
    const shown = useLoadedPage(() => wanted.value, { a: a.load, b: b.load });
    wanted.value = 'b';
    await settled();
    expect(shown.value).toBe('a');
    b.resolve();
    await settled();
    expect(shown.value).toBe('b');
  });

  it('switches at once to a page that has loaded before', async () => {
    const a = deferred();
    const b = deferred();
    b.resolve();
    const wanted = ref<'a' | 'b'>('a');
    const shown = useLoadedPage(() => wanted.value, { a: a.load, b: b.load });
    wanted.value = 'b';
    await settled();
    a.resolve();
    wanted.value = 'a';
    await settled();
    wanted.value = 'b';
    await nextTick();
    expect(shown.value).toBe('b');
  });

  it('ends on the last page asked for, whichever loads first', async () => {
    const a = deferred();
    const b = deferred();
    const c = deferred();
    const wanted = ref<'a' | 'b' | 'c'>('a');
    const shown = useLoadedPage(() => wanted.value, { a: a.load, b: b.load, c: c.load });
    wanted.value = 'b';
    await nextTick();
    wanted.value = 'c';
    await nextTick();
    c.resolve();
    await settled();
    b.resolve();
    await settled();
    expect(shown.value).toBe('c');
  });

  it('still switches when a page fails to load', async () => {
    const a = deferred();
    const b = deferred();
    const wanted = ref<'a' | 'b'>('a');
    const shown = useLoadedPage(() => wanted.value, { a: a.load, b: b.load });
    wanted.value = 'b';
    b.reject();
    await settled();
    expect(shown.value).toBe('b');
  });
});
