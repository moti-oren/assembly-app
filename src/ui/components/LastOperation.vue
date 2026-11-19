<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import { Card, CardContent } from '@/components/ui/card';
import { describeEquation } from '@/ui/describe';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  state: CpuState;
  record: ExecutionRecord | null;
}>();

const equation = computed(() => props.record && describeEquation(props.state, props.record));
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-code">
      <template v-if="record">
        <span class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
        <span v-if="equation" class="ms-auto">
          <!-- An equation reads left to right in every language. -->
          <span dir="ltr" class="flex flex-wrap items-center gap-x-2">
            <span>{{ equation.left }}</span>
            <span class="text-muted-foreground">{{ equation.operator }}</span>
            <span>{{ equation.right }}</span>
            <template v-if="equation.carry !== null">
              <span class="text-muted-foreground">{{ equation.operator }}</span>
              <span>{{ equation.carry }}</span>
              <span class="font-sans text-xs text-muted-foreground">(CF)</span>
            </template>
            <span class="text-muted-foreground">=</span>
            <span
              class="rounded-sm px-1 font-semibold"
              :class="
                equation.discarded
                  ? 'text-muted-foreground line-through decoration-1'
                  : 'bg-changed text-changed-foreground'
              "
              >{{ equation.result }}</span
            >
            <span class="ui-auto font-sans text-xs text-muted-foreground">
              {{
                equation.discarded ? t.operation.flagsOnly : t.operation.into(equation.destination)
              }}
            </span>
          </span>
        </span>
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        {{ t.operation.none }}
      </span>
    </CardContent>
  </Card>
</template>
