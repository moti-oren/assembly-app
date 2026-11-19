<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { Card, CardContent } from '@/components/ui/card';
import { aluEquation, equationText } from '@/ui/mos6502Alu';
import { cyclesBreakdown } from '@/ui/mos6502Explain';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  record: ExecutionRecord | null;
}>();

const equation = computed(() => props.record && aluEquation(t.value, props.record));
const text = computed(() => equation.value && equationText(t.value, equation.value));
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-code">
      <template v-if="record">
        <span class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
        <span v-if="equation" class="ms-auto">
          <!-- An equation reads left to right in every language. -->
          <span dir="ltr" class="flex flex-wrap items-center gap-x-2">
            <span class="rounded-sm bg-changed px-1 font-semibold text-changed-foreground">{{
              text
            }}</span>
            <span class="ui-auto font-sans text-xs text-muted-foreground">
              {{ equation.destination }}{{ equation.note ? ` (${equation.note})` : '' }}
            </span>
          </span>
        </span>
        <span v-else class="ms-auto font-sans text-xs text-muted-foreground">
          {{ t.operation.aluUnused }}
        </span>
        <span class="w-full text-end font-sans text-xs text-muted-foreground">
          {{ cyclesBreakdown(t, record) }}
        </span>
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        {{ t.operation.none }}
      </span>
    </CardContent>
  </Card>
</template>
