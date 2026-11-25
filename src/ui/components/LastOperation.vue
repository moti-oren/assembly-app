<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import { Card, CardContent } from '@/components/ui/card';
import { x86AluLink } from '@/core/x86AluLink';
import { x86NumberLink } from '@/core/x86NumberLink';
import { describeEquation } from '@/ui/describe';
import OperationLinks from './OperationLinks.vue';

const props = defineProps<{
  state: CpuState;
  record: ExecutionRecord | null;
}>();

const equation = computed(() => props.record && describeEquation(props.state, props.record));
const link = computed(() => props.record && x86AluLink(props.record));
const numbers = computed(() => props.record && x86NumberLink(props.record));
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
          <span class="font-sans text-xs text-muted-foreground">
            {{ equation.discarded ? 'only the flags are kept' : `into ${equation.destination}` }}
          </span>
          <OperationLinks v-if="link && numbers" :alu="link" :numbers="numbers" />
        </span>
        <!-- Without a sum to write out, the ways into the other topics stay: each says why. -->
        <OperationLinks
          v-else-if="link && numbers"
          class="ml-auto"
          :alu="link"
          :numbers="numbers"
        />
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        Run an instruction to see how its result was computed.
      </span>
    </CardContent>
  </Card>
</template>
