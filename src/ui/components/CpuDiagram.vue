<script setup lang="ts">
import { computed } from 'vue';
import { explainAddress } from '@/core/address';
import { decode } from '@/core/decode';
import type { ExecutionRecord } from '@/core/execute';
import { FLAG_BITS, FLAG_INFO, FLAG_NAMES, type FlagName } from '@/core/flags';
import { formatInstruction } from '@/core/instructions';
import { formatBinary, formatHex, toSigned } from '@/core/numbers';
import { REGISTER_DESCRIPTIONS, WORD_REGISTERS, type WordRegister } from '@/core/registers';
import type { CpuState } from '@/core/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  aluUse,
  describeEquation,
  describeMemoryAccess,
  describePortAccess,
  registersRead,
  registersWritten
} from '@/ui/describe';
import type { PendingInstruction } from '@/ui/useCpu';
import ChangeMark from './ChangeMark.vue';
import CpuCycle from './CpuCycle.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import DiagramWire from './DiagramWire.vue';
import FlagReason from './FlagReason.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: it decides which wires light up. */
  record: ExecutionRecord | null;
  /** A program line being stepped by phase: until it executes, the wires show its plan. */
  pending: PendingInstruction | null;
  /** Number of instructions executed so far; replays the flashes and the wire pulses. */
  tick: number;
}>();

type WireKind = 'read' | 'write' | undefined;

const SPLIT_REGISTERS: readonly WordRegister[] = ['ax', 'bx', 'cx', 'dx'];
/** The execution unit holds the data, pointer and index registers, the ALU and the flags. */
const EU_REGISTERS: readonly WordRegister[] = ['ax', 'bx', 'cx', 'dx', 'sp', 'bp', 'si', 'di'];
/** The bus interface unit holds what an address is made of: the segments and IP. */
const BIU_REGISTERS: readonly WordRegister[] = ['cs', 'ds', 'ss', 'es', 'ip'];
/** Rows that start a new group: the pointer and index registers, and IP. */
const GROUP_STARTS: readonly WordRegister[] = ['sp', 'ip'];

/** While a line is part-way through its cycle nothing has run yet, so no change is on show. */
const shown = computed(() => (props.pending ? null : props.record));
const decoded = computed(() =>
  props.pending?.phase === 'decode' ? decode(props.pending.instruction) : null
);
/** Changes with every phase as well as every execution, so each one lights the wires afresh. */
const pulse = computed(() => {
  const phaseStep = props.pending ? (props.pending.phase === 'fetch' ? 1 : 2) : 0;
  return props.tick * 3 + phaseStep;
});

const equation = computed(() => shown.value && describeEquation(props.state, shown.value));
const alu = computed(() => {
  if (decoded.value) return { input: decoded.value.usesAlu, output: false };
  return shown.value ? aluUse(shown.value) : { input: false, output: false };
});
const memory = computed(() => shown.value && describeMemoryAccess(props.state, shown.value));
const port = computed(() => shown.value && describePortAccess(props.state, shown.value));
/** The sum the address adder worked out for the memory access. A port number skips the adder. */
const address = computed(
  () => memory.value && explainAddress(memory.value.segmentValue, memory.value.offset)
);
const read = computed(() => {
  // Fetch only looks at IP; decode selects the registers the instruction is going to read.
  if (props.pending?.phase === 'fetch') return new Set<WordRegister>(['ip']);
  if (decoded.value) return new Set<WordRegister>(decoded.value.reads);
  return shown.value ? registersRead(shown.value) : new Set<WordRegister>();
});

const written = computed(() =>
  shown.value ? registersWritten(shown.value) : new Set<WordRegister>()
);

const aluNote = computed(() => {
  const { pending, record } = props;
  if (pending?.phase === 'fetch') return 'Waiting: the instruction is still being fetched.';
  if (decoded.value) {
    return decoded.value.usesAlu
      ? 'Selected. The operands go in when the instruction executes.'
      : `Not needed by ${decoded.value.mnemonic}.`;
  }
  if (!record) return 'Run an instruction to see how its result is computed.';
  return alu.value.input
    ? 'Computed here. The result is in the highlighted registers.'
    : `Not used by ${record.instruction.mnemonic}.`;
});

const memoryPlanned = computed(() => {
  const plan = decoded.value?.memory;
  return plan !== undefined && (plan.read || plan.write);
});

