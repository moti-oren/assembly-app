<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction } from '@/core/rv32/instructions';
import { Card, CardContent } from '@/components/ui/card';
import { rv32AluLink } from '@/core/rv32AluLink';
import { rv32NumberLink } from '@/core/rv32NumberLink';
import { aluEquation } from '@/ui/rv32Explain';
import OperationLinks from './OperationLinks.vue';

const props = defineProps<{
  record: ExecutionRecord | null;
}>();

const equation = computed(() => props.record && aluEquation(props.record));
const link = computed(() => props.record && rv32AluLink(props.record));
const numbers = computed(() => props.record && rv32NumberLink(props.record));
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
          <OperationLinks v-if="link && numbers" :alu="link" :numbers="numbers" />
        </span>
        <span v-else class="ml-auto font-sans text-xs text-muted-foreground">
          The ALU was not used.
        </span>
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        Run an instruction to see how its result was computed.
      </span>
    </CardContent>
  </Card>
</template>
