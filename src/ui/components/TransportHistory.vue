<script setup lang="ts">
import { computed, nextTick, watch } from 'vue';
import { Redo2, Undo2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isApple } from '@/ui/platform';
import { TRANSPORT_ARIA_KEYS, transportKeys } from '@/ui/transportKeys';
import DisabledReason from './DisabledReason.vue';

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

/** Why each control is off, while it is: a disabled button cannot say so itself. */
const NOTHING_RUN = 'Nothing has run yet';
const NOTHING_UNDONE = 'Nothing has been undone: there is nothing to run again';

/**
 * Undo and Redo are one element while on and another, which says why, while off: a press that
 * turns one off (or on) would drop the focus with the element it was on, so it moves across.
 */
function keepFocus(off: () => boolean, label: string): void {
  const offLabel = `${label}, unavailable`;
  watch(
    off,
    (isOff) => {
      const focused = document.activeElement?.getAttribute('aria-label');
      if (focused !== label && focused !== offLabel) return;
      const wanted = isOff ? offLabel : label;
      void nextTick(() => document.querySelector<HTMLElement>(`[aria-label="${wanted}"]`)?.focus());
    },
    { flush: 'pre' }
  );
}
keepFocus(() => props.executed === 0, 'Undo the last instruction');
keepFocus(() => props.undone === 0, 'Redo the undone instruction');

const positionText = computed(() => `${props.executed} of ${total.value} instructions run`);

/** How far along the history the slider is, for the filled part of its track. */
const progress = computed(() =>
  total.value === 0 ? '0%' : `${(props.executed / total.value) * 100}%`
);
</script>

<!-- Moving through what has run: back, forward again, or straight to any point. -->
<template>
  <DisabledReason
    v-if="parts !== 'rest' && executed === 0"
    :reason="`${NOTHING_RUN}: there is nothing to undo`"
    label="Undo the last instruction"
  >
    <Button
      :variant="framed ? 'outline' : 'ghost'"
      size="icon-sm"
      class="pointer-coarse:size-11"
      :class="{ 'size-11': framed }"
      aria-label="Undo the last instruction"
      disabled
    >
      <Undo2 />
    </Button>
  </DisabledReason>
  <Tooltip v-else-if="parts !== 'rest'">
    <TooltipTrigger as-child>
      <Button
        :variant="framed ? 'outline' : 'ghost'"
        size="icon-sm"
        class="pointer-coarse:size-11"
        :class="{ 'size-11': framed }"
        aria-label="Undo the last instruction"
        :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.undo"
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
    <DisabledReason
      v-if="undone === 0"
      :reason="NOTHING_UNDONE"
      label="Redo the undone instruction"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        class="pointer-coarse:size-11"
        aria-label="Redo the undone instruction"
        disabled
      >
        <Redo2 />
      </Button>
    </DisabledReason>
    <Tooltip v-else>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="pointer-coarse:size-11"
          aria-label="Redo the undone instruction"
          :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.redo"
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
    <!-- The timeline has nothing to move through before an instruction runs, and says so. -->
    <input
      :title="total === 0 ? `${NOTHING_RUN}: there is nothing to move through` : undefined"
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
