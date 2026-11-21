<script setup lang="ts">
import { computed } from 'vue';
import { formatHex32, s32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { RegisterName } from '@/core/rv32/registers';
import type { CpuState } from '@/core/rv32/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { rv32Pointer, rv32RegisterChange } from '@/ui/architectureDiffs';
import {
  REGISTER_GROUPS,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  rv32RegisterWritten
} from '@/ui/rv32View';
import { changeTitle, type ValueChange } from '@/ui/stepDiff';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import RollingDigits from './RollingDigits.vue';
import TapTooltip from './TapTooltip.vue';
import ValueDiff from './ValueDiff.vue';

const props = defineProps<{
  state: CpuState;
  /** Register values before the last instruction, used to highlight what changed. */
  previous: Record<RegisterName, number> | null;
  /** The last executed instruction: it marks the registers it wrote without changing them. */
  record: ExecutionRecord | null;
  /** The CPU as the last instruction left it: what that instruction did is told against it. */
  after: ExecutionRecord['before'] | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

function changed(key: RegisterName): boolean {
  return props.previous !== null && props.previous[key] !== props.state.registers[key];
}

/** What the last instruction did to register `index`. */
function change(index: number): ValueChange | null {
  return props.record && props.after && rv32RegisterChange(props.record, props.after, index);
}

/** Where the last instruction sent PC, and whether it jumped. */
const pcMove = computed(
  () => props.record && props.after && rv32Pointer(props.record, props.after)
);
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
    <CardContent class="@container">
      <!-- 31 registers alike to the hardware, grouped as the calling convention uses them. -->
      <div class="grid gap-x-6 gap-y-3 font-mono text-code @min-[34rem]:grid-cols-2">
        <section
          v-for="group in REGISTER_GROUPS"
          :key="group.role"
          :aria-label="ROLE_LABELS[group.role]"
        >
          <h3
            class="mb-1 font-sans text-xs text-muted-foreground"
            :title="ROLE_DESCRIPTIONS[group.role]"
          >
            {{ ROLE_LABELS[group.role] }}
          </h3>
          <div
            v-for="row in group.rows"
            :key="row.key"
            class="grid h-5 grid-cols-[3rem_2.25rem_auto_minmax(0,1fr)] items-center gap-x-2"
          >
            <TapTooltip v-slot="{ toggle }">
              <TooltipTrigger as-child>
                <span
                  tabindex="0"
                  class="cursor-help justify-self-start font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:rounded-xs focus-visible:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  @click="toggle"
                  >{{ row.abi }}</span
                >
              </TooltipTrigger>
              <TooltipContent class="flex-col items-start" side="right">
                <p>{{ row.abi }} is x{{ row.index }}. {{ ROLE_DESCRIPTIONS[group.role] }}.</p>
                <ValueDiff :change="change(row.index)" />
              </TooltipContent>
            </TapTooltip>
            <span class="text-xs text-muted-foreground">x{{ row.index }}</span>
            <ChangeMark
              :on="changed(row.key)"
              :written="rv32RegisterWritten(record, row.index)"
              :tick="tick"
              :title="changeTitle(row.abi, change(row.index))"
              :data-loc="`reg:${row.key}`"
            >
              <RollingDigits :text="formatHex32(state.registers[row.key])" />
            </ChangeMark>
            <span
              class="truncate text-right text-xs text-muted-foreground tabular-nums"
              :title="`${state.registers[row.key]} unsigned`"
            >
              <RollingDigits :text="String(s32(state.registers[row.key]))" />
            </span>
          </div>
        </section>
      </div>
      <div class="mt-3 flex items-center gap-x-2 border-t pt-2 font-mono text-code">
        <TapTooltip v-slot="{ toggle }">
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="w-12 cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:rounded-xs focus-visible:decoration-foreground focus-visible:ring-2 focus-visible:ring-ring"
              @click="toggle"
              >pc</span
            >
          </TooltipTrigger>
          <TooltipContent class="flex-col items-start" side="right">
            <p>
              Program counter: the address of the next instruction. Not one of the 32 registers.
            </p>
            <ValueDiff :change="pcMove" />
          </TooltipContent>
        </TapTooltip>
        <ChangeMark
          :on="changed('pc')"
          :tick="tick"
          :title="changeTitle('pc', pcMove)"
          data-loc="reg:pc"
        >
          <RollingDigits :text="formatHex32(state.registers.pc)" />
        </ChangeMark>
        <span v-if="pcMove?.jump" class="font-sans text-2xs text-pointer">
          jumped from {{ pcMove.before }}
        </span>
      </div>
    </CardContent>
  </Card>
</template>
