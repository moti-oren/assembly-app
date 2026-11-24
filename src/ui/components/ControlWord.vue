<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { bitsOf } from '@/ui/controlView';
import type { ControlLens } from '@/ui/useControlLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import ControlWordEntry from './ControlWordEntry.vue';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{ lens: ControlLens }>();

const WIDTH = 32;

// The word starts at its low bits, where the opcode is.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => WIDTH);

const bits = computed(() => bitsOf(props.lens.word.value, WIDTH));
</script>

<!-- The instruction as the control unit gets it: 32 bits, and the fields they fall into. -->
<template>
  <div class="flex flex-col gap-3">
    <div ref="rows" class="logic-rows">
      <LogicBitNumbers :width="WIDTH" />
      <LogicRow
        label="Word"
        name="The instruction word"
        mode="flip"
        :bits="bits"
        @flip="lens.flipBit($event)"
      />
    </div>
    <ControlWordEntry :lens="lens" />
    <ol
      class="grid gap-1.5 text-xs sm:grid-cols-2 lg:grid-cols-3"
      aria-label="The fields of the word"
    >
      <li
        v-for="field in lens.fields.value"
        :key="`${field.label}-${field.high}`"
        class="rounded-md border px-3 py-2"
        :class="field.decoded ? 'border-foreground/40' : 'border-dashed text-muted-foreground'"
      >
        <p class="flex flex-wrap items-baseline gap-x-2">
          <span class="font-mono font-semibold text-foreground">{{ field.label }}</span>
          <span>{{ field.range }}</span>
          <span class="font-mono tabular-nums">{{ field.bits }}</span>
        </p>
        <p class="mt-0.5 text-pretty text-muted-foreground">
          {{ field.note }}<template v-if="field.decoded">. A decoder reads it.</template>
        </p>
      </li>
    </ol>
  </div>
</template>
