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
const subtracting = computed(() => props.lens.request.value.kind === 'subtract');

/** One of the adder's wires for every bit, bit 0 first. */
function wires(name: (bit: number) => string): Bit[] {
  const { signals } = props.lens.solution.value;
  return Array.from({ length: width.value }, (_, bit) => signals[name(bit)]);
}

const carryOut = computed(() => props.lens.solution.value.signals[ADDER.carry(width.value)]);
</script>

<!--
  An adder as a sum on paper: the carries above, the two numbers, and a full adder under every
  column. Pressing an adder shows the gates inside it.
-->
<template>
  <div ref="rows" class="logic-rows">
    <LogicBitNumbers :width="width" />
    <LogicRow
      class="logic-ripple"
      label="Carry"
      name="The carry into"
      tone="quiet"
      mode="lowest"
      :bits="wires(ADDER.carry)"
      :lead="{ value: carryOut, label: 'the carry out' }"
      @flip="lens.flipCarryIn()"
    />
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
    <LogicRow
      v-if="subtracting"
      label="NOT B"
      name="B inverted"
      tone="quiet"
      :bits="wires(ADDER.y)"
    />
    <div class="logic-row logic-ripple">
      <div class="logic-label">Adders</div>
      <div class="logic-cell" />
      <div
        v-for="bit in bitsLeftToRight(width)"
        :key="bit"
        class="logic-cell"
        :data-digit-start="startsDigit(width, bit) ? '' : undefined"
        :style="{ '--bit': bit + 1 }"
      >
        <!-- The carry this adder hands to the one on its left. -->
        <span
          class="logic-carry"
          :data-on="lens.solution.value.signals[ADDER.carry(bit + 1)] ? '' : undefined"
        />
        <button
          type="button"
          class="logic-unit"
          :aria-pressed="lens.bit.value === bit"
          :aria-label="`The full adder of bit ${bit}: show its gates`"
          @click="lens.choose(bit)"
        >
          +
        </button>
      </div>
    </div>
    <LogicRow
      class="logic-ripple"
      :label="subtracting ? 'A − B' : 'Sum'"
      name="The result"
      :tone="lens.written.value ? 'result' : 'plain'"
      :bits="wires(ADDER.sum)"
    />
  </div>
</template>
