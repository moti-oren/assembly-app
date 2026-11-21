import { nextTick } from 'vue';
import { keyTarget } from './reorder';
import { sortableCard, type SortableColumn } from './useSortableDrag';
import { usePreferences } from './usePreferences';

/** How long the other cards take to slide aside, and a card moved by the keyboard to glide. */
export const SLIDE_MS = 220;
export const SLIDE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Moving a card with Alt and the arrow keys on its handle (an element marked
 * `data-sortable-handle`, which the card provides). `busy` is true while a drag is on.
 */
export function useSortableKeys<K extends string>(column: SortableColumn<K>, busy: () => boolean) {
  const { calm } = usePreferences();
  const card = (key: K): HTMLElement | null => sortableCard(column.root.value, key);

  /** What gets focus back after a keyboard move: the card's own handle. */
  function handle(key: K): HTMLElement | null {
    return card(key)?.querySelector<HTMLElement>('[data-sortable-handle]') ?? null;
  }

  /**
   * Changes the order, then slides every card from where it was to its new place (FLIP), so the
   * cards glide instead of jumping.
   */
  async function reorder(change: () => void): Promise<void> {
    const before = new Map<K, number>();
    for (const key of column.keys()) {
      const element = card(key);
      if (element) before.set(key, element.getBoundingClientRect().top);
    }
    change();
    await nextTick();
    if (calm.value) return;
    for (const [key, top] of before) {
      const element = card(key);
      if (!element) continue;
      const delta = top - element.getBoundingClientRect().top;
      if (delta === 0) continue;
      element.style.transition = 'none';
      element.style.transform = `translateY(${delta}px)`;
      void element.offsetHeight;
      element.style.transition = `transform ${SLIDE_MS}ms ${SLIDE_EASING}`;
      element.style.transform = '';
    }
  }

  function onHandleKey(event: KeyboardEvent, key: K): void {
    if (!event.altKey || !(event.target as HTMLElement).closest('[data-sortable-handle]')) return;
    const keys = column.keys();
    const index = keys.indexOf(key);
    const to = keyTarget(event.key, index, keys.length);
    if (to === null) return;
    event.preventDefault();
    if (busy() || to < 0 || to >= keys.length || to === index) return;
    void reorder(() => column.moved(key, to)).then(() => {
      // Moving the card in the page takes focus off its grip; give it back.
      handle(key)?.focus();
      handle(key)?.scrollIntoView({ block: 'nearest' });
    });
  }

  return { onHandleKey };
}
