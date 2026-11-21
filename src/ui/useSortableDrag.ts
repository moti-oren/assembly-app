import { nextTick, onBeforeUnmount, ref, shallowRef, watch, type Ref } from 'vue';
import { autoScrollStep, dragTarget, settleOffset, shiftFor, type Slot } from './reorder';
import { usePreferences } from './usePreferences';

/** The column a sortable composable works on, and how it reports a card moved. */
export interface SortableColumn<K extends string> {
  root: Readonly<Ref<HTMLElement | null>>;
  /** The cards on show, in order. */
  keys: () => readonly K[];
  /** `key` should become visible card number `to`. */
  moved: (key: K, to: number) => void;
}

/** How far the pointer must travel from a header before it is a drag and not a click. */
const DRAG_DISTANCE = 4;
/** What in a header keeps its own click: a drag never starts on these. */
const OWN_CONTROLS = 'button, a, input, select, textarea, [role="button"], [role="separator"]';

/** How long a dropped card takes to glide into its place. */
export const SETTLE_MS = 200;

/** The card element of `key` inside a sortable column. */
export function sortableCard<K extends string>(
  root: HTMLElement | null,
  key: K
): HTMLElement | null {
  return root?.querySelector<HTMLElement>(`[data-sortable="${key}"]`) ?? null;
}

/** The column when it scrolls by itself (a pane of the workbench); null when the page does. */
function ownScroller(column: HTMLElement): HTMLElement | null {
  const overflow = getComputedStyle(column).overflowY;
  return overflow === 'auto' || overflow === 'scroll' ? column : null;
}

/** The click that ends a drag lands on whatever is under the pointer; it must do nothing. */
function swallowNextClick(): void {
  const stop = (event: MouseEvent): void => {
    event.stopPropagation();
    event.preventDefault();
  };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 100);
}

/** Where the cards sit when a drag begins, and how far the dragged one may travel. */
interface Measured {
  slots: Slot[];
  /** The dragged card's own place. */
  home: number;
  gap: number;
  minY: number;
  maxY: number;
}

const NOT_MEASURED: Measured = { slots: [], home: 0, gap: 0, minY: 0, maxY: 0 };

function measureColumn<K extends string>(
  element: HTMLElement,
  keys: readonly K[],
  key: K
): Measured {
  const slots = keys.map((item) => {
    const card = sortableCard(element, item);
    return { top: card?.offsetTop ?? 0, height: card?.offsetHeight ?? 0 };
  });
  const home = keys.indexOf(key);
  const last = slots[slots.length - 1];
  return {
    slots,
    home,
    gap: parseFloat(getComputedStyle(element).rowGap) || 0,
    // The card can travel from the top of the column to its bottom, and no further.
    minY: slots[0].top - slots[home].top,
    maxY: last.top + last.height - (slots[home].top + slots[home].height)
  };
}

/**
 * A press on a card's header (outside its own controls) that becomes a drag once it moves far
 * enough; one that ends before is a click, which the header handles. Returns the pointerdown
 * handler of a card.
 */
function usePressToDrag<K extends string>(
  busy: () => boolean,
  begin: (key: K, pointerId: number, clientY: number) => void
) {
  let pressed: { key: K; pointerId: number; x: number; y: number } | null = null;

  function onPressMove(event: PointerEvent): void {
    if (!pressed || event.pointerId !== pressed.pointerId) return;
    if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < DRAG_DISTANCE) return;
    const { key, pointerId } = pressed;
    letGo();
    begin(key, pointerId, event.clientY);
  }

  function letGo(): void {
    pressed = null;
    window.removeEventListener('pointermove', onPressMove);
    window.removeEventListener('pointerup', letGo);
    window.removeEventListener('pointercancel', letGo);
  }

  onBeforeUnmount(letGo);

  return (event: PointerEvent, key: K): void => {
    if (event.button !== 0 || busy() || pressed) return;
    // On a touch screen a finger on a header scrolls the pane; panels are moved from the keyboard.
    if (event.pointerType === 'touch' && window.matchMedia('(pointer: coarse)').matches) return;
    const element = event.target as HTMLElement;
    if (!element.closest('[data-slot="card-header"]') || element.closest(OWN_CONTROLS)) return;
    pressed = { key, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    window.addEventListener('pointermove', onPressMove);
    window.addEventListener('pointerup', letGo);
    window.addEventListener('pointercancel', letGo);
  };
}

/**
 * Dragging a card by its header. While a card is dragged nothing moves in the page itself: the
 * dragged card follows the pointer and the others slide aside, all drawn with `translate`. The
 * new order is reported once, when the card is dropped. Moving elements during the drag would
 * cost the pointer capture and the pointer's events along with it.
 */
