<script setup lang="ts" generic="K extends string">
import { nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import {
  autoScrollStep,
  dragTarget,
  keyTarget,
  settleOffset,
  shiftFor,
  withMoved,
  type Slot
} from '@/ui/reorder';
import { usePreferences } from '@/ui/usePreferences';

/**
 * A column of cards the user can put in any order by dragging a card's header, or with Alt and
 * the arrow keys on the card's handle (an element marked `data-sortable-handle`, which the card
 * provides). A card can only move within its own column.
 *
 * While a card is dragged nothing moves in the page itself: the dragged card follows the
 * pointer and the others slide aside, all drawn with `translate`. The new order is saved once,
 * when the card is dropped. Moving elements during the drag would cost the pointer capture
 * and the pointer's events along with it.
 */
const props = defineProps<{
  /** The cards on show, in order; each one is the name of a slot. */
  keys: K[];
  labels: Record<K, string>;
  /** A card's own style, under what a drag adds to it. */
  itemStyle?: (key: K) => Record<string, string> | undefined;
}>();

const emit = defineEmits<{
  /** `key` should become visible card number `to`. */
  move: [key: K, to: number];
}>();

defineSlots<Record<K, () => unknown>>();

/** How far the pointer must travel from a header before it is a drag and not a click. */
const DRAG_DISTANCE = 4;
/** What in a header keeps its own click: a drag never starts on these. */
const OWN_CONTROLS = 'button, a, input, select, textarea, [role="button"], [role="separator"]';

/** How long a dropped card takes to glide into its place. */
const SETTLE_MS = 200;
/** How long the other cards take to slide aside, and a card moved by the keyboard to glide. */
const SLIDE_MS = 220;
const SLIDE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
/** The same timings for the transitions in styles.css, so the two cannot drift apart. */
const TIMING_VARS = {
  '--sortable-settle': `${SETTLE_MS}ms`,
  '--sortable-slide': `${SLIDE_MS}ms`,
  '--sortable-easing': SLIDE_EASING
};

const root = ref<HTMLElement | null>(null);
/** The card being dragged, or settling into place after a drop. */
const active = shallowRef<K | null>(null);
const phase = ref<'dragging' | 'settling'>('dragging');
/** How far the active card is drawn from its own place. */
const dragY = ref(0);
/** The place the active card would drop into now. */
const target = ref(0);
/** Set for the one frame in which the new order replaces the drawn one, so nothing animates. */
const instant = ref(false);
const announcement = ref('');

/* Measured when a drag begins; the page does not change under a drag. */
let slots: Slot[] = [];
let home = 0;
let gap = 0;
let minY = 0;
let maxY = 0;
let start = { pointerId: -1, pageY: 0 };
/** A pointer that went down on a header and has not yet moved far enough to drag. */
let pressed: { key: K; pointerId: number; x: number; y: number } | null = null;
/** What scrolls under the drag: the column, where it is a pane with a scroll of its own. */
let scroller: HTMLElement | null = null;
let pointerY = 0;
let scrollFrame = 0;
let settleTimer = 0;

const { calm: calmRef } = usePreferences();
const calm = (): boolean => calmRef.value;

/** The column when it scrolls by itself (a pane of the workbench); null when the page does. */
function ownScroller(column: HTMLElement): HTMLElement | null {
  const overflow = getComputedStyle(column).overflowY;
  return overflow === 'auto' || overflow === 'scroll' ? column : null;
}

function scrolled(): number {
  return scroller ? scroller.scrollTop : window.scrollY;
}

function card(key: K): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`[data-sortable="${key}"]`) ?? null;
}

/** What gets focus back after a keyboard move: the card's own handle. */
function handle(key: K): HTMLElement | null {
  return card(key)?.querySelector<HTMLElement>('[data-sortable-handle]') ?? null;
}

function announce(key: K, keys: readonly K[]): void {
  announcement.value = `${props.labels[key]} moved to position ${keys.indexOf(key) + 1} of ${keys.length}`;
}

/** Where each card is drawn while a drag is on. */
function cardStyle(key: K, index: number): Record<string, string> | undefined {
  if (active.value === null) return undefined;
  if (key === active.value) return { translate: `0 ${dragY.value}px` };
  const shift = shiftFor(slots, home, target.value, index, gap);
  return shift === 0 ? undefined : { translate: `0 ${shift}px` };
}

/* Dragging */

