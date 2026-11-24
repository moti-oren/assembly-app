<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { ADDER } from '@/core/logic/adder';
import type { Bit } from '@/core/logic/gates';
import { bitsLeftToRight, startsDigit } from '@/ui/logicLayout';
import { pendingBits, readyRow, readySummary } from '@/ui/logicTime';
import type { LogicLens } from '@/ui/useLogicLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';
import LogicTimeNote from './LogicTimeNote.vue';

const props = defineProps<{ lens: LogicLens }>();

// A wide circuit starts at its low bits, where a carry or a shift begins.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.lens.request.value.width);

const width = computed(() => props.lens.request.value.width);
const subtracting = computed(() => props.lens.request.value.kind === 'subtract');
const signals = computed(() => props.lens.shown.value.signals);
/** The adder through time, while time is slowed down. */
const propagation = computed(() => props.lens.time.propagation.value);
const step = computed(() => props.lens.time.step.value);

/** One of the adder's wires for every bit, bit 0 first. */
function wires(name: (bit: number) => string): Bit[] {
  return Array.from({ length: width.value }, (_, bit) => signals.value[name(bit)]);
}

/** Which bits of a row of wires will change again; null while the adder is shown at rest. */
function pending(name: (bit: number) => string): boolean[] | null {
  return propagation.value && pendingBits(propagation.value, name, width.value, step.value);
}

/** Every row of wires, worked out once for each moment and not once for each render. */
const bits = computed(() => ({
  carry: wires(ADDER.carry),
  a: wires(ADDER.a),
  b: wires(ADDER.b),
  y: wires(ADDER.y),
  sum: wires(ADDER.sum)
}));
const unsettled = computed(() => ({
  carry: pending(ADDER.carry),
  y: pending(ADDER.y),
  sum: pending(ADDER.sum)
}));
/** Whether the carry handed on by each adder will change again. The last is the carry out. */
const carryPending = computed(() => pending((bit) => ADDER.carry(bit + 1)));
const carryOut = computed(() => ({
  value: signals.value[ADDER.carry(width.value)],
  label: 'the carry out',
  pending: carryPending.value?.[width.value - 1] ?? false
}));
/** The gate delay at which each bit of the sum stops changing. */
const sumReady = computed(
  () => propagation.value && readyRow(propagation.value, ADDER.sum, width.value)
);
</script>

<!--
  An adder as a sum on paper: the carries above, the two numbers, and a full adder under every
  column. Pressing an adder shows the gates inside it. Slowed down, the rows show the wires one
  gate delay at a time.
-->
<template>
  <div class="flex flex-col gap-3">
    <LogicTimeNote :lens="lens" />
    <div ref="rows" class="logic-rows" :data-timed="propagation ? '' : undefined">
      <LogicBitNumbers :width="width" />
      <LogicRow
        class="logic-ripple"
        label="Carry"
        name="The carry into"
        tone="quiet"
        mode="lowest"
        :bits="bits.carry"
        :pending="unsettled.carry"
        :lead="carryOut"
        @flip="lens.flipCarryIn()"
      />
      <LogicRow label="A" name="A" mode="flip" :bits="bits.a" @flip="lens.flipBit('a', $event)" />
      <LogicRow label="B" name="B" mode="flip" :bits="bits.b" @flip="lens.flipBit('b', $event)" />
      <LogicRow
        v-if="subtracting"
        class="logic-ripple"
        label="NOT B"
        name="B inverted"
        tone="quiet"
        :bits="bits.y"
        :pending="unsettled.y"
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
            :data-on="signals[ADDER.carry(bit + 1)] ? '' : undefined"
            :data-pending="carryPending?.[bit] ? '' : undefined"
          />
          <button
            type="button"
            class="logic-unit"
            :aria-pressed="lens.bit.value === bit"
            :data-stuck="lens.broken.value?.[bit] ? '' : undefined"
            :aria-label="`The full adder of bit ${bit}${lens.broken.value?.[bit] ? ', with a broken gate' : ''}: show its gates`"
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
        :bits="bits.sum"
        :pending="unsettled.sum"
        :wrong="lens.wrong.value"
      />
      <!-- When each bit of the result is ready: a staircase where a carry had to climb. -->
      <div v-if="sumReady" class="logic-row text-2xs text-tertiary-foreground" data-compact>
        <div class="logic-label font-normal!">
          <span aria-hidden="true">ready at</span>
          <span class="sr-only">{{ readySummary(sumReady) }}</span>
        </div>
        <div class="logic-cell" />
        <div
          v-for="bit in bitsLeftToRight(width)"
          :key="bit"
          class="logic-cell logic-ready font-mono tabular-nums"
          :data-digit-start="startsDigit(width, bit) ? '' : undefined"
          :data-reached="sumReady[bit] <= step ? '' : undefined"
          aria-hidden="true"
        >
          {{ sumReady[bit] }}
        </div>
      </div>
    </div>
  </div>
</template>
