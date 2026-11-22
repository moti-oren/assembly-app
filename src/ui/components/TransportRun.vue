<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { FastForward, Footprints, Pause, RotateCcw, StepForward } from '@lucide/vue';
import { Button } from '@/components/ui/button';
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
    @click="emit('again')"
  >
    <RotateCcw />
    Run again
  </Button>
  <DisabledReason v-else :reason="blocked" label="Step" :fill="compact">
    <Button
      ref="step"
      size="sm"
      class="quiet-disabled w-full px-3 pointer-coarse:h-11 hover:bg-primary/85 disabled:opacity-100"
      :class="{ 'h-11': compact }"
      :disabled="finished"
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
      class="justify-start pointer-coarse:h-11"
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
  <Button
    v-if="running"
    variant="outline"
    size="sm"
    class="pointer-coarse:h-11"
    :class="{ 'size-11': compact }"
    aria-label="Pause"
    @click="emit('pause')"
  >
    <Pause />
    <span :class="{ 'sr-only': compact }">Pause</span>
  </Button>
  <DisabledReason v-else :reason="blocked" label="Run">
    <Button
      variant="outline"
      size="sm"
      class="pointer-coarse:h-11"
      :class="{ 'size-11': compact }"
      aria-label="Run"
      :disabled="finished"
      @click="emit('run')"
    >
      <FastForward />
      <span :class="{ 'sr-only': compact }">Run</span>
    </Button>
  </DisabledReason>
</template>
