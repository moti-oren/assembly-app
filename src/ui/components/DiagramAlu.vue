<script setup lang="ts">
import { formatInstruction } from '@/core/x86/instructions';
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import DiagramWire from './DiagramWire.vue';

defineProps<{ model: CpuDiagramModel }>();
</script>

<template>
  <div class="mt-3 flex items-stretch">
    <!-- A fixed height, sized for the longest sum, so nothing below moves as the text changes. -->
    <div
      class="h-36 min-w-0 flex-1 chip-block rounded-lg border px-3 py-2.5 transition-opacity duration-300"
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
        class="mt-2 grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 font-mono text-code"
      >
        <span />
        <span class="text-right">{{ model.equation.left }}</span>
        <span />
        <span class="text-muted-foreground">{{ model.equation.operator }}</span>
        <span class="text-right">{{ model.equation.right }}</span>
        <span />
        <template v-if="model.equation.carry !== null">
          <span class="text-muted-foreground">{{ model.equation.operator }}</span>
          <span class="text-right">{{ model.equation.carry }}</span>
          <span class="font-sans text-xs text-muted-foreground">CF</span>
        </template>
        <span class="col-span-2 my-0.5 border-t border-foreground/25" />
        <span />
        <span class="text-muted-foreground">=</span>
        <span
          class="-mx-1 rounded-sm px-1 text-right font-semibold"
          :class="
            model.equation.discarded
              ? 'text-muted-foreground line-through decoration-1'
              : 'bg-changed text-changed-foreground'
          "
          >{{ model.equation.result }}</span
        >
        <span class="truncate font-sans text-xs text-muted-foreground">
          {{
            model.equation.discarded
              ? 'only the flags are kept'
              : `into ${model.equation.destination}`
          }}
        </span>
      </div>
      <p v-else class="mt-2 text-xs text-muted-foreground">{{ model.notes.alu }}</p>
    </div>
    <!-- Operands come in off the bus; the result goes back onto it. -->
    <div class="hidden w-5 flex-col justify-center gap-4 sm:flex" aria-hidden="true">
      <DiagramWire :kind="model.alu.input ? 'read' : undefined" :tick="model.pulse" />
      <DiagramWire :kind="model.alu.output ? 'write' : undefined" :tick="model.pulse" />
    </div>
  </div>
</template>
