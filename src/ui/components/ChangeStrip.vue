<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/execute';
import { FLAG_BITS, FLAG_NAMES } from '@/core/flags';
import { formatInstruction } from '@/core/instructions';
import { formatHex } from '@/core/numbers';
import { WORD_REGISTERS } from '@/core/registers';
import type { CpuState } from '@/core/state';
import { describeMemoryAccess } from '@/ui/describe';

const props = defineProps<{
  state: CpuState;
  record: ExecutionRecord;
}>();

/** Everything the last instruction changed, as short `name value` pairs. */
const changes = computed(() => {
  const { before } = props.record;
  const list: { name: string; value: string }[] = [];
  for (const name of WORD_REGISTERS) {
    if (before.registers[name] !== props.state.registers[name]) {
      list.push({ name: name.toUpperCase(), value: formatHex(props.state.registers[name], 16) });
    }
  }
  for (const flag of FLAG_NAMES) {
    const bit = 1 << FLAG_BITS[flag];
    if ((before.flags ^ props.state.flags) & bit) {
      list.push({ name: flag, value: props.state.flags & bit ? '1' : '0' });
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
  <!-- On a narrow screen the CPU panels scroll away; this keeps the last result in sight. -->
  <div
    class="sticky top-14 z-10 flex items-center gap-2 overflow-x-auto border-b bg-background/85 px-4 py-1.5 font-mono text-xs whitespace-nowrap backdrop-blur-sm"
    aria-live="polite"
  >
    <span class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
    <span
      v-for="change in changes"
      :key="change.name"
      class="rounded-sm bg-changed px-1.5 py-0.5 text-changed-foreground"
    >
      {{ change.name }} <span class="font-semibold">{{ change.value }}</span>
    </span>
    <span v-if="changes.length === 0" class="font-sans text-muted-foreground">
      changed nothing
    </span>
  </div>
</template>
