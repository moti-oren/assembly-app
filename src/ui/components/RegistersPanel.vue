<script setup lang="ts">
import { formatBinary, formatHex, toSigned } from '@/core/numbers';
import {
  REGISTER_DESCRIPTIONS,
  SPLIT_REGISTERS,
  WORD_REGISTERS,
  type WordRegister
} from '@/core/registers';
import type { CpuState } from '@/core/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import RollingDigits from './RollingDigits.vue';

const props = defineProps<{
  state: CpuState;
  /** Register values before the last instruction, used to highlight what changed. */
  previous: Record<WordRegister, number> | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

/** Rows that start a new group: index/pointer, segment, and IP. */
const GROUP_STARTS: readonly WordRegister[] = ['si', 'cs', 'ip'];

function value(name: WordRegister): number {
  return props.state.registers[name];
}

function changedBits(name: WordRegister): number {
  return props.previous ? props.previous[name] ^ value(name) : 0;
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
    <CardContent>
      <Table class="font-mono text-code">
        <TableHeader>
          <TableRow class="hover:bg-transparent">
            <TableHead class="h-8 w-12 font-sans text-xs text-muted-foreground">Reg</TableHead>
            <TableHead class="h-8 font-sans text-xs text-muted-foreground">Hex</TableHead>
            <TableHead class="h-8 text-right font-sans text-xs text-muted-foreground">
              Unsigned
            </TableHead>
            <TableHead class="h-8 text-right font-sans text-xs text-muted-foreground">
              Signed
            </TableHead>
            <TableHead
              class="hidden h-8 pl-6 font-sans text-xs text-muted-foreground sm:table-cell"
            >
              Binary
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="name in WORD_REGISTERS"
            :key="name"
            class="border-0"
            :class="{ 'border-t': GROUP_STARTS.includes(name) }"
          >
            <TableCell class="py-1">
              <Tooltip>
                <TooltipTrigger as-child>
                  <span
                    tabindex="0"
                    class="cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
                    >{{ name.toUpperCase() }}</span
                  >
                </TooltipTrigger>
                <TooltipContent side="right">{{ REGISTER_DESCRIPTIONS[name] }}</TooltipContent>
              </Tooltip>
            </TableCell>
            <TableCell class="py-1">
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
            </TableCell>
            <TableCell class="py-1 text-right tabular-nums">
              <ChangeMark :on="changedBits(name) !== 0" :tick="tick">
                <RollingDigits :text="String(value(name))" />
              </ChangeMark>
            </TableCell>
            <TableCell class="py-1 text-right text-muted-foreground tabular-nums">
              <RollingDigits :text="String(toSigned(value(name), 16))" />
            </TableCell>
            <TableCell class="hidden py-1 pl-6 text-xs sm:table-cell">
              <RollingDigits
                effect="flip"
                dim-zeros
                :text="formatBinary(value(name), 16)"
                :marks="formatBinary(changedBits(name), 16)"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </CardContent>
  </Card>
</template>
