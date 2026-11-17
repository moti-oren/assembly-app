<script setup lang="ts">
import type { ExecutionRecord } from '@/core/execute';
import { FLAG_INFO, FLAG_NAMES, isFlagSet, type FlagName } from '@/core/flags';
import { formatHex } from '@/core/numbers';
import type { CpuState } from '@/core/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FlagReason from './FlagReason.vue';
import RollingDigits from './RollingDigits.vue';

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
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Flags</CardTitle>
      <CardAction>
        <Badge variant="outline" class="font-mono text-muted-foreground">
          FLAGS {{ formatHex(state.flags, 16) }}h
        </Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-3 gap-1.5 sm:grid-cols-5 xl:grid-cols-9">
        <!-- A popover, not a tooltip: the explanation is long, and it must open on touch too. -->
        <Popover v-for="flag in FLAG_NAMES" :key="flag">
          <PopoverTrigger as-child>
            <button
              type="button"
              class="change-mark flex flex-col text-left gap-0.5 rounded-md border px-2 py-1.5 outline-none xl:px-1.5 focus-visible:ring-3 focus-visible:ring-ring/50"
              :class="[
                changed(flag)
                  ? 'border-transparent bg-changed text-changed-foreground'
                  : isSet(flag)
                    ? 'border-foreground/20 bg-secondary'
                    : 'border-border'
              ]"
              :aria-label="`${FLAG_INFO[flag].label} flag is ${isSet(flag) ? 1 : 0}. Show why`"
            >
              <span v-if="changed(flag)" :key="tick" class="change-flash" aria-hidden="true" />
              <div class="flex items-baseline justify-between font-mono">
                <span class="text-sm font-semibold">{{ flag }}</span>
                <span
                  class="text-sm"
                  :class="isSet(flag) ? 'font-bold' : 'text-muted-foreground/70'"
                  ><RollingDigits effect="flip" :text="isSet(flag) ? '1' : '0'"
                /></span>
              </div>
              <span
                class="truncate text-[11px] leading-tight tracking-tight"
                :class="changed(flag) ? 'opacity-80' : 'text-muted-foreground'"
                >{{ FLAG_INFO[flag].label }}</span
              >
            </button>
          </PopoverTrigger>
          <PopoverContent><FlagReason :flag="flag" :record="record" /></PopoverContent>
        </Popover>
      </div>
    </CardContent>
  </Card>
</template>
