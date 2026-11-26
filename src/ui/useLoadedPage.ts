import { ref, watch, type Ref } from 'vue';

/**
 * Which page is on show, once its chunk has arrived: a switch keeps the page that was there until
 * the next one can be drawn whole, instead of an empty shell while it loads. Every page's chunk is
 * also fetched once the window is idle, so a switch seldom has to wait at all.
 */
export function useLoadedPage<K extends string>(
  wanted: () => K,
  loaders: Readonly<Record<K, () => Promise<unknown>>>
): Readonly<Ref<K>> {
  const shown = ref(wanted()) as Ref<K>;
  const loaded = new Set<K>();
  let latest: K = shown.value;

  function load(key: K): Promise<void> {
    if (loaded.has(key)) return Promise.resolve();
    return loaders[key]().then(() => void loaded.add(key));
  }

  watch(wanted, (key) => {
    latest = key;
    if (loaded.has(key)) {
      shown.value = key;
      return;
    }
    // A chunk that failed still switches: the page then shows its own failure, not the old one.
    const settle = (): void => {
      if (latest === key) shown.value = key;
    };
    void load(key).then(settle, settle);
  });

  const prefetch = (): void => {
    for (const key of Object.keys(loaders) as K[]) void load(key).catch(() => undefined);
  };
  if (typeof window === 'undefined') return shown;
  if ('requestIdleCallback' in window) requestIdleCallback(prefetch);
  else setTimeout(prefetch, 1500);

  return shown;
}
