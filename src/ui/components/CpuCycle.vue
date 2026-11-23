<script setup lang="ts">
import { computed } from 'vue';
import type { CyclePhase } from '@/core/shared/cycle';
import type { ExecutionRecord } from '@/core/x86/execute';
import { formatInstruction, type Instruction } from '@/core/x86/instructions';
import type { CpuState } from '@/core/x86/state';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import { describeDecode, describeExecute, describeFetch } from '@/ui/x86Explain';
import CycleStrip from './CycleStrip.vue';
import TopicLinkButton from './TopicLinkButton.vue';

const props = defineProps<{
  state: CpuState;
  /** The last executed instruction: with nothing pending, the cycle rests on its execute phase. */
  record: ExecutionRecord | null;
  /** The program line being stepped by phase, if any. */
  pending: PendingInstruction<Instruction> | null;
  /** Why the control topic has nothing to show for the last instruction: null when it has. */
  controlUnavailable: string | null | undefined;
}>();

const active = computed<CyclePhase | null>(
  () => props.pending?.phase ?? (props.record ? 'execute' : null)
);

const instruction = computed(() => props.pending?.instruction ?? props.record?.instruction);

const detail = computed(() => {
  const { pending, record, state } = props;
  if (pending?.phase === 'fetch') return describeFetch(pending.line);
  if (pending) return describeDecode(pending.instruction);
  return record ? describeExecute(record, state) : null;
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
  >
    <template v-if="controlUnavailable !== undefined" #link>
      <TopicLinkButton topic="control" :unavailable="controlUnavailable" />
    </template>
  </CycleStrip>
</template>
