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
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { diagramView } from '@/ui/mos6502Diagram';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import DatapathStage from './DatapathStage.vue';
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

    <CardContent class="@container flex flex-col gap-3">
      <div class="grid gap-3 @min-[40rem]:grid-cols-[auto_minmax(0,1fr)]">
        <!-- Three 8-bit registers do all the work; SP and PC point at the stack and the code. -->
        <section
          class="rounded-xl border border-foreground/20 bg-inset p-2.5"
          aria-label="Registers"
        >
          <h3 class="unit-title">Registers <span>8-bit</span></h3>
          <div class="mt-1.5 flex flex-col gap-1 font-mono text-code">
            <div
              v-for="register in REGISTERS"
              :key="register.name"
              class="flex h-6 items-center gap-2 rounded-sm px-1"
              :class="{
                'bg-pointer/15': view.registers[register.name] === 'read',
                'bg-written/20': view.registers[register.name] === 'write'
              }"
            >
              <span class="w-6 font-semibold">{{ register.label }}</span>
              <ChangeMark
                :on="changed(register.name)"
                :tick="tick"
                :data-loc="`reg:${register.name}`"
              >
                <RollingDigits
                  :text="formatHex(state.registers[register.name], register.name === 'pc' ? 16 : 8)"
                />
              </ChangeMark>
              <span class="text-2xs text-muted-foreground">
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
            <div class="mt-1 flex gap-1 border-t pt-1.5" aria-label="Flags">
              <span
                v-for="flag in FLAG_NAMES"
                :key="flag"
                class="w-6 rounded-sm text-center"
                :class="[
                  state.flags & flagBit(flag)
                    ? 'bg-foreground font-semibold text-background'
                    : 'text-muted-foreground',
                  flagChanged(flagBit(flag)) ? 'ring-2 ring-changed-glow' : ''
                ]"
                :title="`${flag} = ${state.flags & flagBit(flag) ? 1 : 0}`"
                >{{ flag }}</span
              >
            </div>
          </div>
        </section>

        <div class="grid gap-2 @min-[28rem]:grid-cols-2">
          <DatapathStage title="ALU" tag="A op M" :stage="view.alu" :tick="pulse" />
          <DatapathStage
            title="Address unit"
            :tag="view.address.mode ?? 'mode'"
            :stage="view.address"
            :tick="pulse"
          />
          <DatapathStage title="Data bus" tag="memory · devices" :stage="view.bus" :tick="pulse" />
          <section
            class="rounded-lg border bg-card px-2.5 py-2 transition-opacity duration-300"
            :class="{ 'unit-idle': !view.cycles }"
            aria-label="Cycles"
          >
            <h3 class="unit-title">Cycles <span>clock</span></h3>
            <template v-if="view.cycles">
              <div class="mt-1.5 flex flex-wrap gap-1" aria-hidden="true">
                <span
                  v-for="n in view.cycles.count"
                  :key="`${tick}-${n}`"
                  class="size-3 rounded-xs bg-written/70"
                />
              </div>
              <p class="mt-1 font-mono text-xs">{{ view.cycles.text }}</p>
            </template>
            <p v-else class="mt-1 font-mono text-xs text-muted-foreground">idle</p>
          </section>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
