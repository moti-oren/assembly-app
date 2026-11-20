<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import type { CpuState } from '@/core/mos6502/state';
import { mos6502StepDiff } from '@/ui/architectureDiffs';
import ResultStrip from './ResultStrip.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction; null before the first one. */
  record: ExecutionRecord | null;
}>();

/** Everything the last instruction wrote or moved, as `before → after`. */
const changes = computed(() => (props.record ? mos6502StepDiff(props.record, props.state) : []));
</script>

<template>
  <ResultStrip :ran="record ? formatInstruction(record.instruction) : null" :changes="changes" />
</template>
