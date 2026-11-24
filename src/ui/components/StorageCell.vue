<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { cellDiagram } from '@/ui/storageDiagram';
import { pressText, PULSE_WIRE, timingChart, traceTexts } from '@/ui/storageTiming';
import { CELL_INPUTS, CELL_LESSONS, cellLabel, UNSETTLED } from '@/ui/storageView';
import type { StorageLens } from '@/ui/useStorageLens';
import LogicDiagram from './LogicDiagram.vue';
import StageSection from './StageSection.vue';
import StorageTiming from './StorageTiming.vue';

const props = defineProps<{ lens: StorageLens }>();

const cell = computed(() => props.lens.cell);
const kind = computed(() => cell.value.cell.value);
const free = computed(() => cell.value.free.value);
/** The input a press of Pulse raises and lowers, in the cells that have a clock. */
const pulsed = computed(() => (free.value ? (PULSE_WIRE[free.value] ?? null) : null));
const diagram = computed(() => cellDiagram(kind.value, props.lens.bit.value));
/** The wires drawn: the hand-worked cell's own, or the register's at this moment of its cycle. */
const signals = computed(() => (free.value ? cell.value.signals.value : props.lens.signals.value));
/** Whether the cell worked by hand never came to rest. */
const unsettled = computed(() => free.value !== null && !cell.value.settled.value);
const trace = computed(() => cell.value.trace.value);
const chart = computed(() => (free.value ? timingChart(free.value, trace.value) : null));
const told = computed(() => (free.value ? traceTexts(free.value, trace.value) : []));
const press = computed(() =>
  free.value ? pressText(free.value, trace.value, cell.value.pressSteps.value) : ''
);
const heading = computed(() =>
  free.value ? cellLabel(kind.value) : `Bit ${props.lens.bit.value} of the register`
);
</script>

<!-- One memory cell gate by gate: the register's own bit, or a simpler cell to work by hand. -->
<template>
  <StageSection :title="`${heading}, gate by gate`" label="One memory cell">
    <template #lesson>{{ CELL_LESSONS[kind] }}</template>

    <div
      v-if="free"
      class="flex flex-wrap items-center gap-x-5 gap-y-2 [--cell-height:2.25rem] [--cell:2.25rem] pointer-coarse:[--cell-height:2.75rem] pointer-coarse:[--cell:2.75rem]"
      role="group"
      aria-label="The cell’s inputs"
    >
      <span
        v-for="input in CELL_INPUTS[free]"
        :key="input.signal"
        class="flex items-center gap-2 text-xs font-medium"
      >
        {{ input.label }}
        <button
          type="button"
          class="logic-bit"
          :data-on="cell.inputs.value[input.signal] ? '' : undefined"
          :aria-pressed="cell.inputs.value[input.signal] === 1"
          :aria-label="`${input.label}: ${cell.inputs.value[input.signal]}`"
          @click="cell.flipInput(input.signal)"
        >
          {{ cell.inputs.value[input.signal] }}
        </button>
      </span>
      <Button
        v-if="cell.bothHeld.value"
        variant="outline"
        size="sm"
        class="pointer-coarse:h-11"
        @click="cell.releaseAll()"
      >
        Let go of both at once
      </Button>
      <span v-else class="text-xs text-muted-foreground">Press an input to flip it.</span>
      <!-- On a narrow stage the two take a row of their own, so neither is left alone on a line. -->
      <div class="flex w-full gap-2 @xl:w-auto">
        <Button
          v-if="pulsed"
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          :aria-label="`Pulse ${pulsed.label}: flip it and flip it back`"
          @click="cell.pulse(pulsed.signal)"
        >
          Pulse
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:h-11"
          aria-label="Clear the timing diagram"
          :aria-disabled="cell.trace.value.length < 2"
          @click="cell.clearTrace()"
        >
          Clear
        </Button>
      </div>
    </div>
    <p v-else class="text-xs text-muted-foreground">
      Its inputs are the rows above and the clock button. Pick another bit in the row of cells.
    </p>
    <!-- The region is always there, so a screen reader hears the message when it is filled. -->
    <p
      class="max-w-prose text-sm text-pretty"
      :class="unsettled ? 'rounded-md border border-foreground/40 px-3 py-2' : 'sr-only'"
      role="status"
    >
      {{ unsettled ? UNSETTLED : '' }}
    </p>

    <StorageTiming :chart="chart" :told="told" :press="press" />

    <LogicDiagram
      :diagram="diagram"
      :signals="signals"
      :chosen="cell.gate.value"
      :label="heading"
      :written="!free && lens.written.value"
      @choose="cell.chooseGate"
    />
  </StageSection>
</template>
