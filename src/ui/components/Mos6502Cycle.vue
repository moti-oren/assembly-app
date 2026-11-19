<script setup lang="ts">
import { computed } from 'vue';
import type { CyclePhase } from '@/core/shared/cycle';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import type { CpuState } from '@/core/mos6502/state';
import { describeDecode, describeExecute, describeFetch } from '@/ui/mos6502Explain';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import CycleStrip from './CycleStrip.vue';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

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
  if (pending?.phase === 'fetch') return describeFetch(t.value, pending.line, program);
  if (pending) return describeDecode(t.value, pending.instruction);
  return record ? describeExecute(t.value, record, state, program) : null;
});
</script>

<template>
  <CycleStrip
    :active="active"
    :instruction="instruction"
    :detail="detail"
    :intro="t.mos6502.cycleIntro"
  />
</template>
