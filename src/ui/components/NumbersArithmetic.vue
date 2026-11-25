<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { refDebounced } from '@vueuse/core';
import type { ArithmeticRequest, ArithmeticSolution } from '@/core/representation/arithmetic';
import type { Scale } from '@/core/representation/readings';
import { scaleSummary, scalesSaid } from '@/ui/numbersFlags';
import { bitsOf } from '@/ui/numbersView';
import { wheelOf } from '@/ui/numbersWheel';
import type { NumberLens } from '@/ui/useNumberLens';
import { useScrollEnd } from '@/ui/useScrollEnd';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';
import NumbersExtra from './NumbersExtra.vue';
import NumbersWheel from './NumbersWheel.vue';

const props = defineProps<{
  lens: NumberLens;
  request: ArithmeticRequest;
  solution: ArithmeticSolution;
  /** With the one more coming in under the rows: where no sidebar beside them holds it. */
  withExtra?: boolean;
}>();

// A wide row starts at its low bits, where the small numbers are.
useScrollEnd(useTemplateRef<HTMLElement>('rows'), () => props.request.width);

const SCALES: readonly Scale[] = ['unsigned', 'signed'];

const scales = computed(() =>
  SCALES.map((scale) => {
    const solved = props.solution[scale];
    return {
      scale,
      wheel: wheelOf(solved, props.request.width),
      summary: scaleSummary(solved, props.request.kind, props.request.extra),
      a: solved.a.toLocaleString('en-US')
    };
  })
);
const subtracting = computed(() => props.request.kind === 'subtract');
// What both wheels show, said once A comes to rest: a drag round the wheel is not read step by step.
const said = refDebounced(
  computed(() => scalesSaid(scales.value)),
  400
);
</script>

<!--
  One sum, read twice: the same bits go round a wheel of unsigned numbers and a wheel of signed
  ones, and each wheel has its own place where the answer stops fitting.
-->
<template>
  <div class="grid grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-6 @xl:grid-cols-2">
    <section v-for="each in scales" :key="each.scale" :aria-label="`As ${each.scale} numbers`">
      <h3 class="text-sm font-semibold capitalize">{{ each.scale }}</h3>
      <NumbersWheel
        :wheel="each.wheel"
        :width="request.width"
        :a="request.a"
        :reading="each.a"
        :written="lens.written.value"
        @set="lens.setOperand('a', $event)"
      />
      <p class="font-mono text-sm font-semibold tabular-nums">
        {{ each.summary.sum }}
      </p>
      <p class="mt-0.5 text-sm text-pretty" :class="{ 'text-muted-foreground': each.summary.fits }">
        {{ each.summary.verdict }}
      </p>
      <p v-if="each.wheel.stretched" class="mt-1 text-xs text-muted-foreground">
        The step is drawn longer than it is: at this width it would be too short to see.
      </p>
    </section>
  </div>
  <p class="mt-3 max-w-prose text-xs text-pretty text-muted-foreground">
    The blue dot is A: drag it round the wheel. The arrow goes from A to the answer. The dashed line
    is the seam, where the scale ends and starts again; an arrow across it is an answer that does
    not fit.
  </p>
  <!-- The region is there before its text is, or the first change would not be announced. -->
  <p class="sr-only" aria-live="polite">{{ said }}</p>

  <div ref="rows" class="logic-rows mt-5">
    <LogicBitNumbers :width="request.width" />
    <LogicRow
      label="A"
      name="A"
      mode="flip"
      :bits="bitsOf(request.a, request.width)"
      @flip="lens.flipBit('a', $event)"
    />
    <LogicRow
      label="B"
      name="B"
      mode="flip"
      :bits="bitsOf(request.b, request.width)"
      @flip="lens.flipBit('b', $event)"
    />
    <LogicRow
      :label="subtracting ? 'A − B' : 'A + B'"
      name="The result"
      :tone="lens.written.value ? 'result' : 'plain'"
      :bits="bitsOf(solution.result, request.width)"
    />
  </div>
  <NumbersExtra v-if="withExtra" class="mt-2" :lens="lens" />
</template>
