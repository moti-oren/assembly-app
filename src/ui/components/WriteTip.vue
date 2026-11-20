<script setup lang="ts">
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { ValueChange } from '@/ui/stepDiff';
import TapTooltip from './TapTooltip.vue';
import ValueDiff from './ValueDiff.vue';

defineProps<{
  /** What the last step wrote here; without a write, the content is shown as it is. */
  change: ValueChange | null;
  /** Where it is, e.g. `$0200`. */
  label: string;
}>();
</script>

<!-- A value the last step wrote, which a hover or a tap inspects: what it was, what it is. -->
<template>
  <TapTooltip v-if="change" v-slot="{ toggle }">
    <TooltipTrigger as-child>
      <span class="cursor-help" @click="toggle"><slot /></span>
    </TooltipTrigger>
    <TooltipContent class="flex-col items-start">
      <p class="font-mono">{{ label }}, written by the last instruction</p>
      <ValueDiff :change="change" />
    </TooltipContent>
  </TapTooltip>
  <slot v-else />
</template>
