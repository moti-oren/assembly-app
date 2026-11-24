<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { bitsOf } from '@/ui/controlView';
import type { ControlLens } from '@/ui/useControlLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import ControlFields from './ControlFields.vue';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{
  lens: ControlLens;
  /** With the word's fields under its bits: where no sidebar beside them lists them. */
  withFields?: boolean;
}>();

const WIDTH = 32;

// The word starts at its low bits, where the opcode is.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => WIDTH);

const bits = computed(() => bitsOf(props.lens.word.value, WIDTH));
</script>

<!-- The instruction as the control unit gets it: 32 bits, each to flip. -->
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
    <ControlFields v-if="withFields" :lens="lens" />
  </div>
</template>
