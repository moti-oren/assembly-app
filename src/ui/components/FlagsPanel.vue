<script setup lang="ts">
import type { ExecutionRecord } from '@/core/x86/execute';
import { FLAG_INFO, FLAG_NAMES, isFlagSet, type FlagName } from '@/core/x86/flags';
import { formatHex } from '@/core/shared/numbers';
import type { CpuState } from '@/core/x86/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import FlagReason from './FlagReason.vue';
import RollingDigits from './RollingDigits.vue';
import { useLocale } from '@/ui/useLocale';

const props = defineProps<{
  state: CpuState;
  /** FLAGS before the last instruction, used to highlight what changed. */
  previous: number | null;
  /** The last executed instruction: each flag's tooltip explains what it did to the flag. */
  record: ExecutionRecord | null;
  /** Number of instructions executed so far; replays the change flash. */
  tick: number;
}>();

function isSet(flag: FlagName): boolean {
  return isFlagSet(props.state.flags, flag);
}

function changed(flag: FlagName): boolean {
  return props.previous !== null && isFlagSet(props.previous ^ props.state.flags, flag);
}
const { t } = useLocale();
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ t.flags.title }}</CardTitle>
      <CardAction>
        <Badge variant="outline" class="font-mono text-muted-foreground">
          FLAGS {{ formatHex(state.flags, 16) }}h
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-5 xl:grid-cols-9">
        <Tooltip v-for="flag in FLAG_NAMES" :key="flag">
          <TooltipTrigger as-child>
            <div
              tabindex="0"
              class="change-mark flex cursor-help flex-col gap-0.5 rounded-md border px-2 py-1.5 outline-none xl:px-1.5 focus-visible:ring-3 focus-visible:ring-ring/50"
              :class="[
                changed(flag)
                  ? 'border-transparent bg-changed text-changed-foreground'
                  : isSet(flag)
                    ? 'border-foreground/20 bg-secondary'
                    : 'border-border'
              ]"
              :aria-label="t.flags.value(FLAG_INFO[flag].label, isSet(flag) ? 1 : 0)"
            >
              <span v-if="changed(flag)" :key="tick" class="change-flash" aria-hidden="true" />
              <div class="flex items-baseline justify-between font-mono">
                <span class="text-sm font-semibold">{{ flag }}</span>
                <span class="text-sm" :class="isSet(flag) ? 'font-bold' : 'text-muted-foreground'"
                  ><RollingDigits effect="flip" :text="isSet(flag) ? '1' : '0'"
                /></span>
              </div>
              <span
                class="truncate text-2xs leading-tight tracking-tight"
                :class="changed(flag) ? 'opacity-80' : 'text-muted-foreground'"
                >{{ FLAG_INFO[flag].label }}</span
              >
            </div>
          </TooltipTrigger>
          <TooltipContent><FlagReason :flag="flag" :record="record" /></TooltipContent>
        </Tooltip>
      </div>
    </CardContent>
  </Card>
</template>
