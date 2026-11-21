<script setup lang="ts" generic="K extends string">
import { ref } from 'vue';
import { movedAnnouncement } from '@/ui/reorder';
import { SETTLE_MS, useSortableDrag } from '@/ui/useSortableDrag';
import { SLIDE_EASING, SLIDE_MS, useSortableKeys } from '@/ui/useSortableKeys';

/**
 * A column of cards the user can put in any order by dragging a card's header, or with Alt and
 * the arrow keys on the card's handle (an element marked `data-sortable-handle`, which the card
 * provides). A card can only move within its own column.
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

/** The timings of the transitions in styles.css, so the two cannot drift apart. */
const TIMING_VARS = {
  '--sortable-settle': `${SETTLE_MS}ms`,
  '--sortable-slide': `${SLIDE_MS}ms`,
  '--sortable-easing': SLIDE_EASING
};

const root = ref<HTMLElement | null>(null);
const announcement = ref('');

const column = {
  root,
  keys: () => props.keys,
  moved: (key: K, to: number) => {
    announcement.value = movedAnnouncement(props.labels[key], props.keys, key, to);
    emit('move', key, to);
  }
};
const { active, phase, instant, cardStyle, onItemPointerDown } = useSortableDrag(column);
const { onHandleKey } = useSortableKeys(column, () => active.value !== null);
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
