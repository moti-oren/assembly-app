<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/execute';
import { formatInstruction, type Mnemonic } from '@/core/instructions';
import { formatHex, truncate } from '@/core/numbers';
import { effectiveAddress, formatOperand, operandSize, type Operand } from '@/core/operands';
import { readMemory, readRegister, type CpuState } from '@/core/state';
import { Card, CardContent } from '@/components/ui/card';

const props = defineProps<{
  state: CpuState;
  record: ExecutionRecord | null;
}>();

/** Instructions whose result can be shown as `a <operator> b = result`. */
const OPERATORS: Partial<Record<Mnemonic, string>> = {
  add: '+',
  adc: '+',
  inc: '+',
  sub: '−',
  sbb: '−',
  cmp: '−',
  dec: '−',
  and: 'AND',
  test: 'AND',
  or: 'OR',
  xor: 'XOR'
};

const equation = computed(() => {
  const record = props.record;
  if (!record) return null;
  const { instruction, before, memoryWrites } = record;
  const { mnemonic } = instruction;
  const [destination, source] = instruction.operands;
  const operator = OPERATORS[mnemonic];
  if (!operator || !destination) return null;

  const size = operandSize(destination) ?? 16;
  // Operands are read as they were when the instruction ran.
  const stateBefore = { ...props.state, registers: before.registers } as CpuState;
  const read = (operand: Operand, registersFrom: CpuState): number => {
    if (operand.type === 'reg') return readRegister(registersFrom, operand.name);
    if (operand.type === 'mem') {
      return readMemory(props.state, effectiveAddress(stateBefore, operand), size);
    }
    return operand.type === 'imm' ? truncate(operand.value, size) : 0;
  };

  const left =
    destination.type === 'mem' && memoryWrites.length > 0
      ? memoryWrites.reduce((value, write, i) => value | (write.before << (8 * i)), 0)
      : read(destination, stateBefore);
  const right = source ? read(source, stateBefore) : 1;
  const carry = mnemonic === 'adc' || mnemonic === 'sbb' ? before.flags & 1 : null;
  // CMP and TEST compute a result only to set the flags, then throw it away.
  const discarded = mnemonic === 'cmp' || mnemonic === 'test';
  const result = !discarded
    ? read(destination, props.state)
    : mnemonic === 'cmp'
      ? left - right
      : left & right;

  return {
    destination: formatOperand(destination),
    left: formatHex(left, size),
    operator,
    right: formatHex(right, size),
    carry,
    result: formatHex(result, size),
    discarded
  };
});
</script>

<template>
  <Card size="sm">
    <CardContent class="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px]">
      <template v-if="record">
        <span class="font-semibold">{{ formatInstruction(record.instruction) }}</span>
        <span v-if="equation" class="ml-auto flex flex-wrap items-center gap-x-2">
          <span>{{ equation.left }}</span>
          <span class="text-muted-foreground">{{ equation.operator }}</span>
          <span>{{ equation.right }}</span>
          <template v-if="equation.carry !== null">
            <span class="text-muted-foreground">{{ equation.operator }}</span>
            <span>{{ equation.carry }}</span>
            <span class="font-sans text-xs text-muted-foreground">(CF)</span>
          </template>
          <span class="text-muted-foreground">=</span>
          <span
            class="rounded-sm px-1 font-semibold"
            :class="
              equation.discarded
                ? 'text-muted-foreground line-through decoration-1'
                : 'bg-changed text-changed-foreground'
            "
            >{{ equation.result }}</span
          >
          <span class="font-sans text-xs text-muted-foreground">
            {{ equation.discarded ? 'only the flags are kept' : `into ${equation.destination}` }}
          </span>
        </span>
      </template>
      <span v-else class="font-sans text-sm text-muted-foreground">
        Run an instruction to see how its result was computed.
      </span>
    </CardContent>
  </Card>
</template>
