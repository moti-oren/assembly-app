<script setup lang="ts">
import { computed } from 'vue';
import { Redo2, Undo2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApple } from '@/ui/platform';
import { TRANSPORT_ARIA_KEYS, transportKeys } from '@/ui/transportKeys';

const props = defineProps<{
  /** How many instructions have run, and how many undone ones could run again. */
  executed: number;
  undone: number;
  /**
   * A phone's bar has room for Undo alone; the rest (Redo and the timeline) is behind its More
   * button.
   */
  parts?: 'all' | 'undo' | 'rest';
  /** On a phone Undo is framed like the bar's other buttons, at their height. */
  framed?: boolean;
}>();

const emit = defineEmits<{ undo: []; redo: []; seek: [position: number] }>();

const keys = transportKeys(isApple);

const total = computed(() => props.executed + props.undone);

const positionText = computed(() => `${props.executed} of ${total.value} instructions run`);

/** How far along the history the slider is, for the filled part of its track. */
const progress = computed(() =>
  total.value === 0 ? '0%' : `${(props.executed / total.value) * 100}%`
);
</script>

<!-- Moving through what has run: back, forward again, or straight to any point. -->
<template>
  <Tooltip v-if="parts !== 'rest'">
    <TooltipTrigger as-child>
      <Button
        :variant="framed ? 'outline' : 'ghost'"
        size="icon-sm"
        class="pointer-coarse:size-11"
        :class="{ 'size-11': framed }"
        aria-label="Undo the last instruction"
        :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.undo"
        :disabled="executed === 0"
        @click="emit('undo')"
      >
        <Undo2 />
      </Button>
    </TooltipTrigger>
    <TooltipContent>
      Undo the last instruction
      <KbdGroup
        ><Kbd v-for="key in keys.undo" :key="key">{{ key }}</Kbd></KbdGroup
      >
    </TooltipContent>
  </Tooltip>
  <template v-if="parts !== 'undo'">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="pointer-coarse:size-11"
          aria-label="Redo the undone instruction"
          :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.redo"
          :disabled="undone === 0"
          @click="emit('redo')"
        >
          <Redo2 />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Redo the undone instruction
        <KbdGroup
          ><Kbd v-for="key in keys.redo" :key="key">{{ key }}</Kbd></KbdGroup
        >
      </TooltipContent>
    </Tooltip>
    <input
      type="range"
      class="timeline mx-2 h-4 w-10 min-w-0 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-40 sm:w-16 pointer-coarse:h-11"
      :style="{ '--progress': progress }"
      min="0"
      :max="Math.max(total, 1)"
      :value="executed"
      :disabled="total === 0"
      aria-label="Move through the executed instructions"
      :aria-valuetext="positionText"
      @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
    />
    <span
      class="min-w-14 shrink-0 text-right font-mono text-xs whitespace-nowrap text-muted-foreground"
      :title="positionText"
      aria-hidden="true"
    >
      <span class="text-foreground">{{ executed }}</span> / {{ total }}
    </span>
  </template>
</template>
