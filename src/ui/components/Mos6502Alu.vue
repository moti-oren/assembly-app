<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { Card, CardContent } from '@/components/ui/card';
import { aluEquation, equationText } from '@/ui/mos6502Alu';
import { cyclesBreakdown } from '@/ui/mos6502Explain';
import { useLocale } from '@/ui/useLocale';

const props = defineProps<{
  record: ExecutionRecord | null;
}>();

const equation = computed(() => props.record && aluEquation(props.record));
const text = computed(() => equation.value && equationText(equation.value));
const { t } = useLocale();
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-code">
      <template v-if="record">
        <span class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
        <span v-if="equation" class="ml-auto flex flex-wrap items-center gap-x-2">
          <span class="rounded-sm bg-changed px-1 font-semibold text-changed-foreground">{{
            text
          }}</span>
          <span class="font-sans text-xs text-muted-foreground">
            {{ equation.destination }}{{ equation.note ? ` (${equation.note})` : '' }}
          </span>
        </span>
        <span v-else class="ml-auto font-sans text-xs text-muted-foreground">
          {{ t.operation.aluUnused }}
        </span>
        <span class="w-full text-right font-sans text-xs text-muted-foreground">
          {{ cyclesBreakdown(record) }}
        </span>
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        {{ t.operation.none }}
      </span>
    </CardContent>
  </Card>
</template>
