<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { ADDER } from '@/core/logic/adder';
import type { Bit } from '@/core/logic/gates';
import { bitsLeftToRight, startsDigit } from '@/ui/logicLayout';
import type { LogicLens } from '@/ui/useLogicLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{ lens: LogicLens }>();

// A wide circuit starts at its low bits, where a carry or a shift begins.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.lens.request.value.width);

const width = computed(() => props.lens.request.value.width);
const SYMBOLS: Record<string, string> = { and: '&', or: '≥1', xor: '=1' };
const symbol = computed(() => SYMBOLS[props.lens.request.value.kind] ?? '');
const gateName = computed(() => props.lens.request.value.kind.toUpperCase());

function wires(name: (bit: number) => string): Bit[] {
  const { signals } = props.lens.solution.value;
  return Array.from({ length: width.value }, (_, bit) => signals[name(bit)]);
}
</script>

<!-- AND, OR or XOR: one gate under every column, each working on its own two bits. -->
<template>
  <div ref="rows" class="logic-rows">
    <LogicBitNumbers :width="width" />
    <LogicRow
      label="A"
      name="A"
      mode="flip"
      :bits="wires(ADDER.a)"
      @flip="lens.flipBit('a', $event)"
    />
    <LogicRow
      label="B"
      name="B"
      mode="flip"
      :bits="wires(ADDER.b)"
      @flip="lens.flipBit('b', $event)"
    />
    <div class="logic-row">
      <div class="logic-label">Gates</div>
      <div class="logic-cell" />
      <div
        v-for="bit in bitsLeftToRight(width)"
        :key="bit"
        class="logic-cell"
        :data-digit-start="startsDigit(width, bit) ? '' : undefined"
      >
        <button
          type="button"
          class="logic-unit"
          :aria-pressed="lens.bit.value === bit"
          :aria-label="`The ${gateName} gate of bit ${bit}: show it`"
          @click="lens.choose(bit)"
        >
          {{ symbol }}
        </button>
      </div>
    </div>
    <LogicRow
      label="Result"
      name="The result"
      :tone="lens.written.value ? 'result' : 'plain'"
      :bits="wires(ADDER.sum)"
    />
  </div>
</template>
