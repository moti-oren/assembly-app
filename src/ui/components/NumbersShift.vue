<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { Minus, Plus } from '@lucide/vue';
import type { Scale } from '@/core/representation/readings';
import type { ScalingRequest, ScalingSolution } from '@/core/representation/scaling';
import { Button } from '@/components/ui/button';
import { placesText, shiftSummary, withCount } from '@/ui/numbersShift';
import { bitsOf } from '@/ui/numbersView';
import type { NumberLens } from '@/ui/useNumberLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';

const props = defineProps<{
  lens: NumberLens;
  request: ScalingRequest;
  solution: ScalingSolution;
}>();

// A wide row starts at its low bits, where the small numbers are.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.request.width);

const SCALES: readonly Scale[] = ['unsigned', 'signed'];

const scales = computed(() =>
  SCALES.map((scale) => ({
    scale,
    summary: shiftSummary(props.solution.scales[scale], props.request)
  }))
);

/** A press at either end changes nothing, and so leaves the CPU's own shift on show. */
function move(by: number): void {
  const next = withCount(props.request, props.request.count + by);
  if (next.count !== props.request.count) props.lens.change(next);
}
</script>

<!--
  One row of bits moved along, read twice: a place to the left doubles the number on both scales
  while it fits, and a place to the right halves it on the scale its fill belongs to.
-->
<template>
  <div class="flex flex-wrap items-center gap-2">
    <!-- A stepper at its end stays in the tab order, so the keyboard's focus is not dropped. -->
    <div class="flex items-center gap-1" role="group" aria-label="How many places">
      <Button
        variant="outline"
        size="sm"
        class="size-7 p-0 aria-disabled:opacity-50 pointer-coarse:size-11"
        aria-label="One place fewer"
        :aria-disabled="request.count <= 0"
        @click="move(-1)"
      >
        <Minus />
      </Button>
      <output class="min-w-16 text-center text-sm tabular-nums" aria-live="polite">
        {{ placesText(request.count) }}
      </output>
      <Button
        variant="outline"
        size="sm"
        class="size-7 p-0 aria-disabled:opacity-50 pointer-coarse:size-11"
        aria-label="One place more"
        :aria-disabled="request.count >= request.width"
        @click="move(1)"
      >
        <Plus />
      </Button>
    </div>
  </div>

  <div ref="rows" class="logic-rows mt-3">
    <LogicBitNumbers :width="request.width" />
    <LogicRow
      label="Value"
      name="The value"
      mode="flip"
      :bits="bitsOf(request.value, request.width)"
      @flip="lens.flipBit('a', $event)"
    />
    <LogicRow
      label="Moved"
      name="The result"
      :tone="lens.written.value ? 'result' : 'plain'"
      :bits="bitsOf(solution.result, request.width)"
    />
  </div>

  <div class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 @xl:grid-cols-2">
    <section v-for="each in scales" :key="each.scale" :aria-label="`As ${each.scale} numbers`">
      <h3 class="text-sm font-semibold capitalize">{{ each.scale }}</h3>
      <p class="mt-1 font-mono text-sm font-semibold tabular-nums">{{ each.summary.sum }}</p>
      <p
        class="mt-0.5 text-sm text-pretty"
        :class="{ 'text-muted-foreground': each.summary.agrees }"
      >
        <span v-if="each.summary.lead" class="me-1 font-semibold">{{ each.summary.lead }}</span>
        {{ each.summary.verdict }}
      </p>
    </section>
  </div>
</template>
