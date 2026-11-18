<script setup lang="ts">
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import DiagramWire from './DiagramWire.vue';

defineProps<{ model: CpuDiagramModel }>();
</script>

<template>
  <!-- Outside the package: one bus, shared by the memory and the I/O ports. -->
  <div class="mt-3 flex items-end justify-between gap-3 sm:mt-0">
    <p class="truncate pb-1 text-xs text-muted-foreground">
      <span class="font-medium text-foreground">Address / data bus</span>
      <span v-if="model.bus" class="ml-2 font-mono">{{ model.bus }}</span>
    </p>
    <!--
            Starts at the adder, so it crosses the edge of the package like a pin. The adder's
            centre is half the BIU's width less its 1.25rem wire, plus the package's padding and
            border (0.6875rem) on the right.
          -->
    <DiagramWire
      class="-mt-2.75 mr-[calc((var(--biu-width)_-_1.25rem)/2_+_0.6875rem)] hidden h-9 w-0.5 shrink-0 sm:block"
      :kind="model.busKind"
      :tick="model.pulse"
    />
  </div>
  <DiagramWire class="hidden sm:block" :kind="model.busKind" :tick="model.pulse" />
  <div class="mt-2 grid gap-x-3 gap-y-2 sm:mt-0 sm:grid-cols-2">
    <div class="flex min-w-0 flex-col items-center">
      <DiagramWire class="hidden h-3 w-0.5 sm:block" :kind="model.memoryKind" :tick="model.pulse" />
      <div
        class="flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
      >
        <span class="text-sm font-medium">Memory</span>
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
      <DiagramWire class="hidden h-3 w-0.5 sm:block" :kind="model.portKind" :tick="model.pulse" />
      <div
        class="flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
      >
        <span class="text-sm font-medium">I/O ports</span>
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
