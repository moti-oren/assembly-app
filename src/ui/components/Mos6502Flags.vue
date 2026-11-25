<script setup lang="ts">
import { computed } from 'vue';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction } from '@/core/mos6502/instructions';
import { FLAG_NAMES, flagBit, type CpuState, type FlagName } from '@/core/mos6502/state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { flagReason } from '@/ui/mos6502Alu';
import { FLAG_INFO, P_LAYOUT, pByteText } from '@/ui/mos6502View';
import { describeFlag } from '@/ui/stepDiff';
import ChangeMark from './ChangeMark.vue';
import TapTooltip from './TapTooltip.vue';

const props = defineProps<{
  state: CpuState;
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

const isSet = (flag: FlagName) => (props.state.flags & flagBit(flag)) !== 0;
const pValue = computed(() => pByteText(props.state.flags));
const changed = (flag: FlagName) =>
  props.record !== null && ((props.record.before.flags ^ props.state.flags) & flagBit(flag)) !== 0;

/** Why the last instruction left each flag it set as it is. */
const reasons = computed(() => {
  const record = props.record;
  if (!record) return [];
  return FLAG_NAMES.flatMap((flag) => {
    const reason = flagReason(record, flag, props.state);
    if (!reason) return [];
    const was = (record.before.flags & flagBit(flag)) !== 0;
    return [{ flag, outcome: describeFlag(flag, was, isSet(flag)), reason }];
  });
});
</script>

<template>
  <Card size="sm">
    <CardHeader>
      <CardTitle role="heading" aria-level="2" class="group-data-[size=sm]/card:text-base"
        >Flags
        <span class="ml-1 font-mono text-sm font-normal text-muted-foreground"
          >P = {{ pValue }}</span
        ></CardTitle
      >
      <CardDescription>
        P, the status register. Bit 5 always reads 1; B is only in the copy BRK and PHP push.
      </CardDescription>
    </CardHeader>
    <CardContent class="flex flex-col gap-3">
      <div class="flex gap-1.5 font-mono" role="list" aria-label="The flags in P, bit 7 to bit 0">
        <!-- What a flag means is part of the lesson: focus or a tap shows it, not a hover alone. -->
        <template v-for="cell in P_LAYOUT" :key="typeof cell === 'string' ? cell : cell.bit">
          <!-- The two bits of P that are not flags, quiet, so all eight are in their places. -->
          <div
            v-if="typeof cell !== 'string'"
            role="listitem"
            class="flex w-12 flex-col items-center rounded-md border border-dashed px-1 py-1 text-muted-foreground pointer-coarse:min-h-11"
            :aria-label="`Bit ${cell.bit}: ${cell.description}`"
            :title="cell.description"
          >
            <span class="text-xs">{{ cell.label }}</span>
            <span>{{ cell.value }}</span>
          </div>
          <TapTooltip v-else v-slot="{ toggle }">
            <TooltipTrigger as-child>
              <div
                role="listitem"
                tabindex="0"
                class="flex w-12 cursor-help flex-col items-center rounded-md border px-1 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
                :aria-label="`${cell}, ${FLAG_INFO[cell].label}: ${isSet(cell) ? 1 : 0}. ${FLAG_INFO[cell].description}`"
                @click="toggle"
              >
                <span class="text-xs text-muted-foreground">{{ cell }}</span>
                <ChangeMark :on="changed(cell)" :tick="tick">
                  <span class="font-semibold">{{ isSet(cell) ? 1 : 0 }}</span>
                </ChangeMark>
              </div>
            </TooltipTrigger>
            <TooltipContent
              >{{ FLAG_INFO[cell].label }}: {{ FLAG_INFO[cell].description }}</TooltipContent
            >
          </TapTooltip>
        </template>
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
