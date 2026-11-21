<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { mos6502StepDiff } from '@/ui/architectureDiffs';
import ResultStrip from './ResultStrip.vue';

const props = defineProps<{
  /** The last executed instruction; null before the first one. */
  record: ExecutionRecord | null;
  /** The CPU as that instruction left it. */
  after: ExecutionRecord['before'] | null;
  /** True while the program runs on a timer: the strip stops announcing each step. */
  running: boolean;
}>();

/** Everything the last instruction wrote or moved, as `before → after`. */
const diff = computed(() =>
  props.record && props.after ? mos6502StepDiff(props.record, props.after) : null
);
</script>

<template>
  <ResultStrip
    :ran="record ? formatInstruction(record.instruction) : null"
    :changes="diff?.entries ?? []"
    :omitted="diff?.omitted ?? 0"
    :running="running"
  />
</template>
