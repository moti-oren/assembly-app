<script setup lang="ts">
import { computed } from 'vue';
import { FastForward, Footprints, Pause, StepForward } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PendingInstruction } from '@/ui/usePhaseStepping';

const props = defineProps<{
  finished: boolean;
  /** True while the program is running line by line. */
  running: boolean;
  /** The phase the line at IP has reached when stepping by phase; null between instructions. */
  phase: PendingInstruction<unknown>['phase'] | null;
  /** On a phone: Step takes the room that is left, and Run is its icon alone. */
  compact?: boolean;
}>();

const emit = defineEmits<{ step: []; phase: []; run: []; pause: [] }>();

/** The phase button names what pressing it does next. */
const nextPhase = computed(() =>
  props.phase === null ? 'Fetch' : props.phase === 'fetch' ? 'Decode' : 'Execute'
);
</script>

<!-- The buttons that run the program: a line, a phase of a line, or all of it. -->
<template>
  <Button
    size="sm"
    class="quiet-disabled px-3 pointer-coarse:h-11 hover:bg-primary/85 disabled:opacity-100"
    :class="{ 'min-w-0 flex-1': compact }"
    :disabled="finished"
    @click="emit('step')"
  >
    <StepForward />
    Step
  </Button>
  <Tooltip>
    <TooltipTrigger as-child>
      <Button
        variant="outline"
        size="sm"
        class="w-24 justify-start pointer-coarse:h-11"
        :aria-label="`Step: ${nextPhase}`"
        :disabled="finished"
        @click="emit('phase')"
      >
        <Footprints />
        {{ nextPhase }}
      </Button>
    </TooltipTrigger>
    <TooltipContent>Step one phase of the next line: fetch, decode, then execute</TooltipContent>
  </Tooltip>
  <Button
    v-if="running"
    variant="outline"
    size="sm"
    class="pointer-coarse:h-11"
    :class="{ 'pointer-coarse:w-11': compact }"
    aria-label="Pause"
    @click="emit('pause')"
  >
    <Pause />
    <span :class="{ 'sr-only': compact }">Pause</span>
  </Button>
  <Button
    v-else
    variant="outline"
    size="sm"
    class="pointer-coarse:h-11"
    :class="{ 'pointer-coarse:w-11': compact }"
    aria-label="Run"
    :disabled="finished"
    @click="emit('run')"
  >
    <FastForward />
    <span :class="{ 'sr-only': compact }">Run</span>
  </Button>
</template>
