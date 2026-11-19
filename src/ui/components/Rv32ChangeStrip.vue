<script setup lang="ts">
import { computed } from 'vue';
import { formatHex32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction } from '@/core/rv32/instructions';
import { REGISTER_KEYS } from '@/core/rv32/registers';
import { formatRegister } from '@/core/rv32/operands';
import type { CpuState } from '@/core/rv32/state';

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
  <!-- On a narrow screen the CPU panels scroll away; this keeps the last result in sight. -->
  <div
    class="sticky top-0 z-(--z-strip) flex h-8.25 items-center gap-2 overflow-x-auto border-b bg-card px-4 py-1.5 font-mono text-xs leading-4 whitespace-nowrap"
    aria-live="polite"
  >
    <span v-if="!record" class="font-sans text-muted-foreground">
      Run an instruction to see what it changes
    </span>
    <span v-else class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
    <span
      v-for="change in changes"
      :key="change.name"
      class="rounded-sm bg-changed px-1.5 py-0.5 text-changed-foreground"
    >
      {{ change.name }} <span class="font-semibold">{{ change.value }}</span>
    </span>
    <span v-if="record && changes.length === 0" class="font-sans text-muted-foreground">
      changed nothing
    </span>
  </div>
</template>
