<script setup lang="ts">
import { formatHex32, s32 } from '@/core/rv32/bits';
import type { ExecutionRecord } from '@/core/rv32/execute';
import type { RegisterName } from '@/core/rv32/registers';
import type { CpuState } from '@/core/rv32/state';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { REGISTER_GROUPS, wasWritten } from '@/ui/rv32View';
import ChangeMark from './ChangeMark.vue';
import CpuViewToggle from './CpuViewToggle.vue';
import RollingDigits from './RollingDigits.vue';
import { useLocale } from '@/ui/useLocale';

const { t } = useLocale();

const props = defineProps<{
  state: CpuState;
  /** Register values before the last instruction, used to highlight what changed. */
  previous: Record<RegisterName, number> | null;
  /** The last executed instruction: it marks the registers it wrote without changing them. */
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

function changed(key: RegisterName): boolean {
  return props.previous !== null && props.previous[key] !== props.state.registers[key];
}
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.registers.title }}</CardTitle>
      <CardAction class="flex items-center gap-3 text-xs text-muted-foreground">
        <span class="hidden items-center gap-1.5 sm:flex">
          <span class="inline-block size-2.5 rounded-xs bg-changed" aria-hidden="true" />
          {{ t.registers.changed }}
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
          :aria-label="t.rv32.roles[group.role]"
        >
          <h3
            class="mb-1 font-sans text-xs text-muted-foreground"
            :title="t.rv32.roleHints[group.role]"
          >
            {{ t.rv32.roles[group.role] }}
          </h3>
          <div
            v-for="row in group.rows"
            :key="row.key"
            class="grid h-5 grid-cols-[3rem_2.25rem_auto_minmax(0,1fr)] items-center gap-x-2"
          >
            <span class="font-semibold">{{ row.abi }}</span>
            <span class="text-xs text-muted-foreground">x{{ row.index }}</span>
            <ChangeMark
              :on="changed(row.key)"
              :written="wasWritten(record, row.index)"
              :tick="tick"
              :data-loc="`reg:${row.key}`"
            >
              <RollingDigits :text="formatHex32(state.registers[row.key])" />
            </ChangeMark>
            <span
              class="truncate text-right text-xs text-muted-foreground tabular-nums"
              :title="t.rv32.unsigned(state.registers[row.key])"
            >
              <RollingDigits :text="String(s32(state.registers[row.key]))" />
            </span>
          </div>
        </section>
      </div>
      <div class="mt-3 flex items-center gap-x-2 border-t pt-2 font-mono text-code">
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              tabindex="0"
              class="w-12 cursor-help font-semibold underline decoration-border decoration-dotted underline-offset-4 outline-none focus-visible:decoration-foreground"
              >pc</span
            >
          </TooltipTrigger>
          <TooltipContent side="right">
            {{ t.rv32.pcHint }}
          </TooltipContent>
        </Tooltip>
        <ChangeMark :on="changed('pc')" :tick="tick" data-loc="reg:pc">
          <RollingDigits :text="formatHex32(state.registers.pc)" />
        </ChangeMark>
      </div>
    </CardContent>
  </Card>
</template>
