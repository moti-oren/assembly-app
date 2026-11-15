<script setup lang="ts">
import { computed, reactive, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    text: string;
    /** `roll` slides a changed character like an odometer; `flip` turns it over like a bit. */
    effect?: 'roll' | 'flip';
    /** Same length as `text`: a '1' marks the character at that position as changed. */
    marks?: string;
    /** Shows 0s fainter than 1s, like unlit and lit lamps. */
    dimZeros?: boolean;
  }>(),
  { effect: 'roll', marks: '' }
);

// Cells are keyed from the right so a number that gains a digit keeps its low digits in place.
const cells = computed(() =>
  [...props.text].map((char, index) => ({
    char,
    place: props.text.length - index,
    marked: props.marks[index] === '1'
  }))
);

const directions = reactive<Record<number, 'up' | 'down'>>({});

watch(
  () => props.text,
  (next, previous) => {
    for (let place = 1; place <= next.length; place++) {
      const before = previous[previous.length - place];
      const after = next[next.length - place];
      if (before !== undefined && before !== after) {
        directions[place] = after > before ? 'up' : 'down';
      }
    }
  }
);

function transitionName(place: number): string {
  return props.effect === 'flip' ? 'flip' : `roll-${directions[place] ?? 'up'}`;
}
</script>

<template>
  <span class="sr-only">{{ text }}</span><span aria-hidden="true"
    ><span
      v-for="cell in cells"
      :key="cell.place"
      class="digit"
      :class="{ 'digit-marked': cell.marked, 'digit-off': dimZeros && cell.char === '0' }"
      ><Transition :name="transitionName(cell.place)"
        ><span :key="cell.char" class="digit-glyph">{{ cell.char }}</span></Transition
      ></span
    ></span
  >
</template>
