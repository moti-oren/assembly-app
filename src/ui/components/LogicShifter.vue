<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import type { Bit } from '@/core/logic/gates';
import { COLUMN_UNITS, columnCentre, rowUnits } from '@/ui/logicLayout';
import { shifterView } from '@/ui/logicShift';
import type { LogicLens } from '@/ui/useLogicLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{ lens: LogicLens }>();

// A wide circuit starts at its low bits, where a carry or a shift begins.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.lens.request.value.width);

const view = computed(() => shifterView(props.lens.solution.value));

/** The height of the band of wires between two rows, in the units of its drawing. */
const HEIGHT = 7;

function carryEnd(value: Bit, label = 'the carry: the last bit pushed out') {
  return { value, label };
}
</script>

<!--
  A shifter: the value at the top, then a row of switches for every step, with the wires each
  bit takes drawn between the rows. The bit that falls off the end goes to the carry beside it.
-->
<template>
  <div v-if="view" ref="rows" class="logic-rows" data-tailed>
    <LogicBitNumbers :width="view.width" tailed />
    <LogicRow
      label="In"
      name="The value"
      mode="flip"
      tailed
      :bits="view.input"
      :lead="
        view.left && view.carryIn !== null ? carryEnd(view.carryIn, 'the carry going in') : null
      "
      :tail="
        !view.left && view.carryIn !== null ? carryEnd(view.carryIn, 'the carry going in') : null
      "
      @flip="lens.flipBit('a', $event)"
    />
    <template v-for="index in view.shown" :key="index ?? 'gap'">
      <div v-if="index === null" class="logic-row text-xs text-muted-foreground">
        <div class="logic-label" />
        <div class="logic-cell" />
        <span class="py-1"
          >… {{ view.stages.length - view.shown.length + 1 }} more rows of one place …</span
        >
      </div>
      <template v-else>
        <div class="logic-row">
          <div class="logic-label">
            <button
              v-if="view.switched"
              type="button"
              class="rounded-sm border px-1.5 py-0.5 text-2xs font-semibold whitespace-nowrap max-md:px-1 pointer-coarse:min-h-11"
              :class="
                view.stages[index].on
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-input text-muted-foreground'
              "
              :aria-pressed="view.stages[index].on === 1"
              :aria-label="`Move ${view.stages[index].distance} places`"
              @click="lens.flipStage(index)"
            >
              move {{ view.stages[index].distance }}
            </button>
            <span v-else class="text-muted-foreground">1 place</span>
          </div>
          <div class="logic-cell" />
          <svg
            class="logic-wires"
            :viewBox="`0 0 ${rowUnits(view.width)} ${HEIGHT}`"
            preserveAspectRatio="none"
            :style="{
              width: `calc(var(--cell) * ${rowUnits(view.width) / COLUMN_UNITS})`,
              height: '1.75rem'
            }"
            aria-hidden="true"
          >
            <line
              v-for="(source, bit) in view.stages[index].sources"
              :key="bit"
              :x1="source === 'edge' ? view.edgeX : columnCentre(view.width, source)"
              y1="0"
              :x2="columnCentre(view.width, bit)"
              :y2="HEIGHT"
              :data-on="view.stages[index].after[bit] ? '' : undefined"
            />
          </svg>
        </div>
        <LogicRow
          :label="index === view.stages.length - 1 ? 'Result' : ''"
          :name="`After row ${index + 1}`"
          mode="choose"
          tailed
          :tone="index === view.stages.length - 1 && lens.written.value ? 'result' : 'plain'"
          :bits="view.stages[index].after"
          :chosen="lens.stage.value === index ? lens.bit.value : null"
          :lead="view.left ? carryEnd(view.stages[index].carryAfter) : null"
          :tail="view.left ? null : carryEnd(view.stages[index].carryAfter)"
          @choose="lens.choose($event, index)"
        />
      </template>
    </template>
    <p v-if="view.stages.length === 0" class="py-2 text-xs text-muted-foreground">
      A count of 0: the value passes through unchanged.
    </p>
  </div>
</template>
