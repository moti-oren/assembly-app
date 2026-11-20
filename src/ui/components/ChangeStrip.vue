<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/x86/execute';
import { FLAG_NAMES, isFlagSet } from '@/core/x86/flags';
import { formatInstruction } from '@/core/x86/instructions';
import { formatHex } from '@/core/shared/numbers';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';
import { describeMemoryAccess } from '@/ui/describe';
import ResultStrip from './ResultStrip.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction; null before the first one. */
  record: ExecutionRecord | null;
}>();

/** Everything the last instruction changed, as short `name value` pairs. */
const changes = computed(() => {
  if (!props.record) return [];
  const { before } = props.record;
  const list: { name: string; value: string }[] = [];
  for (const name of changedRegisters(before.registers, props.state.registers)) {
    list.push({ name: name.toUpperCase(), value: formatHex(props.state.registers[name], 16) });
  }
  for (const flag of FLAG_NAMES) {
    if (isFlagSet(before.flags ^ props.state.flags, flag)) {
      list.push({ name: flag, value: isFlagSet(props.state.flags, flag) ? '1' : '0' });
    }
  }
  const memory = describeMemoryAccess(props.state, props.record);
  if (memory?.write) {
    list.push({ name: memory.address, value: memory.value });
  }
  return list;
});
</script>

<template>
  <ResultStrip :ran="record ? formatInstruction(record.instruction) : null" :changes="changes" />
</template>
