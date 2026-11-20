<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction } from '@/core/rv32/instructions';
import type { CpuState } from '@/core/rv32/state';
import { rv32StepDiff } from '@/ui/architectureDiffs';
import ResultStrip from './ResultStrip.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction; null before the first one. */
  record: ExecutionRecord | null;
}>();

/** Everything the last instruction wrote or moved, as `before → after`. */
const changes = computed(() => (props.record ? rv32StepDiff(props.record, props.state) : []));
</script>

<template>
  <ResultStrip :ran="record ? formatInstruction(record.instruction) : null" :changes="changes" />
</template>
