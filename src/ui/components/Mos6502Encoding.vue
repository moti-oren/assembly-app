<script setup lang="ts">
import { computed } from 'vue';
import { formatBits, formatBytes, formatHex } from '@/core/shared/numbers';
import type { AssembledLine, FieldKind } from '@/core/mos6502/encode';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EncodingShown } from '@/ui/encodingShown';

const props = defineProps<{
  /** The instruction on show with its machine code, or null when there is nothing to encode. */
  shown: EncodingShown<Instruction, AssembledLine> | null;
}>();

const KIND_LABELS: Record<FieldKind, string> = {
  opcode: 'Opcode',
  value: 'Immediate',
  address: 'Address',
  low: 'Low byte',
  high: 'High byte',
  offset: 'Distance',
  signature: 'Signature'
};

const summary = computed(() => {
  if (!props.shown) return null;
  const { address, encoding } = props.shown.assembled;
  const count = `${encoding.bytes.length} byte${encoding.bytes.length === 1 ? '' : 's'}`;
  return `${count} at $${formatHex(address, 16)}, ${props.shown.where} · cycles: ${encoding.cycles}`;
});
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">Machine code</CardTitle>
      <CardDescription v-if="shown">
        <span class="font-mono text-foreground">{{ formatInstruction(shown.instruction) }}</span>
        · {{ summary }}
      </CardDescription>
      <CardDescription v-else>
        Build an instruction or add one to the program to see the bytes it becomes.
      </CardDescription>
    </CardHeader>

    <CardContent v-if="shown" class="flex flex-col gap-2">
      <!-- One box per field, in the order the bytes sit in memory. -->
      <ol class="flex flex-wrap items-stretch gap-2" aria-label="The fields of the instruction">
        <li
          v-for="(field, index) in shown.assembled.encoding.fields"
          :key="index"
          class="well max-w-full min-w-0 rounded-md px-2.5 py-2 sm:max-w-72"
        >
          <div class="flex items-center gap-2">
            <span class="font-mono text-sm font-semibold">{{ formatBytes(field.bytes) }}</span>
            <span
              class="rounded-sm px-1.5 py-px text-2xs font-medium tracking-wide uppercase"
              :class="field.kind === 'opcode' ? 'bg-chart-1/25' : 'bg-chart-4/25'"
              >{{ KIND_LABELS[field.kind] }}</span
            >
          </div>
          <p v-if="field.kind === 'opcode'" class="mt-0.5 font-mono text-xs text-muted-foreground">
            {{ formatBits(field.bytes[0], 8) }}
          </p>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ field.note }}</p>
        </li>
      </ol>
      <p v-if="shown.assembled.encoding.problem" class="text-xs text-destructive" role="alert">
        {{ shown.assembled.encoding.problem }}
      </p>
    </CardContent>
  </Card>
</template>
