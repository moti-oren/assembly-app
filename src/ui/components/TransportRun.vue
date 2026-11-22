<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FastForward, Footprints, Pause, RotateCcw, StepForward } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { TRANSPORT_ARIA_KEYS } from '@/ui/transportKeys';
import { blockedReason, nextPhaseLabel } from '@/ui/transportLabels';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import DisabledReason from './DisabledReason.vue';

const props = defineProps<{
  finished: boolean;
  /** True when the program has no lines, so there is nothing to step or run. */
  empty: boolean;
  /** True while the program is running line by line. */
  running: boolean;
  /** The phase the line at IP has reached when stepping by phase; null between instructions. */
  phase: PendingInstruction<unknown>['phase'] | null;
  /** On a phone: Step takes the room that is left, and Run is its icon alone. */
  compact?: boolean;
}>();

const emit = defineEmits<{ step: []; phase: []; run: []; pause: []; again: [] }>();

const nextPhase = computed(() => nextPhaseLabel(props.phase));

/** A program that ran to its end: running it again is the one way forward. */
const ended = computed(() => props.finished && !props.empty);

const blocked = computed(() => blockedReason(props.finished, props.empty));

const again = ref<{ $el: HTMLElement } | null>(null);
const step = ref<{ $el: HTMLElement } | null>(null);

// Step and Run again take each other's place, which removes the one that was pressed: focus
// follows to the other instead of dropping to the page. `pre` reads the focus before the redraw.
// The group is TransportBar's, which marks it with `data-transport-run`.
watch(
  ended,
  (isEnded) => {
    if (!document.activeElement?.closest('[data-transport-run]')) return;
    void nextTick(() => (isEnded ? again : step).value?.$el.focus());
  },
  { flush: 'pre' }
);
</script>

<!-- The buttons that run the program: a line, a phase of a line, or all of it. -->
<template>
  <Button
    v-if="ended"
    ref="again"
    size="sm"
    class="px-3 pointer-coarse:h-11 hover:bg-primary/85"
    :class="{ 'h-11 min-w-0 flex-1': compact }"
    :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.run"
    @click="emit('again')"
  >
    <RotateCcw />
    Run again
  </Button>
  <!-- While the program runs, the filled button is the one that stops it: Step steps back. -->
  <DisabledReason v-else :reason="blocked" label="Step" :fill="compact">
    <Button
      ref="step"
      :variant="running ? 'outline' : 'default'"
      size="sm"
      class="quiet-disabled w-full px-3 pointer-coarse:h-11 disabled:opacity-100"
      :class="[running ? 'text-muted-foreground' : 'hover:bg-primary/85', { 'h-11': compact }]"
      :disabled="finished"
      :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.step"
      @click="emit('step')"
    >
      <StepForward />
      Step
    </Button>
  </DisabledReason>
  <DisabledReason
    :reason="blocked"
    :label="nextPhase.spoken"
    hint="Step one phase of the next line: fetch, decode, then execute"
  >
    <Button
      variant="outline"
      size="sm"
      class="quiet-disabled justify-start pointer-coarse:h-11 disabled:opacity-100"
      :class="compact ? 'h-11 w-25 gap-1.5 px-2.5' : 'w-34'"
      :aria-label="nextPhase.spoken"
      :disabled="finished"
      @click="emit('phase')"
    >
      <Footprints v-if="!compact" />
      <span v-if="compact" class="text-muted-foreground tabular-nums">{{ nextPhase.place }}</span>
      {{ nextPhase.name }}
      <span v-if="!compact" class="text-muted-foreground tabular-nums"
        >· {{ nextPhase.place }}</span
      >
    </Button>
  </DisabledReason>
  <!-- One button for Run and Pause: it changes its face, so the focus on it is never lost. -->
  <DisabledReason :reason="running ? null : blocked" label="Run">
    <Button
      :variant="running ? 'default' : 'outline'"
      size="sm"
      class="quiet-disabled pointer-coarse:h-11 disabled:opacity-100"
      :class="{ 'size-11': compact, 'hover:bg-primary/85': running }"
      :aria-label="running ? 'Pause' : 'Run'"
      :aria-keyshortcuts="TRANSPORT_ARIA_KEYS.run"
      :disabled="!running && finished"
      @click="running ? emit('pause') : emit('run')"
    >
      <Pause v-if="running" />
      <FastForward v-else />
      <span :class="{ 'sr-only': compact }">{{ running ? 'Pause' : 'Run' }}</span>
    </Button>
  </DisabledReason>
</template>
