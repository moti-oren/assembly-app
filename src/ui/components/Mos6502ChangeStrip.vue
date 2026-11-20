<script setup lang="ts">
import { computed } from 'vue';
import { formatHex } from '@/core/shared/numbers';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { FLAG_NAMES, flagBit, REGISTER_NAMES, type CpuState } from '@/core/mos6502/state';
import ResultStrip from './ResultStrip.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction; null before the first one. */
  record: ExecutionRecord | null;
}>();

/** Everything the last instruction changed, as short `name value` pairs. */
const changes = computed(() => {
  const record = props.record;
  if (!record) return [];
  const list = REGISTER_NAMES.filter(
    (name) => name !== 'pc' && record.before.registers[name] !== props.state.registers[name]
  ).map((name) => ({ name: name.toUpperCase(), value: formatHex(props.state.registers[name], 8) }));
  for (const flag of FLAG_NAMES) {
    if ((record.before.flags ^ props.state.flags) & flagBit(flag)) {
      list.push({ name: flag, value: props.state.flags & flagBit(flag) ? '1' : '0' });
    }
  }
  if (record.access?.write) {
    list.push({
      name: `$${formatHex(record.access.address, 16)}`,
      value: formatHex(record.access.value, 8)
    });
  }
  return list;
});
</script>

<template>
  <ResultStrip :ran="record ? formatInstruction(record.instruction) : null" :changes="changes" />
</template>
