<script setup lang="ts">
import { computed } from 'vue';
import type { DecoderSolution } from '@/core/logic/decoder';
import type { Faults } from '@/core/logic/fault';
import { planeView } from '@/ui/controlPlane';
import { controlLabel, inputLabel } from '@/ui/controlView';

const props = defineProps<{
  solution: DecoderSolution;
  /** The lines the learner broke. */
  faults: Faults;
  /** The bit of the word behind each input wire that comes from the word. */
  wires: Readonly<Record<string, number>>;
  /** What the grid is, for a screen reader. */
  caption: string;
  /** What a row recognises: `kind of instruction`. */
  rowHeading: string;
}>();

const view = computed(() => planeView(props.solution, props.faults));
</script>

<!--
  A decoder as the grid it is built as: every row an AND gate with what it asks of each input,
  every column on the right an OR gate with a dot on each row that feeds it.
-->
<template>
  <!-- The grid is wider than a phone: its scroller takes the keyboard, so the arrows move it. -->
  <div
    class="scroll-fade-x overflow-x-auto overscroll-x-contain rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    tabindex="0"
    role="region"
    :aria-label="caption"
  >
    <table class="control-plane">
      <caption class="sr-only">
        {{
          caption
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="control-name">{{ rowHeading }}</th>
          <th v-for="input in view.inputs" :key="input.id" scope="col" class="control-up">
            <span>{{ inputLabel(input.id, wires) }}</span>
          </th>
          <th
            v-for="(line, index) in view.lines"
            :key="line.id"
            scope="col"
            class="control-up"
            :class="{ 'control-divide': index === 0 }"
          >
            <span>{{ controlLabel(line.id) }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row" class="control-name">In now</th>
          <td v-for="input in view.inputs" :key="input.id" class="control-value">
            {{ input.value }}
          </td>
          <td
            v-for="(line, index) in view.lines"
            :key="line.id"
            :class="{ 'control-divide': index === 0 }"
          />
        </tr>
        <tr v-for="row in view.rows" :key="row.id" :data-on="row.on ? '' : undefined">
          <th scope="row" class="control-name">
            <span class="control-mark" aria-hidden="true">{{ row.on ? '▶' : '' }}</span>{{
              controlLabel(row.id)
            }}<span v-if="row.on" class="sr-only"> (on)</span>
          </th>
          <td
            v-for="(ask, index) in row.asks"
            :key="view.inputs[index].id"
            :data-met="ask.wants !== null && ask.met ? '' : undefined"
          >
            {{ ask.wants ?? '' }}
          </td>
          <td
            v-for="(feeds, index) in row.feeds"
            :key="view.lines[index].id"
            :class="{ 'control-divide': index === 0 }"
          >
            <template v-if="feeds">●<span class="sr-only">feeds</span></template>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <!-- A tall table leaves its headings far above: they are said again over its outputs. -->
        <tr aria-hidden="true">
          <th class="control-name" />
          <th v-for="input in view.inputs" :key="input.id" class="control-up">
            <span>{{ inputLabel(input.id, wires) }}</span>
          </th>
          <th
            v-for="(line, index) in view.lines"
            :key="line.id"
            class="control-up"
            :class="{ 'control-divide': index === 0 }"
          >
            <span>{{ controlLabel(line.id) }}</span>
          </th>
        </tr>
        <tr>
          <th scope="row" class="control-name">Out</th>
          <td v-for="input in view.inputs" :key="input.id" />
          <td
            v-for="(line, index) in view.lines"
            :key="line.id"
            class="control-value"
            :class="{ 'control-divide': index === 0 }"
            :data-stuck="line.stuck ? '' : undefined"
          >
            {{ line.value }}<span v-if="line.stuck" class="sr-only"> (stuck)</span>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
