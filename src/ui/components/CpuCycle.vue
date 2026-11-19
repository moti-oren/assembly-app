<script setup lang="ts">
import { computed } from 'vue';
import type { CyclePhase } from '@/core/shared/cycle';
import { OPERAND_KIND_LABELS, decode, type Decoded } from '@/core/x86/decode';
import type { ExecutionRecord } from '@/core/x86/execute';
import { CATEGORY_LABELS, formatInstruction, type Instruction } from '@/core/x86/instructions';
import { formatHex } from '@/core/shared/numbers';
import { formatLabel } from '@/core/shared/program';
import { changedRegisters } from '@/core/x86/registers';
import type { CpuState } from '@/core/x86/state';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import CycleStrip from './CycleStrip.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: with nothing pending, the cycle rests on its execute phase. */
  record: ExecutionRecord | null;
  /** The program line being stepped by phase, if any. */
  pending: PendingInstruction<Instruction> | null;
}>();

const active = computed<CyclePhase | null>(
  () => props.pending?.phase ?? (props.record ? 'execute' : null)
);

const instruction = computed(() => props.pending?.instruction ?? props.record?.instruction);

function list(items: (string | false)[]): string {
  return items.filter(Boolean).join(', ');
}

function describeDecode(decoded: Decoded): string {
  const size = decoded.size ? `, ${decoded.size}-bit` : '';
  const operands = decoded.operands
    .map(
      (operand) => `${operand.text} is the ${operand.role} (${OPERAND_KIND_LABELS[operand.kind]})`
    )
    .join(', ');
  const names = (registers: string[]) => registers.map((name) => name.toUpperCase());
  const reads = list([
    ...names(decoded.reads),
    decoded.memory.read && 'memory',
    decoded.port === 'read' && 'an I/O port',
    decoded.readsFlags && 'the flags'
  ]);
  const writes = list([
    ...names(decoded.writes),
    decoded.memory.write && 'memory',
    decoded.port === 'write' && 'an I/O port',
    decoded.writesFlags && 'the flags'
  ]);
  return [
    `${CATEGORY_LABELS[decoded.category]}${size}: ${decoded.description}.`,
    operands && `Here ${operands}.`,
    reads && `It will read ${reads}.`,
    writes && `It will write ${writes}.`
  ]
    .filter(Boolean)
    .join(' ');
}

function describeExecute(record: ExecutionRecord): string {
  const { registers, flags } = props.state;
  const changed = list([
    ...changedRegisters(record.before.registers, registers)
      .filter((name) => name !== 'ip')
      .map((name) => name.toUpperCase()),
    record.memoryWrites.length > 0 && 'memory',
    record.portWrites.length > 0 && 'an I/O port',
    flags !== record.before.flags && 'the flags'
  ]);
  const interrupt =
    record.interrupt === null ? '' : ` It entered interrupt ${formatHex(record.interrupt, 8)}h.`;
  const effect =
    (changed ? `It changed ${changed}.` : 'It changed no register, flag or memory.') + interrupt;
  if (record.line === null) {
    return `Run directly, so nothing was fetched from the program. ${effect}`;
  }
  const next = formatLabel(registers.ip);
  const jumped = registers.ip !== record.line + 1;
  return `${effect} ${jumped ? `It jumped: IP is now ${next}.` : `IP is at ${next}, the next line.`}`;
}

const detail = computed(() => {
  const { pending, record } = props;
  if (pending?.phase === 'fetch') {
    return `IP points at ${formatLabel(pending.line)}. That line is read out of the program, and IP moves on to ${formatLabel(pending.line + 1)} before anything runs.`;
  }
  if (pending) return describeDecode(decode(pending.instruction));
  return record ? describeExecute(record) : null;
});

const INTRO =
  'Every instruction is fetched, decoded, then executed. Use the Fetch button below to walk a program line through the three phases.';
</script>

<template>
  <CycleStrip
    :active="active"
    :instruction="instruction ? formatInstruction(instruction) : null"
    :detail="detail"
    :intro="INTRO"
  />
</template>
