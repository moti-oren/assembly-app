<script setup lang="ts">
import { computed } from 'vue';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction } from '@/core/rv32/instructions';
import { REGISTER_KEYS } from '@/core/rv32/registers';
import { formatRegister } from '@/core/rv32/operands';
import type { CpuState } from '@/core/rv32/state';
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
  const list = REGISTER_KEYS.flatMap((key, index) =>
    record.before.registers[key] !== props.state.registers[key]
      ? [{ name: formatRegister(index), value: formatHex32(props.state.registers[key]) }]
      : []
  );
  const { access } = record;
  if (access?.write) {
    list.push({
      name: formatHex32(access.address),
      value: access.value.toString(16).toUpperCase()
    });
  }
  return list;
});
</script>

<template>
  <ResultStrip :ran="record ? formatInstruction(record.instruction) : null" :changes="changes" />
</template>