const memoryNote = computed(() => {
  const plan = decoded.value?.memory;
  if (!plan || !memoryPlanned.value) return 'not used';
  if (plan.read && plan.write) return 'will be read and written';
  return plan.write ? 'will be written' : 'will be read';
});

const portNote = computed(() => {
  const plan = decoded.value?.port;
  if (!plan) return 'not used';
  return plan === 'write' ? 'will be written' : 'will be read';
});

const adderNote = computed(() => {
  const { pending, record } = props;
  if (pending?.phase === 'fetch') {
    return 'Idle: the program is not stored in memory here, so fetching a line forms no address.';
  }
  if (decoded.value) {
    if (memoryPlanned.value) return 'Selected. It will turn segment:offset into a 20-bit address.';
    return decoded.value.port
      ? 'Not needed: a port number goes onto the bus as it is.'
      : `Not needed by ${decoded.value.mnemonic}.`;
  }
  if (!record) return 'Turns segment:offset into the 20-bit address that goes onto the bus.';
  return port.value
    ? 'Not used: a port number goes onto the bus as it is.'
    : `Not used: ${record.instruction.mnemonic} did not touch memory.`;
});

/** A wire is lit as planned during decode, and by what really crossed it after execute. */
const adderKind = computed<WireKind>(() =>
  address.value || memoryPlanned.value ? 'read' : undefined
);
const memoryKind = computed<WireKind>(() => {
  if (memory.value) return memory.value.write ? 'write' : 'read';
  return memoryPlanned.value ? 'read' : undefined;
});
const portKind = computed<WireKind>(() => {
  if (port.value) return port.value.write ? 'write' : 'read';
  return decoded.value?.port ? 'read' : undefined;
});
const busKind = computed<WireKind>(() => memoryKind.value ?? portKind.value);

/** What is on the external bus: the address the CPU put there, then the data that followed. */
const busText = computed(() => {
  if (memory.value && address.value) {
    return `address ${hex20(address.value.physical)}h, data ${memory.value.value}`;
  }
  return port.value ? `port ${port.value.port}h, data ${port.value.value}` : null;
});

function hex20(value: number): string {
  return value.toString(16).toUpperCase().padStart(5, '0');
}

function value(name: WordRegister): number {
  return props.state.registers[name];
}

function changedBits(name: WordRegister): number {
  return shown.value ? shown.value.before.registers[name] ^ value(name) : 0;
}

/** A written register wins over a read one: `add ax, cx` reads AX but what matters is the write. */
function use(name: WordRegister): WireKind {
  if (changedBits(name) !== 0 || written.value.has(name)) return 'write';
  return read.value.has(name) ? 'read' : undefined;
}

/** The bus between the two units carries whatever any register, the ALU or the adder used. */
const internalKind = computed<WireKind>(() => {
  if (alu.value.output || WORD_REGISTERS.some((name) => use(name) === 'write')) return 'write';
  return read.value.size > 0 || alu.value.input || busKind.value ? 'read' : undefined;
});

const changedFlags = computed(() =>
  shown.value ? shown.value.before.flags ^ props.state.flags : 0
);

function isSet(flag: FlagName): boolean {
  return (props.state.flags & (1 << FLAG_BITS[flag])) !== 0;
}

