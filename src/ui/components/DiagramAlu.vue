<script setup lang="ts">
import { computed } from 'vue';
import { formatInstruction } from '@/core/x86/instructions';
import { x86AluLink } from '@/core/x86AluLink';
import { x86NumberLink } from '@/core/x86NumberLink';
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import DiagramWire from './DiagramWire.vue';
import OperationLinks from './OperationLinks.vue';

const props = defineProps<{ model: CpuDiagramModel }>();

const link = computed(() => props.model.shown && x86AluLink(props.model.shown));
const numbers = computed(() => props.model.shown && x86NumberLink(props.model.shown));
</script>

<template>
  <div class="mt-6 flex items-stretch short:mt-4">
    <!--
      The sum on one line, where the unit is wide enough for it. With nothing to compute the line
      holds its outline in dashes, and the reason beside it, so the unit keeps its size.
    -->
    <div
      class="chip-block min-h-16 min-w-0 flex-1 rounded-lg border px-3 py-2"
      :class="{ 'unit-idle': !model.equation && !model.alu.input && !model.alu.output }"
    >
      <div class="flex items-baseline justify-between gap-3">
        <h3 class="unit-title mb-0">ALU</h3>
        <span class="truncate font-mono text-xs text-muted-foreground">{{
          model.shown
            ? formatInstruction(model.shown.instruction)
            : model.pending
              ? model.pending.phase
              : 'idle'
        }}</span>
      </div>
      <div
        v-if="model.equation"
        class="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-code"
      >
        <span>{{ model.equation.left }}</span>
        <span class="text-muted-foreground">{{ model.equation.operator }}</span>
        <span>{{ model.equation.right }}</span>
        <template v-if="model.equation.carry !== null">
          <span class="text-muted-foreground">{{ model.equation.operator }}</span>
          <span
            >{{ model.equation.carry }}
            <span class="font-sans text-xs text-muted-foreground">CF</span></span
          >
        </template>
        <span class="text-muted-foreground">=</span>
        <span
          class="rounded-sm px-1 font-semibold"
          :class="
            model.equation.discarded
              ? 'text-muted-foreground line-through decoration-1'
              : 'bg-changed text-changed-foreground'
          "
          >{{ model.equation.result }}</span
        >
        <span class="font-sans text-xs text-muted-foreground">
          {{
            model.equation.discarded
              ? 'only the flags are kept'
              : `into ${model.equation.destination}`
          }}
        </span>
        <!-- Where the links do not fit beside the sum they take a row of their own, from its start. -->
        <OperationLinks
          v-if="link && numbers"
          class="ml-auto max-md:ml-0 max-md:w-full"
          :alu="link"
          :numbers="numbers"
        />
      </div>
      <div v-else class="mt-1.5 flex items-baseline gap-x-3 font-mono text-code">
        <span class="standby shrink-0" aria-hidden="true">---- op ---- = ----</span>
        <span
          class="min-w-0 truncate font-sans text-xs text-muted-foreground"
          :title="model.notes.alu"
          >{{ model.notes.alu }}</span
        >
        <!-- A shift or NOT has no sum to write here, and still a circuit and numbers to show. -->
        <OperationLinks
          v-if="link && numbers"
          class="ml-auto shrink-0"
          :alu="link"
          :numbers="numbers"
        />
      </div>
    </div>
    <!-- Operands come in off the bus; the result goes back onto it. -->
    <div class="hidden w-5 flex-col justify-center gap-4 sm:flex" aria-hidden="true">
      <DiagramWire :kind="model.alu.input ? 'read' : undefined" :tick="model.pulse" />
      <DiagramWire :kind="model.alu.output ? 'write' : undefined" :tick="model.pulse" />
    </div>
  </div>
</template>
