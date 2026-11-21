<script setup lang="ts">
import type { ExecutionRecord } from '@/core/x86/execute';
import type { Instruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import { Button } from '@/components/ui/button';
import { useCpuDiagram } from '@/ui/useCpuDiagram';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import { usePreferences } from '@/ui/usePreferences';
import CpuCanvas from './CpuCanvas.vue';
import DiagramBusUnit from './DiagramBusUnit.vue';
import DiagramExecutionUnit from './DiagramExecutionUnit.vue';
import DiagramExternalBus from './DiagramExternalBus.vue';
import DiagramWire from './DiagramWire.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: it decides which wires light up. */
  record: ExecutionRecord | null;
  /** The CPU as the last instruction left it: what that instruction did is told against it. */
  after: ExecutionRecord['before'] | null;
  /** A program line being stepped by phase: until it executes, the wires show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far; replays the flashes and the wire pulses. */
  tick: number;
}>();

/** The CPU as two units and the buses between them; the parts below draw it. */
const model = useCpuDiagram(props);

const { registerBits } = usePreferences();
</script>

<template>
  <CpuCanvas>
    <template #actions>
      <!-- Sixteen bits a row crowd the registers, so they are shown only when asked for. -->
      <Button
        variant="outline"
        size="xs"
        class="font-mono pointer-coarse:h-11"
        :class="registerBits ? 'border-pointer/60 bg-pointer/12 text-foreground' : ''"
        :aria-pressed="registerBits"
        aria-label="Show the registers in binary"
        title="Show the registers in binary"
        @click="registerBits = !registerBits"
      >
        BIN
      </Button>
    </template>

    <!-- The BIU's width, set on the children so the container query can switch it. -->
    <div
      class="@container"
      :class="
        registerBits
          ? '*:[--biu-width:15rem] @min-[40rem]:*:[--biu-width:18.5rem]'
          : '*:[--biu-width:14rem]'
      "
    >
      <!-- The package: the two units of an 8086 and the internal bus that joins them. -->
      <div class="chip-package grid gap-y-5 rounded-lg p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <DiagramExecutionUnit :model="model" :tick="tick" />

        <DiagramWire
          vertical
          class="hidden h-auto sm:block"
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
  </CpuCanvas>
</template>
