import { nextTick, onActivated, watch, type ShallowRef, type WatchSource } from 'vue';

/**
 * Keeps a row that scrolls sideways at its right end, where the low bits of a number are: when
 * it is first drawn, when `changed` does, and when its page comes back into view.
 */
export function useScrollEnd(
  target: Readonly<ShallowRef<HTMLElement | null>>,
  changed: WatchSource
): void {
  async function toEnd(): Promise<void> {
    await nextTick();
    const element = target.value;
    if (element) element.scrollLeft = element.scrollWidth;
  }
  watch([target, changed], toEnd, { immediate: true });
  onActivated(toEnd);
}
