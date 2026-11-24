<script setup lang="ts">
import type { RegisterLink } from '@/core/registerLink';
import { mos6502AluLink } from '@/core/mos6502AluLink';
import { mos6502NumberLink } from '@/core/mos6502NumberLink';
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
import { mos6502RegisterChange } from '@/ui/architectureDiffs';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { diagramView } from '@/ui/mos6502Diagram';
import { FLAG_INFO } from '@/ui/mos6502View';
import { changeTitle, type ValueChange } from '@/ui/stepDiff';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import ChangeMark from './ChangeMark.vue';
import CpuCanvas from './CpuCanvas.vue';
import DatapathStage from './DatapathStage.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';
import TapTooltip from './TapTooltip.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  /** The last executed instruction: it decides which parts light up. */
  record: ExecutionRecord | null;
  /** The CPU as the last instruction left it: what that instruction did is told against it. */
  after: ExecutionRecord['before'] | null;
  /** A program line being stepped by phase: until it executes, the parts show its plan. */
  pending: PendingInstruction<Instruction> | null;
  /** Number of instructions executed so far; replays the flashes. */
  tick: number;
  /** Where the last instruction's write leads in the storage topic. */
  stored: RegisterLink | null;
}>();

const aluLink = computed(() => props.record && mos6502AluLink(props.record));
const numberLink = computed(() => props.record && mos6502NumberLink(props.record));

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

/** What the last instruction did to a register; none while a line is being stepped by phase. */
function change(name: RegisterName): ValueChange | null {
  return props.pending || !props.record || !props.after
    ? null
    : mos6502RegisterChange(props.record, props.after, name);
}

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
  <CpuCanvas :alu="aluLink" :numbers="numberLink" :stored="stored">
    <div class="@container">
      <!--
        The chip: its registers on the left, the units that work on them on the right, and the
        internal bus between the two. A register's wire lights when the instruction uses it.
      -->
      <div class="chip-package rounded-lg">
        <div class="grid gap-y-4 px-4 pt-4 @min-[37rem]:grid-cols-[auto_auto_minmax(0,1fr)]">
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
                      :written="change(register.name)?.unchanged"
                      :tick="tick"
                      :title="changeTitle(register.label, change(register.name))"
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
                    <span
                      v-else-if="register.name === 'pc' && change('pc')?.jump"
                      class="font-semibold text-foreground"
                      >jumped from ${{ change('pc')!.before }}</span
                    >
                    <template v-else-if="register.name === 'pc'">{{ register.note }}</template>
                    <RollingDigits
                      v-else
                      effect="flip"
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
              <!-- P, the status register: a flag that is set is filled, quietly, as on the 8086. -->
              <div class="mt-1 flex h-6 items-center gap-2 px-1" aria-label="Flags">
                <span class="w-6 font-semibold">P</span>
                <span class="flex gap-1">
                  <TapTooltip v-for="flag in FLAG_NAMES" :key="flag" v-slot="{ toggle }">
                    <TooltipTrigger as-child>
                      <span
                        tabindex="0"
                        role="img"
                        class="relative w-6 cursor-help rounded-sm text-center outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:after:absolute pointer-coarse:after:-inset-y-2.5 pointer-coarse:after:inset-x-0 pointer-coarse:after:content-['']"
                        :class="[
                          state.flags & flagBit(flag)
                            ? 'bg-secondary font-semibold text-foreground inset-ring inset-ring-foreground/40'
                            : 'text-muted-foreground inset-ring inset-ring-border',
                          flagChanged(flagBit(flag)) ? 'ring-2 ring-changed-glow' : ''
                        ]"
                        :aria-label="`${flag}, ${FLAG_INFO[flag].label}: ${state.flags & flagBit(flag) ? 1 : 0}. ${FLAG_INFO[flag].description}`"
                        @click="toggle"
                        >{{ flag }}</span
                      >
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ flag }} = {{ state.flags & flagBit(flag) ? 1 : 0 }}.
                      {{ FLAG_INFO[flag].label }}: {{ FLAG_INFO[flag].description }}
                    </TooltipContent>
                  </TapTooltip>
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

        <!--
        The bus leaves the chip: its line spans the units inside, and under it is the memory,
        where the devices are wired in too.
      -->
        <div
          class="mt-4 flex items-end justify-between gap-3 px-4 @max-[37rem]:pb-3 @min-[37rem]:mt-0"
        >
          <p class="truncate pb-1.5 text-xs"><span class="unit-title">Address / data bus</span></p>
          <!-- Straight down from the foot of the units' column to the bus line. -->
          <DiagramWire
            vertical
            class="mr-16 hidden h-10 shrink-0 @min-[37rem]:block"
            :kind="view.bus.use"
            :tick="pulse"
          />
        </div>
        <DiagramWire class="mx-4 hidden @min-[37rem]:block" :kind="view.bus.use" :tick="pulse" />
        <div
          class="chip-outside flex flex-col items-center rounded-b-lg px-4 pb-4 @max-[37rem]:border-t @max-[37rem]:pt-3"
        >
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
    </div>
  </CpuCanvas>
</template>
