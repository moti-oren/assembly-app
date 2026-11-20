<script setup lang="ts">
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import DiagramWire from './DiagramWire.vue';

defineProps<{ model: CpuDiagramModel }>();
</script>

<template>
  <!-- Outside the package: one bus, shared by the memory and the I/O ports. -->
  <div class="mt-3 flex items-end justify-between gap-3 sm:mt-0">
    <p class="truncate pb-1 text-xs text-muted-foreground">
      <span class="unit-title">Address / data bus</span>
      <span v-if="model.bus" class="ml-2 font-mono">{{ model.bus }}</span>
    </p>
    <!--
            Starts at the adder, so it crosses the edge of the package like a pin. The adder's
            centre is half the BIU's width less its 1.25rem wire, plus the package's padding and
            border (0.8125rem) on the right.
          -->
    <DiagramWire
      vertical
      class="-mt-3.25 mr-[calc((var(--biu-width)_-_1.25rem)/2_+_0.8125rem)] hidden h-9 shrink-0 sm:block"
      :kind="model.busKind"
      :tick="model.pulse"
    />
  </div>
  <DiagramWire class="hidden sm:block" :kind="model.busKind" :tick="model.pulse" />
  <div class="mt-2 grid gap-x-3 gap-y-2 sm:mt-0 sm:grid-cols-2">
    <div class="flex min-w-0 flex-col items-center">
      <DiagramWire
        vertical
        class="hidden h-3 sm:block"
        :kind="model.memoryKind"
        :tick="model.pulse"
      />
      <div
        class="flex w-full min-w-0 items-baseline justify-between gap-3 chip-block rounded-lg border px-3 py-2.5"
        :class="{ 'unit-idle': !model.memoryKind }"
      >
        <h3 class="unit-title mb-0">Memory</h3>
        <span v-if="model.memory" class="truncate font-mono text-code">
          <span class="font-sans text-xs text-muted-foreground">
            {{ model.memory.write ? 'wrote' : 'read' }}
          </span>
          <span
            class="mx-1.5 rounded-sm px-1 font-semibold"
            :class="model.memory.write ? 'bg-changed text-changed-foreground' : ''"
            >{{ model.memory.value }}</span
          >
          <span class="font-sans text-xs text-muted-foreground">
            {{ model.memory.write ? 'to' : 'from' }}
          </span>
          {{ model.memory.address }}
        </span>
        <span v-else class="text-xs text-muted-foreground">{{ model.notes.memory }}</span>
      </div>
    </div>
    <div class="flex min-w-0 flex-col items-center">
      <DiagramWire
        vertical
        class="hidden h-3 sm:block"
        :kind="model.portKind"
        :tick="model.pulse"
      />
      <div
        class="flex w-full min-w-0 items-baseline justify-between gap-3 chip-block rounded-lg border px-3 py-2.5"
        :class="{ 'unit-idle': !model.portKind }"
      >
        <h3 class="unit-title mb-0">I/O ports</h3>
        <span v-if="model.port" class="truncate font-mono text-code">
          <span class="font-sans text-xs text-muted-foreground">
            {{ model.port.write ? 'wrote' : 'read' }}
          </span>
          <span
            class="mx-1.5 rounded-sm px-1 font-semibold"
            :class="model.port.write ? 'bg-changed text-changed-foreground' : ''"
            >{{ model.port.value }}</span
          >
          <span class="font-sans text-xs text-muted-foreground">
            {{ model.port.write ? 'to port' : 'from port' }}
          </span>
          {{ model.port.port }}h
        </span>
        <span v-else class="text-xs text-muted-foreground">{{ model.notes.port }}</span>
      </div>
    </div>
  </div>
</template>
