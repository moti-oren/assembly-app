<script setup lang="ts">
import { computed } from 'vue';
import { formatBits, formatBytes, formatHex } from '@/core/shared/numbers';
import type { AssembledLine } from '@/core/mos6502/encode';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EncodingShown } from '@/ui/encodingShown';
import { useLocale } from '@/ui/useLocale';
import { whereText } from '@/ui/encodingShown';

const { t } = useLocale();

const props = defineProps<{
  /** The instruction on show with its machine code, or null when there is nothing to encode. */
  shown: EncodingShown<Instruction, AssembledLine> | null;
}>();

const summary = computed(() => {
  if (!props.shown) return null;
  const { address, encoding } = props.shown.assembled;
  return t.value.mos6502Explain.encodingSummary(
    t.value.common.bytes(encoding.bytes.length),
    `$${formatHex(address, 16)}`,
    whereText(t.value, props.shown.where),
    encoding.cycles
  );
});
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">{{ t.encoding.title }}</CardTitle>
      <CardDescription v-if="shown">
        <span class="font-mono text-foreground">{{ formatInstruction(shown.instruction) }}</span>
        · {{ summary }}
      </CardDescription>
      <CardDescription v-else>
        {{ t.mos6502.encodingEmpty }}
      </CardDescription>
    </CardHeader>

    <CardContent v-if="shown" class="flex flex-col gap-2">
      <!-- One box per field, in the order the bytes sit in memory. -->
      <ol class="flex flex-wrap items-stretch gap-2" :aria-label="t.encoding.fields">
        <li
          v-for="(field, index) in shown.assembled.encoding.fields"
          :key="index"
          class="max-w-full min-w-0 rounded-md border bg-inset px-2.5 py-1.5 sm:max-w-72"
        >
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-sm font-semibold">{{ formatBytes(field.bytes) }}</span>
            <span class="text-2xs font-medium tracking-wide text-pointer uppercase">{{
              t.mos6502.fields[field.kind]
            }}</span>
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
