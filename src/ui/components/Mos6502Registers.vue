<script setup lang="ts">
import { formatBinary, formatHex, toSigned } from '@/core/shared/numbers';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { STACK_PAGE, type CpuState, type RegisterName } from '@/core/mos6502/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import RollingDigits from './RollingDigits.vue';
import { useLocale } from '@/ui/useLocale';

const props = defineProps<{
  state: CpuState;
  /** Register values before the last instruction, used to highlight what changed. */
  previous: Record<RegisterName, number> | null;
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

/** The three 8-bit registers, then SP, which is 8 bits into page 1. */
const BYTES: { name: 'a' | 'x' | 'y' | 'sp'; label: string }[] = [
  { name: 'a', label: 'A' },
  { name: 'x', label: 'X' },
  { name: 'y', label: 'Y' },
  { name: 'sp', label: 'SP' }
];

function changed(name: RegisterName): boolean {
  return props.previous !== null && props.previous[name] !== props.state.registers[name];
}

function written(name: RegisterName): boolean {
  return props.record?.registersWritten.includes(name) ?? false;
}
const { t } = useLocale();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.registers.title }}</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block size-2.5 rounded-xs bg-changed" aria-hidden="true" />
          {{ t.registers.changed }}
        </span>
        <CpuViewToggle />
      </CardAction>
    </CardHeader>
    <CardContent class="flex flex-col gap-1 font-mono text-code">
      <div
        class="grid grid-cols-[2.5rem_3rem_3rem_3rem_minmax(0,1fr)] gap-x-3 font-sans text-xs text-muted-foreground"
      >
        <span>{{ t.registers.name }}</span><span>{{ t.registers.hex }}</span
        ><span class="text-right">{{ t.registers.unsigned }}</span>
        <span class="text-right">{{ t.registers.signed }}</span><span class="hidden sm:inline">{{
          t.registers.binary
        }}</span>
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
          <TooltipContent side="right">{{ t.mos6502.registerHints[register.name] }}</TooltipContent>
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
            <span class="font-sans text-muted-foreground">{{ t.mos6502.nextFree }}</span>
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
            {{ t.mos6502.registerHints.pc }}
          </TooltipContent>
        </Tooltip>
        <ChangeMark class="justify-self-start" :on="changed('pc')" :tick="tick" data-loc="reg:pc">
          <RollingDigits :text="formatHex(state.registers.pc, 16)" />
        </ChangeMark>
      </div>
    </CardContent>
  </Card>
</template>