export function useSortableDrag<K extends string>(column: SortableColumn<K>) {
  /** The card being dragged, or settling into place after a drop. */
  const active = shallowRef<K | null>(null);
  const phase = ref<'dragging' | 'settling'>('dragging');
  /** How far the active card is drawn from its own place. */
  const dragY = ref(0);
  /** The place the active card would drop into now. */
  const target = ref(0);
  /** Set for the one frame in which the new order replaces the drawn one, so nothing animates. */
  const instant = ref(false);

  /* Measured when a drag begins; the page does not change under a drag. */
  let { slots, home, gap, minY, maxY } = NOT_MEASURED;
  let start = { pointerId: -1, pageY: 0 };
  /** What scrolls under the drag: the column, where it is a pane with a scroll of its own. */
  let scroller: HTMLElement | null = null;
  let pointerY = 0;
  let scrollFrame = 0;
  let settleTimer = 0;

  const { calm } = usePreferences();
  const dragging = (): boolean => active.value !== null && phase.value === 'dragging';
  const scrolled = (): number => (scroller ? scroller.scrollTop : window.scrollY);

  /** Where each card is drawn while a drag is on. */
  function cardStyle(key: K, index: number): Record<string, string> | undefined {
    if (active.value === null) return undefined;
    if (key === active.value) return { translate: `0 ${dragY.value}px` };
    const shift = shiftFor(slots, home, target.value, index, gap);
    return shift === 0 ? undefined : { translate: `0 ${shift}px` };
  }

  const onItemPointerDown = usePressToDrag<K>(() => active.value !== null, beginDrag);

  function beginDrag(key: K, pointerId: number, clientY: number): void {
    const element = column.root.value;
    if (!element) return;
    ({ slots, home, gap, minY, maxY } = measureColumn(element, column.keys(), key));
    scroller = ownScroller(element);
    start = { pointerId, pageY: clientY + scrolled() };
    pointerY = clientY;
    target.value = home;
    dragY.value = 0;
    phase.value = 'dragging';
    active.value = key;

    document.documentElement.classList.add('sorting');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onDragKey);
    window.addEventListener('blur', cancel);
    (scroller ?? window).addEventListener('scroll', follow, { passive: true });
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerId !== start.pointerId) return;
    pointerY = event.clientY;
    follow();
  }

  /** Keeps the dragged card under the pointer, and the others out of its way. */
  function follow(): void {
    if (!dragging()) return;
    const travelled = pointerY + scrolled() - start.pageY;
    dragY.value = Math.min(maxY, Math.max(minY, travelled));
    target.value = dragTarget(slots, home, dragY.value);
  }

  /** Scrolls while the dragged card is held near the top or bottom of what it scrolls in. */
  function autoScroll(): void {
    if (!dragging()) return;
    const box = scroller?.getBoundingClientRect();
    const step = box
      ? autoScrollStep(pointerY - box.top, box.height)
      : autoScrollStep(pointerY, window.innerHeight);
    if (step !== 0) (scroller ?? window).scrollBy(0, step);
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.pointerId !== start.pointerId) return;
    drop();
  }

  /** Escape, a cancelled pointer, or leaving the window puts the card back where it was. */
  function cancel(): void {
    if (!dragging()) return;
    target.value = home;
    drop();
  }

  function onDragKey(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  }

  /** Lets go of the card: it glides into its new place, and then the order is reported. */
  function drop(): void {
    const key = active.value;
    if (key === null || !dragging()) return;
    stopListening();
    swallowNextClick();
    phase.value = 'settling';
    const to = target.value;
    dragY.value = settleOffset(slots, home, to, gap);
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => commit(key, to), calm.value ? 0 : SETTLE_MS);
  }

  /**
   * Swaps the drawn order for the real one in a single frame without transitions. Every card is
   * already drawn where the new order puts it, so nothing on screen moves.
   */
  async function commit(key: K, to: number): Promise<void> {
    instant.value = true;
    if (to !== home) column.moved(key, to);
    active.value = null;
    dragY.value = 0;
    await nextTick();
    requestAnimationFrame(() => {
      instant.value = false;
    });
  }

  function stopListening(): void {
    cancelAnimationFrame(scrollFrame);
    document.documentElement.classList.remove('sorting');
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', onDragKey);
    window.removeEventListener('blur', cancel);
    (scroller ?? window).removeEventListener('scroll', follow);
  }

  /** A card shown or hidden mid-drag (the I/O panel opens by itself) ends the drag at once. */
  watch(
    () => column.keys().join(),
    () => {
      if (active.value === null) return;
      stopListening();
      window.clearTimeout(settleTimer);
      active.value = null;
      dragY.value = 0;
    }
  );

  onBeforeUnmount(() => {
    stopListening();
    window.clearTimeout(settleTimer);
  });

  return { active, phase, instant, cardStyle, onItemPointerDown };
}
