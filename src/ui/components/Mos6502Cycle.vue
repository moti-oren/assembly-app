<script setup lang="ts">
import { computed } from 'vue';
import type { CyclePhase } from '@/core/shared/cycle';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import type { CpuState } from '@/core/mos6502/state';
import { describeDecode, describeExecute, describeFetch } from '@/ui/mos6502Explain';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import CycleStrip from './CycleStrip.vue';

const props = defineProps<{
  state: CpuState;
  program: Instruction[];
  /** The last executed instruction: with nothing pending, the cycle rests on its execute phase. */
  record: ExecutionRecord | null;
  /** The program line being stepped by phase, if any. */
  pending: PendingInstruction<Instruction> | null;
}>();

const active = computed<CyclePhase | null>(
  () => props.pending?.phase ?? (props.record ? 'execute' : null)
);

const instruction = computed(() => {
  const shown = props.pending?.instruction ?? props.record?.instruction;
  return shown ? formatInstruction(shown) : null;
});

const detail = computed(() => {
  const { pending, record, state, program } = props;
  if (pending?.phase === 'fetch') return describeFetch(pending.line, program);
  if (pending) return describeDecode(pending.instruction);
  if (record) return describeExecute(record, state, program);
  return 'Every instruction is fetched, decoded, then executed. The opcode, one byte, says both the instruction and its addressing mode; the 6502 then reads 0 to 2 more bytes. Use the Fetch button below to walk a line through.';
});
</script>

<template>
  <CycleStrip :active="active" :instruction="instruction" :detail="detail" />
</template>
