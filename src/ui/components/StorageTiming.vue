<script setup lang="ts">
import { computed } from 'vue';
import { pressText, timingChart, traceTexts, type Sample } from '@/ui/storageTiming';
import type { FreeCellId } from '@/ui/storageView';

const props = defineProps<{
  /** The cell worked by hand, or null while there is none: the diagram is then left out. */
  cell: FreeCellId | null;
  /** The cell after each change made by hand, the newest last. */
  trace: readonly Sample[];
  /** How many of those the last press added. */
  steps: number;
}>();

const chart = computed(() => (props.cell ? timingChart(props.cell, props.trace) : null));
const told = computed(() => (props.cell ? traceTexts(props.cell, props.trace) : []));
const press = computed(() => (props.cell ? pressText(props.cell, props.trace, props.steps) : ''));
</script>

<!-- A cell's wires through time: a wave per wire, and a step for every change made by hand. -->
<template>
  <div>
    <div v-if="chart" class="mt-3" role="group" aria-label="Timing diagram">
      <!-- The drawing is told in the list after it, a step at a time. -->
      <svg
        class="h-auto w-full max-w-xl"
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        aria-hidden="true"
      >
        <line
          v-for="x in chart.edges"
          :key="x"
          class="stroke-muted-foreground"
          :x1="x"
          :x2="x"
          y1="0"
          :y2="chart.height"
          stroke-width="1"
          stroke-dasharray="2 3"
        />
        <g v-for="row in chart.rows" :key="row.label">
          <text
            class="fill-muted-foreground text-xs font-medium"
            :x="chart.labelX"
            :y="row.y"
            text-anchor="end"
            dominant-baseline="central"
          >
            {{ row.label }}
          </text>
          <path
            class="fill-none stroke-foreground"
            :d="row.path"
            stroke-width="1.5"
            stroke-linejoin="round"
          />
          <path
            class="fill-none stroke-muted-foreground"
            :d="row.unknown"
            stroke-width="1.5"
            stroke-dasharray="3 3"
          />
          <text
            class="fill-foreground font-mono text-xs tabular-nums"
            :x="chart.valueX"
            :y="row.y"
            dominant-baseline="central"
          >
            {{ row.value }}
          </text>
        </g>
      </svg>
      <ol v-if="told.length > 0" class="sr-only" aria-label="Every step so far">
        <li v-for="(text, index) in told" :key="index">{{ text }}</li>
      </ol>
    </div>
    <!-- The region is there before any cell is, so a screen reader hears the first step too. -->
    <p
      class="max-w-prose text-sm text-pretty text-muted-foreground"
      :class="{ 'mt-1 min-h-5': chart }"
      aria-live="polite"
    >
      {{ press }}
    </p>
  </div>
</template>
