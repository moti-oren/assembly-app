<script setup lang="ts">
import { computed } from 'vue';
import type { CyclePhase } from '@/core/shared/cycle';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction, type Instruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import { useLocale } from '@/ui/useLocale';
import { describeCycle } from '@/ui/x86Cycle';
import CycleStrip from './CycleStrip.vue';

const { t } = useLocale();

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

const detail = computed(() => describeCycle(t.value, props.state, props.record, props.pending));
</script>

<template>
  <CycleStrip
    :active="active"
    :instruction="instruction ? formatInstruction(instruction) : null"
    :detail="detail"
    :intro="t.cycle.x86Intro"
  />
</template>
