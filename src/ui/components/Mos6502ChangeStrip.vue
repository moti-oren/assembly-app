<script setup lang="ts">
import { computed } from 'vue';
import { formatHex } from '@/core/shared/numbers';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { FLAG_NAMES, flagBit, REGISTER_NAMES, type CpuState } from '@/core/mos6502/state';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

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
  <!-- On a narrow screen the CPU panels scroll away; this keeps the last result in sight. -->
  <div
    class="sticky top-0 z-(--z-strip) flex h-8.25 items-center gap-2 overflow-x-auto border-b bg-background/85 px-4 py-1.5 font-mono text-xs leading-4 whitespace-nowrap backdrop-blur-sm"
    aria-live="polite"
  >
    <span v-if="!record" class="font-sans text-muted-foreground">
      {{ t.changes.none }}
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
      {{ t.changes.nothing }}
    </span>
  </div>
</template>