function flagChanged(flag: FlagName): boolean {
  return (changedFlags.value & (1 << FLAG_BITS[flag])) !== 0;
}
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle>CPU</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-pointer" aria-hidden="true" />
          read
        </span>
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block h-0.5 w-3 rounded-full bg-changed-glow" aria-hidden="true" />
          written
        </span>
        <CpuViewToggle />
      </CardAction>
    </CardHeader>

    <CardContent class="flex flex-col gap-4">
      <CpuCycle :state="state" :record="record" :pending="pending" />

      <div class="@container">
        <!-- The package: the two units of an 8086 and the internal bus that joins them. -->
        <div
          class="grid gap-y-5 rounded-xl border border-foreground/20 bg-muted/20 p-2.5 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
        >
          <section class="min-w-0" aria-label="Execution unit">
            <h3 class="unit-title">Execution unit <span>EU</span></h3>
            <div class="flex flex-col font-mono text-[13px]">
              <!-- The number system of each column, as in the register table. -->
              <div class="flex h-5 items-center gap-2.5 font-sans text-xs text-muted-foreground">
                <span class="w-6" />
                <span class="w-14">Hex</span>
                <span class="flex w-11 justify-end whitespace-nowrap">Decimal</span>
                <span class="hidden @min-[36rem]:inline">Binary</span>
              </div>
              <div
                v-for="name in EU_REGISTERS"
                :key="name"
                class="flex h-5 items-center gap-2.5"
                :class="{ 'mt-1.5': GROUP_STARTS.includes(name) }"
              >
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span
                      tabindex="0"
                      class="w-6 cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
                      >{{ name.toUpperCase() }}</span
                    >
                  </TooltipTrigger>
                  <TooltipContent side="right">{{ REGISTER_DESCRIPTIONS[name] }}</TooltipContent>
                </Tooltip>

                <span class="w-14">
                  <span
                    v-if="SPLIT_REGISTERS.includes(name)"
                    class="inline-flex gap-1"
                    :data-loc="`reg:${name}`"
                  >
                    <ChangeMark
                      :on="(changedBits(name) & 0xff00) !== 0"
                      :tick="tick"
                      :title="`${name[0].toUpperCase()}H`"
                      :data-loc="`reg:${name[0]}h`"
                    >
                      <RollingDigits :text="formatHex(value(name) >> 8, 8)" />
                    </ChangeMark>
                    <ChangeMark
                      :on="(changedBits(name) & 0x00ff) !== 0"
                      :tick="tick"
                      :title="`${name[0].toUpperCase()}L`"
                      :data-loc="`reg:${name[0]}l`"
                    >
                      <RollingDigits :text="formatHex(value(name), 8)" />
                    </ChangeMark>
                  </span>
                  <ChangeMark
                    v-else
                    :on="changedBits(name) !== 0"
                    :tick="tick"
                    :data-loc="`reg:${name}`"
                  >
                    <RollingDigits :text="formatHex(value(name), 16)" />
                  </ChangeMark>
                </span>

                <span
                  class="w-11 text-right text-xs text-muted-foreground tabular-nums"
                  :title="`${value(name)} unsigned, ${toSigned(value(name), 16)} signed`"
                >
                  <RollingDigits :text="String(value(name))" />
                </span>

                <span class="hidden text-[11px] @min-[36rem]:inline">
                  <RollingDigits
                    effect="flip"
                    dim-zeros
                    :text="formatBinary(value(name), 16)"
                    :marks="formatBinary(changedBits(name), 16)"
                  />
                </span>

                <DiagramWire
                  class="hidden min-w-5 flex-1 sm:block"
                  :kind="use(name)"
                  :tick="pulse"
                />
              </div>
            </div>

            <div class="mt-3 flex items-stretch">
              <!-- A fixed height, sized for the longest sum, so nothing below moves as the text changes. -->
              <div class="h-36 min-w-0 flex-1 rounded-lg border bg-card px-3 py-2.5">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="text-sm font-medium">ALU</span>
                  <span class="truncate font-mono text-xs text-muted-foreground">{{
                    shown ? formatInstruction(shown.instruction) : pending ? pending.phase : 'idle'
                  }}</span>
                </div>
                <div
                  v-if="equation"
                  class="mt-2 grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-2.5 gap-y-0.5 font-mono text-[13px]"
                >
                  <span />
                  <span class="text-right">{{ equation.left }}</span>
                  <span />
                  <span class="text-muted-foreground">{{ equation.operator }}</span>
                  <span class="text-right">{{ equation.right }}</span>
                  <span />
                  <template v-if="equation.carry !== null">
                    <span class="text-muted-foreground">{{ equation.operator }}</span>
                    <span class="text-right">{{ equation.carry }}</span>
                    <span class="font-sans text-xs text-muted-foreground">CF</span>
                  </template>
                  <span class="col-span-2 my-0.5 border-t border-foreground/25" />
                  <span />
                  <span class="text-muted-foreground">=</span>
                  <span
                    class="-mx-1 rounded-sm px-1 text-right font-semibold"
                    :class="
                      equation.discarded
                        ? 'text-muted-foreground line-through decoration-1'
                        : 'bg-changed text-changed-foreground'
                    "
                    >{{ equation.result }}</span
                  >
                  <span class="truncate font-sans text-xs text-muted-foreground">
                    {{
                      equation.discarded
                        ? 'only the flags are kept'
                        : `into ${equation.destination}`
                    }}
                  </span>
                </div>
                <p v-else class="mt-2 text-xs text-muted-foreground">{{ aluNote }}</p>
              </div>
              <!-- Operands come in off the bus; the result goes back onto it. -->
              <div class="hidden w-5 flex-col justify-center gap-4 sm:flex" aria-hidden="true">
                <DiagramWire :kind="alu.input ? 'read' : undefined" :tick="pulse" />
                <DiagramWire :kind="alu.output ? 'write' : undefined" :tick="pulse" />
              </div>
            </div>

            <span
              class="ml-[calc(50%-0.625rem)] hidden h-3 w-0.5 transition-colors duration-300 sm:block"
              :class="changedFlags !== 0 ? 'bg-changed-glow' : 'bg-foreground/15'"
              aria-hidden="true"
            />

            <div class="mt-3 grid grid-cols-9 gap-1 sm:mt-0 sm:mr-5">
              <Tooltip v-for="flag in FLAG_NAMES" :key="flag">
                <TooltipTrigger as-child>
                  <div
                    tabindex="0"
                    class="change-mark flex cursor-help flex-col items-center rounded-md border px-0 py-1 font-mono outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    :class="[
                      flagChanged(flag)
                        ? 'border-transparent bg-changed text-changed-foreground'
                        : isSet(flag)
                          ? 'border-foreground/20 bg-secondary'
                          : 'border-border bg-card'
                    ]"
                    :aria-label="`${FLAG_INFO[flag].label} flag is ${isSet(flag) ? 1 : 0}`"
                  >
                    <span
                      v-if="flagChanged(flag)"
                      :key="tick"
                      class="change-flash"
                      aria-hidden="true"
                    />
                    <span class="text-[11px] font-semibold">{{ flag }}</span>
                    <span
                      class="text-sm"
                      :class="isSet(flag) ? 'font-bold' : 'text-muted-foreground/70'"
                      ><RollingDigits effect="flip" :text="isSet(flag) ? '1' : '0'"
                    /></span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <FlagReason :flag="flag" :record="record" />
                </TooltipContent>
              </Tooltip>
            </div>
          </section>

          <DiagramWire
            class="hidden h-auto w-0.5 sm:block"
            :kind="internalKind"
            :tick="pulse"
            title="Internal bus"
          />

          <!-- As wide as its register rows, with or without their bits; the adder's notes wrap. -->
          <section
            class="flex flex-col sm:w-60 @min-[40rem]:w-[18.5rem]"
            aria-label="Bus interface unit"
          >
            <h3 class="unit-title sm:pl-7">Bus interface unit <span>BIU</span></h3>
            <div class="flex flex-col font-mono text-[13px]">
              <div class="flex h-5 items-center gap-2.5 font-sans text-xs text-muted-foreground">
                <span class="-mr-0.5 hidden w-5 sm:block" />
                <span class="w-6" />
                <span class="w-10">Hex</span>
                <span class="flex w-11 justify-end whitespace-nowrap">Decimal</span>
                <span class="hidden @min-[40rem]:inline">Binary</span>
              </div>
              <div
                v-for="name in BIU_REGISTERS"
                :key="name"
                class="flex h-5 items-center gap-2.5"
                :class="{ 'mt-1.5': GROUP_STARTS.includes(name) }"
              >
                <DiagramWire class="-mr-0.5 hidden w-5 sm:block" :kind="use(name)" :tick="pulse" />
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span
                      tabindex="0"
                      class="w-6 cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
                      >{{ name.toUpperCase() }}</span
                    >
                  </TooltipTrigger>
                  <TooltipContent side="left">{{ REGISTER_DESCRIPTIONS[name] }}</TooltipContent>
                </Tooltip>
                <span class="w-10">
                  <ChangeMark :on="changedBits(name) !== 0" :tick="tick" :data-loc="`reg:${name}`">
                    <RollingDigits :text="formatHex(value(name), 16)" />
                  </ChangeMark>
                </span>
                <span
                  class="w-11 text-right text-xs text-muted-foreground tabular-nums"
                  :title="`${value(name)} unsigned, ${toSigned(value(name), 16)} signed`"
                >
                  <RollingDigits :text="String(value(name))" />
                </span>
                <!-- Only where both units fit their bits side by side; the EU's bits come first. -->
                <span class="hidden text-[11px] @min-[40rem]:inline">
                  <RollingDigits
                    effect="flip"
                    dim-zeros
                    :text="formatBinary(value(name), 16)"
                    :marks="formatBinary(changedBits(name), 16)"
                  />
                </span>
              </div>
            </div>

            <!-- The segment drops down into the adder; the offset comes in off the internal bus. -->
            <DiagramWire
              class="ml-[calc(50%+0.625rem)] hidden h-auto min-h-3 w-0.5 flex-1 sm:block"
              :kind="adderKind"
              :tick="pulse"
            />
            <div class="mt-3 flex items-center sm:mt-0">
              <DiagramWire class="hidden w-5 sm:block" :kind="adderKind" :tick="pulse" />
              <div class="h-32 min-w-0 flex-1 rounded-lg border bg-card px-3 py-2.5">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="text-sm font-medium">Address adder</span>
                  <span class="font-mono text-xs text-muted-foreground" aria-hidden="true">Σ</span>
                </div>
                <div
                  v-if="memory && address"
                  class="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-2.5 gap-y-0.5 font-mono text-[13px]"
                >
                  <span class="truncate font-sans text-xs text-muted-foreground">
                    {{ memory.segment.toUpperCase() }} × 10h
                  </span>
                  <span class="text-right">{{ hex20(address.shifted) }}</span>
                  <span class="truncate font-sans text-xs text-muted-foreground">+ offset</span>
                  <span class="text-right">{{ formatHex(address.offset, 16) }}</span>
                  <span class="col-span-2 my-0.5 border-t border-foreground/25" />
                  <span class="truncate font-sans text-xs text-muted-foreground">
                    {{ address.wrapped ? 'wraps past 1MB to' : '20-bit address' }}
                  </span>
                  <span class="text-right font-semibold text-pointer">{{
                    hex20(address.physical)
                  }}</span>
                </div>
                <p v-else class="mt-2 text-xs text-muted-foreground">{{ adderNote }}</p>
              </div>
            </div>
          </section>
        </div>

        <!-- Outside the package: one bus, shared by the memory and the I/O ports. -->
        <div class="mt-3 flex items-end justify-between gap-3 sm:mt-0">
          <p class="truncate pb-1 text-xs text-muted-foreground">
            <span class="font-medium text-foreground">Address / data bus</span>
            <span v-if="busText" class="ml-2 font-mono">{{ busText }}</span>
          </p>
          <!-- Starts at the adder, so it crosses the edge of the package like a pin. -->
          <DiagramWire
            class="-mt-[11px] mr-[calc(6.875rem+11px)] hidden h-9 @min-[40rem]:mr-[calc(8.625rem+11px)] w-0.5 shrink-0 sm:block"
            :kind="busKind"
            :tick="pulse"
          />
        </div>
        <DiagramWire class="hidden sm:block" :kind="busKind" :tick="pulse" />
        <div class="mt-2 grid gap-x-3 gap-y-2 sm:mt-0 sm:grid-cols-2">
          <div class="flex min-w-0 flex-col items-center">
            <DiagramWire class="hidden h-3 w-0.5 sm:block" :kind="memoryKind" :tick="pulse" />
            <div
              class="flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <span class="text-sm font-medium">Memory</span>
              <span v-if="memory" class="truncate font-mono text-[13px]">
                <span class="font-sans text-xs text-muted-foreground">
                  {{ memory.write ? 'wrote' : 'read' }}
                </span>
                <span
                  class="mx-1.5 rounded-sm px-1 font-semibold"
                  :class="memory.write ? 'bg-changed text-changed-foreground' : ''"
                  >{{ memory.value }}</span
                >
                <span class="font-sans text-xs text-muted-foreground">
                  {{ memory.write ? 'to' : 'from' }}
                </span>
                {{ memory.address }}
              </span>
              <span v-else class="text-xs text-muted-foreground">{{ memoryNote }}</span>
            </div>
          </div>
          <div class="flex min-w-0 flex-col items-center">
            <DiagramWire class="hidden h-3 w-0.5 sm:block" :kind="portKind" :tick="pulse" />
            <div
              class="flex w-full min-w-0 items-baseline justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
            >
              <span class="text-sm font-medium">I/O ports</span>
              <span v-if="port" class="truncate font-mono text-[13px]">
                <span class="font-sans text-xs text-muted-foreground">
                  {{ port.write ? 'wrote' : 'read' }}
                </span>
                <span
                  class="mx-1.5 rounded-sm px-1 font-semibold"
                  :class="port.write ? 'bg-changed text-changed-foreground' : ''"
                  >{{ port.value }}</span
                >
                <span class="font-sans text-xs text-muted-foreground">
                  {{ port.write ? 'to port' : 'from port' }}
                </span>
                {{ port.port }}h
              </span>
              <span v-else class="text-xs text-muted-foreground">{{ portNote }}</span>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
