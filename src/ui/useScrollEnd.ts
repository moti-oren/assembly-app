import { nextTick, onActivated, watch, type ShallowRef, type WatchSource } from 'vue';
import { useResizeObserver } from '@vueuse/core';

/**
 * Keeps a row that scrolls sideways at its right end, where the low bits of a number are: when
 * it is first drawn, when `changed` does, and when its page or view comes back into sight (a
 * hidden row has no width to scroll, so one shown again is moved once it has one).
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
  let shown = false;
  useResizeObserver(target, ([entry]) => {
    const now = entry.contentRect.width > 0;
    if (now && !shown) void toEnd();
    shown = now;
  });
}
