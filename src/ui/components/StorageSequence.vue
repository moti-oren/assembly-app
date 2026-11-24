<script setup lang="ts">
import { computed } from 'vue';
import { RotateCcw, Workflow } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  SEQUENCE_INPUT,
  SEQUENCE_LESSONS,
  SEQUENCE_WIDTH,
  sequenceChart,
  sequencePress,
  sequenceRows,
  SEQUENCES,
  sequenceTold,
  valueText
} from '@/ui/storageSequence';
import type { StorageSequence } from '@/ui/useStorageSequence';
import LogicBitNumbers from './LogicBitNumbers.vue';
import LogicRow from './LogicRow.vue';
import StorageTiming from './StorageTiming.vue';

const props = defineProps<{ sequence: StorageSequence }>();
defineEmits<{
  /** Open the topic that shows the program counter. */
  control: [];
}>();

const kind = computed(() => props.sequence.kind.value);
const input = computed(() => SEQUENCE_INPUT[kind.value]);
const signals = computed(() => props.sequence.signals.value);
const trace = computed(() => props.sequence.trace.value);
const rows = computed(() => sequenceRows(kind.value, signals.value));
const chart = computed(() => sequenceChart(kind.value, trace.value));
const told = computed(() => sequenceTold(kind.value, trace.value));
const press = computed(() =>
  sequencePress(
    kind.value,
    trace.value,
    props.sequence.pressSteps.value,
    props.sequence.ticks.value
  )
);
</script>

<!--
  Flip-flops whose inputs come from one another's outputs, worked by hand: a shift register and
  a counter, with what each flip-flop will take in at the next tick above what it holds.
-->
<template>
  <section aria-label="Flip-flops that feed one another">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 class="text-base font-semibold tracking-tight">Flip-flops that feed one another</h2>
      <div class="toggle-group" role="group" aria-label="Circuit">
        <Button
          v-for="choice in SEQUENCES"
          :key="choice.id"
          variant="ghost"
          size="sm"
          class="h-7 px-2.5 text-xs pointer-coarse:h-11"
          :aria-pressed="kind === choice.id"
          @click="sequence.pick(choice.id)"
        >
          {{ choice.label }}
        </Button>
      </div>
    </div>
    <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
      {{ SEQUENCE_LESSONS[kind] }}
    </p>

    <div
      class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 [--cell-height:2.25rem] [--cell:2.25rem] pointer-coarse:[--cell-height:2.75rem] pointer-coarse:[--cell:2.75rem]"
      role="group"
      aria-label="The circuit’s inputs"
    >
      <span class="flex items-center gap-2 text-xs font-medium">
        {{ input.label }}
        <button
          type="button"
          class="logic-bit"
          :data-on="sequence.inputs.value[input.signal] ? '' : undefined"
          :aria-pressed="sequence.inputs.value[input.signal] === 1"
          :aria-label="input.label"
          @click="sequence.flipInput()"
        >
          {{ sequence.inputs.value[input.signal] }}
        </button>
      </span>
      <div class="flex gap-2 max-md:w-full">
        <Button
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          aria-label="Pulse the clock: raise it and lower it"
          @click="sequence.pulse()"
        >
          Pulse the clock
        </Button>
        <Button
          variant="ghost"
          size="sm"
          class="aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:h-11"
          :aria-disabled="trace.length < 2"
          @click="sequence.reset()"
        >
          <RotateCcw />
          Start over
        </Button>
      </div>
    </div>

    <div class="logic-rows mt-2">
      <LogicBitNumbers :width="SEQUENCE_WIDTH" />
      <LogicRow
        v-for="row in rows"
        :key="row.label"
        :label="row.label"
        :name="row.name"
        :tone="row.tone"
        :bits="row.bits"
      />
    </div>
    <p class="mt-1 font-mono text-sm font-semibold tabular-nums">{{ valueText(signals) }}</p>

    <StorageTiming :chart="chart" :told="told" :press="press" />

    <Button
      v-if="kind === 'counter'"
      variant="outline"
      size="sm"
      class="mt-3 pointer-coarse:h-11"
      @click="$emit('control')"
    >
      <Workflow />
      The counter every CPU has: PC
    </Button>
  </section>
</template>