/** A press on a card's header (outside its own controls) is a drag once it moves far enough. */
function onItemPointerDown(event: PointerEvent, key: K): void {
  if (event.button !== 0 || active.value !== null || pressed) return;
  const target = event.target as HTMLElement;
  if (!target.closest('[data-slot="card-header"]') || target.closest(OWN_CONTROLS)) return;
  pressed = { key, pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  window.addEventListener('pointermove', onPressMove);
  window.addEventListener('pointerup', letGo);
  window.addEventListener('pointercancel', letGo);
}

function onPressMove(event: PointerEvent): void {
  if (!pressed || event.pointerId !== pressed.pointerId) return;
  if (Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) < DRAG_DISTANCE) return;
  const { key, pointerId } = pressed;
  letGo();
  beginDrag(key, pointerId, event.clientY);
}

/** The press ended before it became a drag: it is a click, which the header handles. */
function letGo(): void {
  pressed = null;
  window.removeEventListener('pointermove', onPressMove);
  window.removeEventListener('pointerup', letGo);
  window.removeEventListener('pointercancel', letGo);
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

function beginDrag(key: K, pointerId: number, clientY: number): void {
  const column = root.value;
  if (!column) return;

  slots = props.keys.map((item) => {
    const element = card(item);
    return { top: element?.offsetTop ?? 0, height: element?.offsetHeight ?? 0 };
  });
  home = props.keys.indexOf(key);
  gap = parseFloat(getComputedStyle(column).rowGap) || 0;
  // The card can travel from the top of the column to its bottom, and no further.
  const last = slots[slots.length - 1];
  minY = slots[0].top - slots[home].top;
  maxY = last.top + last.height - (slots[home].top + slots[home].height);

  scroller = ownScroller(column);
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
  if (active.value === null || phase.value !== 'dragging') return;
  const travelled = pointerY + scrolled() - start.pageY;
  dragY.value = Math.min(maxY, Math.max(minY, travelled));
  target.value = dragTarget(slots, home, dragY.value);
}

/** Scrolls while the dragged card is held near the top or bottom of what it scrolls in. */
function autoScroll(): void {
  if (active.value === null || phase.value !== 'dragging') return;
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
  if (active.value === null || phase.value !== 'dragging') return;
  target.value = home;
  drop();
}

function onDragKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancel();
  }
}

/** Lets go of the card: it glides into its new place, and then the order is saved. */
function drop(): void {
  const key = active.value;
  if (key === null || phase.value !== 'dragging') return;
  stopListening();
  swallowNextClick();
  phase.value = 'settling';
  const to = target.value;
  dragY.value = settleOffset(slots, home, to, gap);
  window.clearTimeout(settleTimer);
  settleTimer = window.setTimeout(() => commit(key, to), calm() ? 0 : SETTLE_MS);
}

/**
 * Swaps the drawn order for the real one in a single frame without transitions. Every card is
 * already drawn where the new order puts it, so nothing on screen moves.
 */
async function commit(key: K, to: number): Promise<void> {
  instant.value = true;
  if (to !== home) {
    emit('move', key, to);
    announce(key, withMoved(props.keys, key, to));
  }
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
  () => props.keys.join(),
  () => {
    if (active.value === null) return;
    stopListening();
    window.clearTimeout(settleTimer);
    active.value = null;
    dragY.value = 0;
  }
);

onBeforeUnmount(() => {
  letGo();
  stopListening();
  window.clearTimeout(settleTimer);
});

/* Keyboard */

/**
 * Changes the order, then slides every card from where it was to its new place (FLIP), so the
 * cards glide instead of jumping.
 */
async function reorder(change: () => void): Promise<void> {
  const before = new Map<K, number>();
  for (const key of props.keys) {
    const element = card(key);
    if (element) before.set(key, element.getBoundingClientRect().top);
  }
  change();
  await nextTick();
  if (calm()) return;
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
  const index = props.keys.indexOf(key);
  const to = keyTarget(event.key, index, props.keys.length);
  if (to === null) return;
  event.preventDefault();
  if (active.value !== null || to < 0 || to >= props.keys.length || to === index) return;
  const order = withMoved(props.keys, key, to);
  void reorder(() => emit('move', key, to)).then(() => {
    // Moving the card in the page takes focus off its grip; give it back.
    handle(key)?.focus();
    handle(key)?.scrollIntoView({ block: 'nearest' });
  });
  announce(key, order);
}
</script>

<template>
  <div
    ref="root"
    class="relative flex min-w-0 flex-col *:shrink-0"
    :class="{ 'sortable-instant': instant }"
    :style="TIMING_VARS"
  >
    <div
      v-for="(key, index) in keys"
      :key="key"
      :data-sortable="key"
      class="sortable-item relative"
      :class="{
        'sortable-lifted': key === active && phase === 'dragging',
        'sortable-settling': key === active && phase === 'settling'
      }"
      :style="[itemStyle?.(key), cardStyle(key, index)]"
      @pointerdown="onItemPointerDown($event, key)"
      @keydown="onHandleKey($event, key)"
    >
      <slot :name="key" />
    </div>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </div>
</template>
