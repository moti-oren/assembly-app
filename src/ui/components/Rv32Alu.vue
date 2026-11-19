<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction } from '@/core/rv32/instructions';
import { Card, CardContent } from '@/components/ui/card';
import { aluEquation } from '@/ui/rv32Explain';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  record: ExecutionRecord | null;
}>();

const equation = computed(() => props.record && aluEquation(t.value, props.record));
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-code">
      <template v-if="record">
        <span class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
        <span v-if="equation" class="ml-auto flex flex-wrap items-center gap-x-2">
          <span>{{ equation.left }}</span>
          <span class="text-muted-foreground">{{ equation.operator }}</span>
          <span>{{ equation.right }}</span>
          <span class="text-muted-foreground">=</span>
          <span class="rounded-sm bg-changed px-1 font-semibold text-changed-foreground">{{
            equation.result
          }}</span>
          <span class="font-sans text-xs text-muted-foreground">
            {{ equation.destination }}{{ equation.note ? ` (${equation.note})` : '' }}
          </span>
        </span>
        <span v-else class="ml-auto font-sans text-xs text-muted-foreground">
          {{ t.operation.aluUnused }}
        </span>
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        {{ t.operation.none }}
      </span>
    </CardContent>
  </Card>
</template>
