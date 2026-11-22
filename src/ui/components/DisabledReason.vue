<script setup lang="ts">
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import TapTooltip from './TapTooltip.vue';

defineProps<{
  /** Why the control in the slot is off; null while it is on. */
  reason: string | null;
  /** The control's name, for a screen reader that lands on it while it is off. */
  label: string;
  /** What the control does, shown while it is on. */
  hint?: string;
  /** Takes the room that is left in its row, as the control inside would. */
  fill?: boolean;
}>();
</script>

<!--
  A disabled button takes no pointer and no focus, so it cannot say why it is off. This wrapper
  can: while the control is off it takes the focus and opens the reason on hover, focus or a tap.
-->
<template>
  <TapTooltip v-slot="{ toggle }">
    <TooltipTrigger as-child>
      <span
        class="inline-flex rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        :class="{ 'min-w-0 flex-1': fill }"
        :role="reason ? 'group' : undefined"
        :aria-label="reason ? `${label}, unavailable` : undefined"
        :tabindex="reason ? 0 : undefined"
        @click="reason && toggle()"
      >
        <slot />
      </span>
    </TooltipTrigger>
    <TooltipContent v-if="reason ?? hint">{{ reason ?? hint }}</TooltipContent>
  </TapTooltip>
</template>
