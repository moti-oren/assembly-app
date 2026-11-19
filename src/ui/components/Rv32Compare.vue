<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import type { CpuState } from '@/core/rv32/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { aluEquation, describeComparison } from '@/ui/rv32Explain';
import { useLocale } from '@/ui/useLocale';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  record: ExecutionRecord | null;
}>();

const comparison = computed(
  () => props.record && describeComparison(props.record, props.state, props.program)
);

/** SLT and its kin compare too, but leave the answer in a register instead of jumping. */
const setLessThan = computed(() => {
  const operation = props.record?.alu?.operation;
  const isCompare = operation === 'slt' || operation === 'sltu';
  return isCompare && props.record?.instruction.mnemonic.startsWith('slt')
    ? aluEquation(props.record)
    : null;
});
const { t } = useLocale();
</script>

<!-- Where the 8086 has its flags: RISC-V has none, so this explains what it does instead. -->
<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">{{ t.rv32.noFlags }}</CardTitle>
      <CardDescription class="ui-text">
        {{ t.rv32.noFlagsBefore }} (<span class="font-mono">beq</span>,
        <span class="font-mono">blt</span>, <span class="font-mono">bltu</span>…){{
          t.rv32.noFlagsMiddle
        }}
        <span class="font-mono">slt</span> {{ t.rv32.noFlagsAfter }}
      </CardDescription>
    </CardHeader>
    <CardContent class="font-mono text-code">
      <div v-if="comparison" class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span class="font-semibold">{{ formatInstruction(record!.instruction) }}</span>
        <span class="ml-auto">{{ comparison.left }}</span>
        <span class="text-muted-foreground">{{ comparison.operator }}</span>
        <span>{{ comparison.right }}</span>
        <span class="text-muted-foreground">?</span>
        <span
          class="rounded-sm px-1 font-semibold"
          :class="comparison.taken ? 'bg-changed text-changed-foreground' : 'bg-muted'"
          >{{ comparison.outcome }}</span
        >
        <span class="w-full text-right font-sans text-xs text-muted-foreground">
          {{ t.rv32.compared(comparison.how) }}
        </span>
      </div>
      <div v-else-if="setLessThan" class="flex flex-wrap items-baseline gap-x-2">
        <span class="font-semibold">{{ formatInstruction(record!.instruction) }}</span>
        <span class="ml-auto">{{ setLessThan.left }}</span>
        <span class="text-muted-foreground">&lt;</span>
        <span>{{ setLessThan.right }}</span>
        <span class="text-muted-foreground">?</span>
        <span class="rounded-sm bg-changed px-1 font-semibold text-changed-foreground">{{
          setLessThan.result
        }}</span>
        <span class="font-sans text-xs text-muted-foreground">
          {{ setLessThan.destination }} ({{ setLessThan.note }})
        </span>
      </div>
      <p v-else class="font-sans text-xs text-muted-foreground">
        {{ record ? t.rv32.comparedNothing : t.rv32.runBranch }}
      </p>
    </CardContent>
  </Card>
</template>
