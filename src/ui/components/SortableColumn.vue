<script setup lang="ts" generic="K extends string">
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId } from 'vue';
import { GripHorizontal } from '@lucide/vue';

/**
 * A column of cards the user can put in any order by dragging a card's handle, or with the
 * arrow keys on the handle. A card can only move within its own column.
 */
const props = defineProps<{
  /** The cards on show, in order; each one is the name of a slot. */
  keys: K[];
  labels: Record<K, string>;
}>();

const emit = defineEmits<{
  /** `key` should become visible card number `to`. */
  move: [key: K, to: number];
}>();

defineSlots<Record<K, () => unknown>>();

const root = ref<HTMLElement | null>(null);
/** The order while a card is being dragged; it is only saved when the card is dropped. */
const working = shallowRef<K[] | null>(null);
const shown = computed<K[]>(() => working.value ?? props.keys);
const dragging = shallowRef<K | null>(null);
/** How far the dragged card is drawn from its place in the column. */
const offset = ref(0);
const announcement = ref('');
const hintId = useId();

const EDGE = 120;
const MAX_SCROLL_STEP = 16;

function card(key: K): HTMLElement | null {
  return root.value?.querySelector<HTMLElement>(`[data-sortable="${key}"]`) ?? null;
}

function handle(key: K): HTMLElement | null {
  return card(key)?.querySelector<HTMLElement>('[data-sortable-handle]') ?? null;
}

const calm = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Changes the order, then slides every card that moved from where it was to its new place
 * (FLIP), so cards glide out of the way instead of jumping. `except` is left to the caller.
 */
async function reorder(change: () => void, except: K | null): Promise<void> {
  const before = new Map<K, number>();
  for (const key of shown.value) {
    const element = card(key);
    if (element && key !== except) before.set(key, element.getBoundingClientRect().top);
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
    element.style.transition = 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    element.style.transform = '';
  }
}

function announce(key: K, keys: readonly K[]): void {
  announcement.value = `${props.labels[key]} moved to position ${keys.indexOf(key) + 1} of ${keys.length}`;
}

/* Dragging */

interface Drag {
  key: K;
  pointerId: number;
  /** Pointer and scroll position, and the card's place, when the drag began. */
  pointerY: number;
  scrollY: number;
  top: number;
  original: K[];
}

let drag: Drag | null = null;
let pointerY = 0;
let busy = false;
let scrollFrame = 0;

function onPointerDown(event: PointerEvent, key: K): void {
  if (event.button !== 0 || drag) return;
  const element = card(key);
  if (!element) return;
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  pointerY = event.clientY;
  drag = {
    key,
    pointerId: event.pointerId,
    pointerY: event.clientY,
    scrollY: window.scrollY,
    top: element.offsetTop,
    original: [...props.keys]
  };
  working.value = [...props.keys];
  dragging.value = key;
  offset.value = 0;
  document.documentElement.classList.add('sorting');
  window.addEventListener('scroll', follow, { passive: true });
  window.addEventListener('keydown', onDragKey);
  scrollFrame = requestAnimationFrame(autoScroll);
}

function onPointerMove(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  pointerY = event.clientY;
  follow();
}

/** Draws the card under the pointer, and moves it in the order once it passes a neighbour. */
function follow(): void {
  if (!drag) return;
  const element = card(drag.key);
  if (!element) return;
  const travelled = pointerY + window.scrollY - (drag.pointerY + drag.scrollY);
  offset.value = travelled - (element.offsetTop - drag.top);
  if (busy) return;

  const centre = element.offsetTop + offset.value + element.offsetHeight / 2;
  const others = shown.value.filter((key) => key !== drag!.key);
  const to = others.filter((key) => {
    const other = card(key);
    return other !== null && other.offsetTop + other.offsetHeight / 2 < centre;
  }).length;
  if (to === shown.value.indexOf(drag.key)) return;

  const key = drag.key;
  const next = [...others.slice(0, to), key, ...others.slice(to)];
  busy = true;
  void reorder(() => {
    working.value = next;
  }, key).then(() => {
    busy = false;
    follow();
  });
}

/** Scrolls the page while the dragged card is held near the top or bottom of the window. */
function autoScroll(): void {
  if (!drag) return;
  const fromBottom = window.innerHeight - pointerY;
  const step =
    pointerY < EDGE
      ? -Math.ceil(((EDGE - pointerY) / EDGE) * MAX_SCROLL_STEP)
      : fromBottom < EDGE
        ? Math.ceil(((EDGE - fromBottom) / EDGE) * MAX_SCROLL_STEP)
        : 0;
  if (step !== 0) window.scrollBy(0, step);
  scrollFrame = requestAnimationFrame(autoScroll);
}

function onPointerUp(event: PointerEvent): void {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const { key, original } = drag;
  const order = shown.value;
  finish();
  if (order.join() !== original.join()) {
    emit('move', key, order.indexOf(key));
    announce(key, order);
  }
}

/**
 * Escape, or a cancelled pointer, puts every card back where it was: the saved order never
 * changed during the drag, so ending it without saving is enough.
 */
function cancel(): void {
  finish();
}

function onDragKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancel();
  }
}

/** Ends the drag; every card, the dropped one too, glides from where it was drawn into place. */
function finish(): void {
  if (!drag) return;
  drag = null;
  busy = false;
  cancelAnimationFrame(scrollFrame);
  window.removeEventListener('scroll', follow);
  window.removeEventListener('keydown', onDragKey);
  document.documentElement.classList.remove('sorting');
  void reorder(() => {
    dragging.value = null;
    offset.value = 0;
    working.value = null;
  }, null);
}

onBeforeUnmount(finish);

/* Keyboard */

function onHandleKey(event: KeyboardEvent, key: K): void {
  const index = props.keys.indexOf(key);
  const to =
    event.key === 'ArrowUp'
      ? index - 1
      : event.key === 'ArrowDown'
        ? index + 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? props.keys.length - 1
            : null;
  if (to === null) return;
  event.preventDefault();
  if (to < 0 || to >= props.keys.length || to === index) return;
  const order = props.keys.filter((item) => item !== key);
  order.splice(to, 0, key);
  void reorder(() => emit('move', key, to), null).then(() => {
    // Moving the card in the page takes focus off its handle; give it back.
    handle(key)?.focus();
    handle(key)?.scrollIntoView({ block: 'nearest' });
  });
  announce(key, order);
}
</script>

<template>
  <div ref="root" class="relative flex min-w-0 flex-col gap-4">
    <div
      v-for="key in shown"
      :key="key"
      :data-sortable="key"
      class="relative"
      :class="{ 'sortable-dragging': key === dragging }"
      :style="key === dragging ? { transform: `translateY(${offset}px)` } : undefined"
    >
      <button
        type="button"
        data-sortable-handle
        class="sortable-handle"
        :aria-label="`Move the ${labels[key]} card`"
        :aria-describedby="hintId"
        title="Drag to move this card within its column"
        @pointerdown="onPointerDown($event, key)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="cancel"
        @keydown="onHandleKey($event, key)"
      >
        <GripHorizontal aria-hidden="true" />
      </button>
      <slot :name="key" />
    </div>
    <p :id="hintId" class="sr-only">
      Drag it, or use the up and down arrow keys, to move it within this column.
    </p>
    <p class="sr-only" aria-live="polite">{{ announcement }}</p>
  </div>
</template>
