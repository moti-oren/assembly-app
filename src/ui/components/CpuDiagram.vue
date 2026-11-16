<script setup lang="ts">
import { computed } from 'vue';
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
  registersRead,
  registersWritten
} from '@/ui/describe';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import DiagramWire from './DiagramWire.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: it decides which wires light up. */
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the flashes and the wire pulses. */
  tick: number;
}>();

const SPLIT_REGISTERS: readonly WordRegister[] = ['ax', 'bx', 'cx', 'dx'];
/** Rows that start a new group: index/pointer, segment, and IP. */
const GROUP_STARTS: readonly WordRegister[] = ['si', 'cs', 'ip'];

const equation = computed(() => props.record && describeEquation(props.state, props.record));
const alu = computed(() => (props.record ? aluUse(props.record) : { input: false, output: false }));
const memory = computed(() => props.record && describeMemoryAccess(props.state, props.record));
const read = computed(() => (props.record ? registersRead(props.record) : new Set<WordRegister>()));

const written = computed(() =>
  props.record ? registersWritten(props.record) : new Set<WordRegister>()
);

function value(name: WordRegister): number {
  return props.state.registers[name];
}

function changedBits(name: WordRegister): number {
  return props.record ? props.record.before.registers[name] ^ value(name) : 0;
}

/** A written register wins over a read one: `add ax, cx` reads AX but what matters is the write. */
function use(name: WordRegister): 'read' | 'write' | undefined {
  if (changedBits(name) !== 0 || written.value.has(name)) return 'write';
  return read.value.has(name) ? 'read' : undefined;
}

const changedFlags = computed(() =>
  props.record ? props.record.before.flags ^ props.state.flags : 0
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

    <CardContent>
      <!-- Registers on the left, the bus between, and what the bus feeds on the right. -->
      <div class="grid gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <div class="flex flex-col font-mono text-[13px] sm:border-r-2 sm:border-foreground/15">
          <div
            v-for="name in WORD_REGISTERS"
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

            <span class="hidden text-[11px] sm:inline">
              <RollingDigits
                effect="flip"
                dim-zeros
                :text="formatBinary(value(name), 16)"
                :marks="formatBinary(changedBits(name), 16)"
              />
            </span>

            <DiagramWire class="hidden min-w-5 flex-1 sm:block" :kind="use(name)" :tick="tick" />
          </div>
        </div>

        <div class="flex flex-col justify-between gap-4">
          <div class="flex flex-col">
            <div class="flex items-stretch">
              <div class="hidden w-5 flex-col justify-center gap-4 sm:flex" aria-hidden="true">
                <DiagramWire :kind="alu.input ? 'read' : undefined" :tick="tick" />
                <DiagramWire :kind="alu.output ? 'write' : undefined" :tick="tick" />
              </div>
              <!-- A fixed height, sized for the longest sum, so nothing below moves as the text changes. -->
              <div class="h-36 min-w-0 flex-1 rounded-lg border bg-muted/30 px-3 py-2.5">
                <div class="flex items-baseline justify-between gap-3">
                  <span class="text-sm font-medium">ALU</span>
                  <span class="truncate font-mono text-xs text-muted-foreground">{{
                    record ? formatInstruction(record.instruction) : 'idle'
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
                <p v-else class="mt-2 text-xs text-muted-foreground">
                  {{
                    !record
                      ? 'Run an instruction to see how its result is computed.'
                      : alu.input
                        ? 'Computed here. The result is in the highlighted registers.'
                        : `Not used by ${record.instruction.mnemonic}.`
                  }}
                </p>
              </div>
            </div>

            <span
              class="ml-[calc(50%+0.625rem)] hidden h-3 w-0.5 transition-colors duration-300 sm:block"
              :class="changedFlags !== 0 ? 'bg-changed-glow' : 'bg-foreground/15'"
              aria-hidden="true"
            />

            <div class="mt-3 grid grid-cols-9 gap-1 sm:mt-0 sm:ml-5">
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
                          : 'border-border'
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
                  {{ FLAG_INFO[flag].label }}: {{ FLAG_INFO[flag].description }}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div class="flex items-center">
            <DiagramWire
              class="hidden w-5 sm:block"
              :kind="memory ? (memory.write ? 'write' : 'read') : undefined"
              :tick="tick"
            />
            <div
              class="flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5"
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
              <span v-else class="text-xs text-muted-foreground">not used</span>
            </div>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
