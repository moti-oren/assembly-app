<script setup lang="ts">
import { formatBinary, formatHex, toSigned } from '@/core/shared/numbers';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { STACK_PAGE, type CpuState, type RegisterName } from '@/core/mos6502/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  /** Register values before the last instruction, used to highlight what changed. */
  previous: Record<RegisterName, number> | null;
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

/** The three 8-bit registers, then SP, which is 8 bits into page 1. */
const BYTES: { name: 'a' | 'x' | 'y' | 'sp'; label: string; description: string }[] = [
  {
    name: 'a',
    label: 'A',
    description: 'Accumulator: the only register the ALU adds, ANDs and compares into'
  },
  {
    name: 'x',
    label: 'X',
    description: 'Index register: counts, and is added to an address ($nn,X, ($nn,X))'
  },
  {
    name: 'y',
    label: 'Y',
    description: 'Index register: counts, and is added to an address ($nn,Y, ($nn),Y)'
  },
  {
    name: 'sp',
    label: 'SP',
    description: 'Stack pointer: the low byte of the next free slot in page $01'
  }
];

function changed(name: RegisterName): boolean {
  return props.previous !== null && props.previous[name] !== props.state.registers[name];
}

function written(name: RegisterName): boolean {
  return props.record?.registersWritten.includes(name) ?? false;
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Registers</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block size-2.5 rounded-xs bg-changed" aria-hidden="true" />
          changed by the last instruction
        </span>
        <CpuViewToggle />
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-1 font-mono text-code">
      <div
        class="grid grid-cols-[2.5rem_3rem_3rem_3rem_minmax(0,1fr)] gap-x-3 font-sans text-xs text-muted-foreground"
      >
        <span>Reg</span><span>Hex</span><span class="text-right">Unsigned</span>
        <span class="text-right">Signed</span><span class="hidden sm:inline">Binary</span>
      </div>
      <div
        v-for="register in BYTES"
        :key="register.name"
        class="grid h-6 grid-cols-[2.5rem_3rem_3rem_3rem_minmax(0,1fr)] items-center gap-x-3"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
              >{{ register.label }}</span
            >
          </TooltipTrigger>
          <TooltipContent side="right">{{ register.description }}</TooltipContent>
        </Tooltip>
        <ChangeMark
          :on="changed(register.name)"
          :written="written(register.name)"
          :tick="tick"
          :data-loc="`reg:${register.name}`"
        >
          <RollingDigits :text="formatHex(state.registers[register.name], 8)" />
        </ChangeMark>
        <span class="text-right tabular-nums">{{ state.registers[register.name] }}</span>
        <span class="text-right text-muted-foreground tabular-nums">
          {{ register.name === 'sp' ? '' : toSigned(state.registers[register.name], 8) }}
        </span>
        <span class="hidden text-xs sm:inline">
          <template v-if="register.name === 'sp'">
            <span class="font-sans text-muted-foreground">next free slot</span>
            ${{ formatHex(STACK_PAGE | state.registers.sp, 16) }}
          </template>
          <RollingDigits
            v-else
            effect="flip"
            dim-zeros
            :text="formatBinary(state.registers[register.name], 8)"
          />
        </span>
      </div>
      <div
        class="mt-1 grid h-6 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3 border-t pt-1"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
              >PC</span
            >
          </TooltipTrigger>
          <TooltipContent side="right">
            Program counter: the 16-bit address of the next instruction
          </TooltipContent>
        </Tooltip>
        <ChangeMark :on="changed('pc')" :tick="tick" data-loc="reg:pc">
          <RollingDigits :text="formatHex(state.registers.pc, 16)" />
        </ChangeMark>
      </div>
    </CardContent>
  </Card>
</template>
