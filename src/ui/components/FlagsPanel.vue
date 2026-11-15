<script setup lang="ts">
import { FLAG_BITS, FLAG_INFO, FLAG_NAMES, type FlagName } from '@/core/flags';
import { formatHex } from '@/core/numbers';
import type { CpuState } from '@/core/state';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const props = defineProps<{
  state: CpuState;
  /** FLAGS before the last instruction, used to highlight what changed. */
  previous: number | null;
}>();

function isSet(flag: FlagName): boolean {
  return (props.state.flags & (1 << FLAG_BITS[flag])) !== 0;
}

function changed(flag: FlagName): boolean {
  return (
    props.previous !== null && ((props.previous ^ props.state.flags) & (1 << FLAG_BITS[flag])) !== 0
  );
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
        <Tooltip v-for="flag in FLAG_NAMES" :key="flag">
          <TooltipTrigger as-child>
            <div
              tabindex="0"
              class="flex cursor-help flex-col gap-0.5 rounded-md border px-2 py-1.5 xl:px-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              :class="[
                changed(flag)
                  ? 'border-transparent bg-changed text-changed-foreground'
                  : isSet(flag)
                    ? 'border-foreground/20 bg-secondary'
                    : 'border-border'
              ]"
              :aria-label="`${FLAG_INFO[flag].label} flag is ${isSet(flag) ? 1 : 0}`"
            >
              <div class="flex items-baseline justify-between font-mono">
                <span class="text-sm font-semibold">{{ flag }}</span>
                <span
                  class="text-sm"
                  :class="isSet(flag) ? 'font-bold' : 'text-muted-foreground/70'"
                  >{{ isSet(flag) ? 1 : 0 }}</span
                >
              </div>
              <span
                class="truncate text-[11px] leading-tight tracking-tight"
                :class="changed(flag) ? 'opacity-80' : 'text-muted-foreground'"
                >{{ FLAG_INFO[flag].label }}</span
              >
            </div>
          </TooltipTrigger>
          <TooltipContent>{{ FLAG_INFO[flag].description }}</TooltipContent>
        </Tooltip>
      </div>
    </CardContent>
  </Card>
</template>
