<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import { x86StepDiff } from '@/ui/architectureDiffs';
import ResultStrip from './ResultStrip.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction; null before the first one. */
  record: ExecutionRecord | null;
}>();

/** Everything the last instruction wrote or moved, as `before → after`. */
const changes = computed(() => (props.record ? x86StepDiff(props.record, props.state) : []));
</script>

<template>
  <ResultStrip :ran="record ? formatInstruction(record.instruction) : null" :changes="changes" />
</template>
