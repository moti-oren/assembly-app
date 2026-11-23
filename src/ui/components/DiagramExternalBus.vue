<script setup lang="ts">
import type { CpuDiagramModel } from '@/ui/useCpuDiagram';
import DiagramWire from './DiagramWire.vue';

defineProps<{ model: CpuDiagramModel }>();
</script>

<template>
  <!-- The bus leaves the chip: its line spans the units inside, and under it is what it reaches. -->
  <div class="mt-4 flex items-end justify-between gap-3 px-4 max-sm:pb-3 sm:mt-0">
    <p class="truncate pb-1.5 text-xs text-muted-foreground">
      <span class="unit-title">Address / data bus</span>
      <span v-if="model.bus" class="ml-2 font-mono">{{ model.bus }}</span>
    </p>
    <!--
      Straight down from the adder to the bus line. The adder's centre is half the BIU's width
      less its 1.25rem wire, from the same padding this row has; the wire is 2px wide.
    -->
    <DiagramWire
      vertical
      class="mr-[calc((var(--biu-width)_-_1.25rem)/2_-_2px)] hidden h-10 shrink-0 sm:block"
      :kind="model.busKind"
      :tick="model.pulse"
    />
  </div>
  <DiagramWire class="mx-4 hidden sm:block" :kind="model.busKind" :tick="model.pulse" />
  <!--
    Two equal columns at every width; on a phone each unit sets its note under its name. Each
    hangs from the bus near its left edge, clear of the wire that comes down from the adder.
  -->
  <div
    class="chip-outside grid grid-cols-2 gap-x-2 gap-y-2 rounded-b-lg px-4 pb-4 max-sm:border-t max-sm:pt-3 sm:gap-x-3"
  >
    <div class="flex min-w-0 flex-col items-start">
      <DiagramWire
        vertical
        class="ml-6 hidden h-3 sm:block"
        :kind="model.memoryKind"
        :tick="model.pulse"
      />
      <div
        class="flex w-full min-w-0 items-baseline justify-between gap-3 chip-block rounded-lg border px-3 py-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-1 max-sm:px-2.5 max-sm:py-2"
        :class="{ 'unit-idle': !model.memoryKind }"
      >
        <h3 class="unit-title mb-0">Memory</h3>
        <span v-if="model.memory" class="max-w-full truncate font-mono text-code">
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
    <div class="flex min-w-0 flex-col items-start">
      <DiagramWire
        vertical
        class="ml-6 hidden h-3 sm:block"
        :kind="model.portKind"
        :tick="model.pulse"
      />
      <div
        class="flex w-full min-w-0 items-baseline justify-between gap-3 chip-block rounded-lg border px-3 py-2.5 max-sm:flex-col max-sm:items-start max-sm:gap-1 max-sm:px-2.5 max-sm:py-2"
        :class="{ 'unit-idle': !model.portKind }"
      >
        <h3 class="unit-title mb-0">I/O ports</h3>
        <span v-if="model.port" class="max-w-full truncate font-mono text-code">
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
