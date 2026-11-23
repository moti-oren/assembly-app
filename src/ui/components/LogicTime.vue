<script setup lang="ts">
import { computed } from 'vue';
import { Pause, Play, RotateCcw, StepBack, StepForward, Timer } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { progressOf, timeSummary } from '@/ui/logicTime';
import type { LogicLens } from '@/ui/useLogicLens';

const props = defineProps<{ lens: LogicLens }>();

const time = computed(() => props.lens.time);
const summary = computed(() =>
  timeSummary(time.value.step.value, time.value.last.value, time.value.worst.value)
);
const progress = computed(() => progressOf(time.value.step.value, time.value.last.value));
const atStart = computed(() => time.value.step.value === 0);
const atEnd = computed(() => time.value.settled.value);

/*
 * A step button stays in place, and keeps the focus, at the end it leads to: one that disabled
 * itself as it was pressed would leave the keyboard on a dead control.
 */
const STEP_CLASS =
  'aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent pointer-coarse:size-11';
</script>

<!-- Time in the adder: a switch that slows it down, and the gate delays to step or play through. -->
<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button
        :variant="time.on.value ? 'default' : 'outline'"
        size="sm"
        class="pointer-coarse:h-11"
        :aria-pressed="time.on.value"
        @click="time.toggle()"
      >
        <Timer />
        Slow down time
      </Button>
      <template v-if="time.on.value">
        <div class="flex items-center gap-1" role="group" aria-label="Gate delays">
          <Button
            variant="ghost"
            size="icon-sm"
            :class="STEP_CLASS"
            aria-label="Back to the moment the inputs changed"
            :aria-disabled="atStart"
            @click="time.rewind()"
          >
            <RotateCcw />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :class="STEP_CLASS"
            aria-label="Back one gate delay"
            :aria-disabled="atStart"
            @click="time.stepBack()"
          >
            <StepBack />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            class="pointer-coarse:size-11"
            :aria-label="time.playing.value ? 'Pause' : 'Play the gate delays'"
            @click="time.playing.value ? time.pause() : time.play()"
          >
            <Pause v-if="time.playing.value" />
            <Play v-else />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :class="STEP_CLASS"
            aria-label="On one gate delay"
            :aria-disabled="atEnd"
            @click="time.stepOn()"
          >
            <StepForward />
          </Button>
        </div>
        <input
          type="range"
          class="timeline h-4 w-24 min-w-0 flex-1 basis-24 cursor-pointer sm:max-w-64 pointer-coarse:h-11"
          :style="{ '--progress': progress }"
          min="0"
          :max="Math.max(time.last.value, 1)"
          :value="time.step.value"
          aria-label="Move through the gate delays"
          :aria-valuetext="summary.position"
          @input="time.seek(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="shrink-0 font-mono text-xs whitespace-nowrap tabular-nums" aria-hidden="true">
          {{ summary.position }}
        </span>
        <Button
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          @click="lens.tryLongestCarry()"
        >
          Longest carry
        </Button>
      </template>
    </div>
    <!-- The region is there before its text is, or the first note would not be announced. -->
    <p
      class="max-w-prose text-sm text-pretty text-muted-foreground"
      :class="{ 'mt-2': time.on.value }"
      aria-live="polite"
    >
      {{ time.on.value ? summary.note : '' }}
    </p>
  </div>
</template>
