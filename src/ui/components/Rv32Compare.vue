<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import type { CpuState } from '@/core/rv32/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { rv32AluLink } from '@/core/rv32AluLink';
import { rv32NumberLink } from '@/core/rv32NumberLink';
import { aluEquation, describeComparison } from '@/ui/rv32Explain';
import OperationLinks from './OperationLinks.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  record: ExecutionRecord | null;
}>();

const comparison = computed(
  () => props.record && describeComparison(props.record, props.state, props.program)
);

const link = computed(() => props.record && rv32AluLink(props.record));
const numbers = computed(() => props.record && rv32NumberLink(props.record));

/** SLT and its kin compare too, but leave the answer in a register instead of jumping. */
const setLessThan = computed(() => {
  const operation = props.record?.alu?.operation;
  const isCompare = operation === 'slt' || operation === 'sltu';
  return isCompare && props.record?.instruction.mnemonic.startsWith('slt')
    ? aluEquation(props.record)
    : null;
});
</script>

<!-- Where the 8086 has its flags: RISC-V has none, so this explains what it does instead. -->
<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle role="heading" aria-level="2" class="group-data-[size=sm]/card:text-base"
        >No flags</CardTitle
      >
      <CardDescription>
        RISC-V keeps no flags. A branch compares two registers itself (<span class="font-mono"
          >beq</span
        >, <span class="font-mono">blt</span>, <span class="font-mono">bltu</span>…), and
        <span class="font-mono">slt</span> puts a comparison's answer, 1 or 0, in a register.
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
          :class="comparison.taken ? 'bg-foreground text-background' : 'bg-muted'"
          >{{ comparison.outcome }}</span
        >
        <span
          class="flex w-full items-center justify-end gap-2 font-sans text-xs text-muted-foreground"
        >
          compared {{ comparison.how }}
          <OperationLinks v-if="link && numbers" :alu="link" :numbers="numbers" />
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
        <OperationLinks v-if="link && numbers" :alu="link" :numbers="numbers" />
      </div>
      <p v-else class="font-sans text-xs text-muted-foreground">
        {{
          record
            ? 'The last instruction compared nothing.'
            : 'Run a branch to see what it compares.'
        }}
      </p>
    </CardContent>
  </Card>
</template>
