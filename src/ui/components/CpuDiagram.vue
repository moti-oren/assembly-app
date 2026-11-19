<script setup lang="ts">
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCpuDiagram } from '@/ui/useCpuDiagram';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import CpuViewToggle from './CpuViewToggle.vue';
import DiagramBusUnit from './DiagramBusUnit.vue';
import DiagramExecutionUnit from './DiagramExecutionUnit.vue';
import DiagramExternalBus from './DiagramExternalBus.vue';
import DiagramWire from './DiagramWire.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: it decides which wires light up. */
  record: ExecutionRecord | null;
  /** A program line being stepped by phase: until it executes, the wires show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far; replays the flashes and the wire pulses. */
  tick: number;
}>();

/** The CPU as two units and the buses between them; the parts below draw it. */
const model = useCpuDiagram(props);
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">CPU</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-pointer" aria-hidden="true" />
          read
        </span>
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-written" aria-hidden="true" />
          written
        </span>
        <CpuViewToggle />
      </CardAction>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <!-- The BIU's width, set on the children so the container query can switch it. -->
      <div class="@container *:[--biu-width:15rem] @min-[40rem]:*:[--biu-width:18.5rem]">
        <!-- The package: the two units of an 8086 and the internal bus that joins them. -->
        <div
          class="grid gap-y-5 rounded-xl border border-foreground/20 bg-inset p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <DiagramExecutionUnit :model="model" :tick="tick" />

          <DiagramWire
            class="hidden h-auto w-0.5 sm:block"
            :kind="model.internalKind"
            :tick="model.pulse"
            title="Internal bus"
          />

          <!-- As wide as its register rows, with or without their bits; the adder's notes wrap. -->
          <DiagramBusUnit :model="model" :tick="tick" />
        </div>

        <!-- Outside the package: one bus, shared by the memory and the I/O ports. -->
        <DiagramExternalBus :model="model" />
      </div>
    </CardContent>
  </Card>
</template>
