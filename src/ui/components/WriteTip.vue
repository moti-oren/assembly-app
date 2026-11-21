<script setup lang="ts">
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { changeTitle, describeWrite, type ValueChange } from '@/ui/stepDiff';
import TapTooltip from './TapTooltip.vue';
import ValueDiff from './ValueDiff.vue';

defineProps<{
  /** What the last step wrote here; without a write, the content is shown as it is. */
  change: ValueChange | null;
  /** Where it is, e.g. `$0200`. */
  label: string;
}>();
</script>

<!--
  A value the last step wrote, which a hover, a tap or the keyboard inspects: what it was, what it
  is. A screen reader hears both values in the button's name.
-->
<template>
  <TapTooltip v-if="change" v-slot="{ toggle }">
    <TooltipTrigger as-child>
      <button
        type="button"
        class="cursor-help rounded-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        :aria-label="describeWrite(label, change)"
        :title="changeTitle(label, change)"
        @click="toggle"
      >
        <slot />
      </button>
    </TooltipTrigger>
    <TooltipContent class="flex-col items-start">
      <p class="font-mono">{{ label }}, written by the last instruction</p>
      <ValueDiff :change="change" />
    </TooltipContent>
  </TapTooltip>
  <slot v-else />
</template>
