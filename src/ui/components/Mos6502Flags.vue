<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { FLAG_NAMES, flagBit, type CpuState, type FlagName } from '@/core/mos6502/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { flagReason } from '@/ui/mos6502Alu';
import { FLAG_INFO } from '@/ui/mos6502View';
import { describeFlag } from '@/ui/stepDiff';
import ChangeMark from './ChangeMark.vue';

const props = defineProps<{
  state: CpuState;
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

const isSet = (flag: FlagName) => (props.state.flags & flagBit(flag)) !== 0;
const changed = (flag: FlagName) =>
  props.record !== null && ((props.record.before.flags ^ props.state.flags) & flagBit(flag)) !== 0;

/** Why the last instruction left each flag it set as it is. */
const reasons = computed(() => {
  const record = props.record;
  if (!record) return [];
  return FLAG_NAMES.flatMap((flag) => {
    const reason = flagReason(record, flag);
    if (!reason) return [];
    const was = (record.before.flags & flagBit(flag)) !== 0;
    return [{ flag, outcome: describeFlag(flag, was, isSet(flag)), reason }];
  });
});
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle class="group-data-[size=sm]/card:text-base">Flags</CardTitle>
      <CardDescription>
        P, the status register. Bit 5 always reads 1; B is only in the copy BRK and PHP push.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex gap-1.5 font-mono" role="list" aria-label="The flags in P, bit 7 to bit 0">
        <div
          v-for="flag in FLAG_NAMES"
          :key="flag"
          role="listitem"
          class="flex w-12 flex-col items-center rounded-md border px-1 py-1"
          :title="`${FLAG_INFO[flag].label}: ${FLAG_INFO[flag].description}`"
        >
          <span class="text-xs text-muted-foreground">{{ flag }}</span>
          <ChangeMark :on="changed(flag)" :tick="tick">
            <span class="font-semibold">{{ isSet(flag) ? 1 : 0 }}</span>
          </ChangeMark>
        </div>
      </div>
      <ul v-if="reasons.length" class="flex flex-col gap-0.5 text-xs text-muted-foreground">
        <li v-for="item in reasons" :key="item.flag">
          <span class="font-mono font-semibold text-foreground">{{ item.outcome }}</span>
          because {{ item.reason }}
        </li>
      </ul>
      <p v-else class="text-xs text-muted-foreground">
        {{
          record
            ? `${formatInstruction(record.instruction)} set no flag.`
            : 'Run an instruction to see why it set its flags as it did.'
        }}
      </p>
    </CardContent>
  </Card>
</template>
