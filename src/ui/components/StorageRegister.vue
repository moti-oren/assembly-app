<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { ArrowDown, ArrowUp, RotateCcw } from '@lucide/vue';
import type { Bit } from '@/core/logic/gates';
import { REGISTER } from '@/core/logic/register';
import { Button } from '@/components/ui/button';
import { bitsLeftToRight, startsDigit } from '@/ui/logicLayout';
import { CLOCK_ACTION, keptBits, phaseText } from '@/ui/storageView';
import type { StorageLens } from '@/ui/useStorageLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{ lens: StorageLens }>();

// A wide register starts at its low bits, as the circuits of the logic topic do.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.lens.request.value.width);

const width = computed(() => props.lens.request.value.width);
const phase = computed(() => props.lens.phase.value);
const clockHigh = computed(() => phase.value === 'high');

/** One of the register's wires for every bit, bit 0 first. */
function wires(name: (bit: number) => string): Bit[] {
  const signals = props.lens.signals.value;
  return Array.from({ length: width.value }, (_, bit) => signals[name(bit)]);
}
</script>

<!--
  A register as rows of bits: what waits at its inputs, which bits are written, a flip-flop under
  every column, and what they hold. The clock button takes it through one cycle.
-->
<template>
  <div class="flex flex-col gap-3">
    <div ref="rows" class="logic-rows">
      <LogicBitNumbers :width="width" />
      <LogicRow
        label="Input"
        name="The input"
        mode="flip"
        :bits="wires(REGISTER.input)"
        @flip="lens.flipBit('input', $event)"
      />
      <LogicRow
        label="Write"
        name="The write line"
        mode="flip"
        :bits="wires(REGISTER.write)"
        @flip="lens.flipBit('enabled', $event)"
      />
      <div class="logic-row">
        <div class="logic-label">Cells</div>
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
            :aria-pressed="lens.cell.cell.value === 'register' && lens.bit.value === bit"
            :aria-label="`The flip-flop of bit ${bit}: show its gates`"
            @click="lens.chooseBit(bit)"
          >
            FF
          </button>
        </div>
      </div>
      <LogicRow
        label="Holds"
        name="The register"
        :tone="lens.written.value ? 'result' : 'plain'"
        :plain="keptBits(lens.request.value)"
        :bits="wires(REGISTER.q)"
      />
    </div>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button variant="outline" size="sm" class="pointer-coarse:h-11" @click="lens.clock()">
        <ArrowDown v-if="clockHigh" />
        <ArrowUp v-else />
        {{ CLOCK_ACTION[phase] }}
      </Button>
      <span class="flex items-center gap-1.5 text-xs text-muted-foreground">
        Clock
        <span
          class="logic-bit [--cell:1.875rem]"
          :data-on="clockHigh ? '' : undefined"
          aria-hidden="true"
          >{{ clockHigh ? 1 : 0 }}</span
        >
      </span>
      <!--
        It stays in place, and can keep the focus, when there is nothing to go back to: a button
        that disabled itself as it was pressed would leave the keyboard on a dead control.
      -->
      <Button
        variant="ghost"
        size="sm"
        class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:h-11"
        :aria-disabled="phase === 'before'"
        @click="lens.rewind()"
      >
        <RotateCcw />
        Start over
      </Button>
    </div>
    <p class="max-w-prose text-sm text-pretty" aria-live="polite">
      {{ phaseText(phase, lens.request.value) }}
    </p>
  </div>
</template>
