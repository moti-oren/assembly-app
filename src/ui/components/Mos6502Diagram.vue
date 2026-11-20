<script setup lang="ts">
import { computed } from 'vue';
import { formatBinary, formatHex } from '@/core/shared/numbers';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import type { Instruction } from '@/core/mos6502/instructions';
import {
  FLAG_NAMES,
  flagBit,
  STACK_PAGE,
  type CpuState,
  type RegisterName
} from '@/core/mos6502/state';
import { diagramView } from '@/ui/mos6502Diagram';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import ChangeMark from './ChangeMark.vue';
import CpuCanvas from './CpuCanvas.vue';
import DatapathStage from './DatapathStage.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  /** The last executed instruction: it decides which parts light up. */
  record: ExecutionRecord | null;
  /** A program line being stepped by phase: until it executes, the parts show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
}>();

const view = computed(() =>
  diagramView({
    program: props.program,
    record: props.pending ? null : props.record,
    pending: props.pending
  })
);

/** Changes with every phase as well as every execution, so each one lights the parts afresh. */
const pulse = computed(
  () => props.tick * 3 + (props.pending?.phase === 'decode' ? 2 : props.pending ? 1 : 0)
);

const REGISTERS: { name: RegisterName; label: string; note: string }[] = [
  { name: 'a', label: 'A', note: 'accumulator' },
  { name: 'x', label: 'X', note: 'index' },
  { name: 'y', label: 'Y', note: 'index' },
  { name: 'sp', label: 'SP', note: 'stack' },
  { name: 'pc', label: 'PC', note: 'program counter' }
];

function changed(name: RegisterName): boolean {
  return (
    !props.pending &&
    !!props.record &&
    props.record.before.registers[name] !== props.state.registers[name]
  );
}

const flagChanged = (bit: number) =>
  !props.pending && !!props.record && ((props.record.before.flags ^ props.state.flags) & bit) !== 0;
</script>

<template>
  <CpuCanvas>
    <div class="@container">
      <!--
        The chip: its registers on the left, the units that work on them on the right, and the
        internal bus between the two. A register's wire lights when the instruction uses it.
      -->
      <div
        class="chip-package grid gap-y-4 rounded-lg p-3 @min-[37rem]:grid-cols-[auto_auto_minmax(0,1fr)]"
      >
        <!-- Three 8-bit registers do all the work; SP and PC point at the stack and the code. -->
        <section class="min-w-0" aria-label="Registers">
          <h3 class="unit-title">Registers <span>8-bit</span></h3>
          <div class="flex flex-col gap-1 font-mono text-code">
            <div v-for="register in REGISTERS" :key="register.name" class="flex h-6 items-center">
              <div
                class="flex h-full w-56 items-center gap-2 rounded-sm px-1"
                :class="{
                  'bg-pointer/15': view.registers[register.name] === 'read',
                  'bg-written/20': view.registers[register.name] === 'write'
                }"
              >
                <span class="w-6 font-semibold">{{ register.label }}</span>
                <span class="w-10">
                  <ChangeMark
                    :on="changed(register.name)"
                    :tick="tick"
                    :data-loc="`reg:${register.name}`"
                  >
                    <RollingDigits
                      :text="
                        formatHex(state.registers[register.name], register.name === 'pc' ? 16 : 8)
                      "
                    />
                  </ChangeMark>
                </span>
                <span class="truncate text-2xs text-muted-foreground">
                  <template v-if="register.name === 'sp'"
                    >→ ${{ formatHex(STACK_PAGE | state.registers.sp, 16) }}</template
                  >
                  <template v-else-if="register.name === 'pc'">{{ register.note }}</template>
                  <RollingDigits
                    v-else
                    effect="flip"
                    dim-zeros
                    :text="formatBinary(state.registers[register.name], 8)"
                  />
                </span>
              </div>
              <DiagramWire
                class="hidden w-5 @min-[37rem]:block"
                :kind="view.registers[register.name]"
                :tick="pulse"
              />
            </div>
            <!-- P, the status register: a flag that is set is filled. -->
            <div class="mt-1 flex h-6 items-center gap-2 px-1" aria-label="Flags">
              <span class="w-6 font-semibold">P</span>
              <span class="flex gap-1">
                <span
                  v-for="flag in FLAG_NAMES"
                  :key="flag"
                  class="w-6 rounded-sm text-center"
                  :class="[
                    state.flags & flagBit(flag)
                      ? 'bg-foreground font-semibold text-background'
                      : 'text-muted-foreground inset-ring inset-ring-border',
                    flagChanged(flagBit(flag)) ? 'ring-2 ring-changed-glow' : ''
                  ]"
                  :title="`${flag} = ${state.flags & flagBit(flag) ? 1 : 0}`"
                  >{{ flag }}</span
                >
              </span>
            </div>
          </div>
        </section>

        <DiagramWire
          vertical
          class="hidden h-auto @min-[37rem]:block"
          :kind="view.internal"
          :tick="pulse"
          title="Internal bus"
        />

        <!-- Each unit hangs off the internal bus by a wire of its own. -->
        <div class="grid min-w-0 gap-2">
          <div class="flex min-w-0 items-center">
            <DiagramWire
              class="hidden w-5 shrink-0 @min-[37rem]:block"
              :kind="view.alu.use"
              :tick="pulse"
            />
            <DatapathStage
              class="flex-1 self-stretch"
              title="ALU"
              tag="A op M"
              :stage="view.alu"
              :tick="pulse"
            />
          </div>
          <div class="flex min-w-0 items-center">
            <DiagramWire
              class="hidden w-5 shrink-0 @min-[37rem]:block"
              :kind="view.address.use"
              :tick="pulse"
            />
            <DatapathStage
              class="flex-1 self-stretch"
              title="Address unit"
              :tag="view.address.mode ?? 'mode'"
              :stage="view.address"
              :tick="pulse"
            />
          </div>
          <div class="flex min-w-0 items-center">
            <DiagramWire class="hidden w-5 shrink-0 @min-[37rem]:block" :tick="pulse" />
            <section
              class="chip-block min-w-0 flex-1 self-stretch rounded-lg border px-3 py-2"
              :class="{ 'unit-idle': !view.cycles }"
              aria-label="Clock"
            >
              <h3 class="unit-title mb-1">Clock <span>cycles</span></h3>
              <p v-if="view.cycles" class="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span class="flex gap-0.5" aria-hidden="true">
                  <span
                    v-for="n in view.cycles.count"
                    :key="`${tick}-${n}`"
                    class="h-3 w-1.5 rounded-xs bg-written"
                  />
                </span>
                <span class="font-mono text-xs">{{ view.cycles.text }}</span>
              </p>
              <p v-else class="standby font-mono text-xs">idle</p>
            </section>
          </div>
        </div>
      </div>

      <!-- Outside the chip: the one bus to the memory, where the devices are wired in too. -->
      <div class="mt-3 flex items-end justify-between gap-3 @min-[37rem]:mt-0">
        <p class="truncate pb-1 text-xs"><span class="unit-title">Address / data bus</span></p>
        <!-- Starts inside the chip's edge, so it crosses the edge like a pin. -->
        <DiagramWire
          vertical
          class="-mt-3.25 mr-16 hidden h-9 shrink-0 @min-[37rem]:block"
          :kind="view.bus.use"
          :tick="pulse"
        />
      </div>
      <DiagramWire class="hidden @min-[37rem]:block" :kind="view.bus.use" :tick="pulse" />
      <div class="flex flex-col items-center">
        <DiagramWire
          vertical
          class="hidden h-3 @min-[37rem]:block"
          :kind="view.bus.use"
          :tick="pulse"
        />
        <div
          class="chip-block flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg border px-3 py-2.5"
          :class="{ 'unit-idle': !view.bus.use }"
        >
          <h3 class="unit-title mb-0 shrink-0">Memory <span>RAM · devices</span></h3>
          <span class="truncate font-mono text-xs" :class="{ standby: !view.bus.use }">{{
            view.bus.text
          }}</span>
        </div>
      </div>
    </div>
  </CpuCanvas>
</template>
