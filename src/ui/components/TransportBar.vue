<script setup lang="ts">
import { computed } from 'vue';
import {
  Binary,
  Cable,
  CircleAlert,
  FastForward,
  Footprints,
  Gauge,
  ListOrdered,
  Pause,
  Redo2,
  RotateCcw,
  StepForward,
  Undo2
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SPEED_LABELS, isRunSpeed, type RunSpeed } from '@/ui/runSpeeds';
import type { PendingInstruction } from '@/ui/usePhaseStepping';

const props = defineProps<{
  finished: boolean;
  /** True while the program is running line by line. */
  running: boolean;
  /** The phase the line at IP has reached when stepping by phase; null between instructions. */
  phase: PendingInstruction<unknown>['phase'] | null;
  speed: RunSpeed;
  /** How many instructions have run, and how many undone ones could run again. */
  executed: number;
  undone: number;
  historyShown: boolean;
  devicesShown: boolean;
  bytesShown: boolean;
  /** Why the last step or run stopped, if the CPU raised an error. */
  error: string | null;
}>();

const emit = defineEmits<{
  step: [];
  phase: [];
  run: [];
  pause: [];
  undo: [];
  redo: [];
  /** Asks for a reset of the CPU, which may need confirming. */
  reset: [];
  seek: [position: number];
  'update:speed': [speed: RunSpeed];
  'update:historyShown': [shown: boolean];
  'update:devicesShown': [shown: boolean];
  'update:bytesShown': [shown: boolean];
}>();

/** The select hands back whatever value its item had; only a known speed gets through. */
function setSpeed(value: unknown): void {
  if (isRunSpeed(value)) emit('update:speed', value);
}

/** The phase button names what pressing it does next. */
const nextPhase = computed(() =>
  props.phase === null ? 'Fetch' : props.phase === 'fetch' ? 'Decode' : 'Execute'
);

const total = computed(() => props.executed + props.undone);

const positionText = computed(() => `${props.executed} of ${total.value} instructions run`);

/** How far along the history the slider is, for the filled part of its track. */
const progress = computed(() =>
  total.value === 0 ? '0%' : `${(props.executed / total.value) * 100}%`
);

const toggles = computed(() => [
  {
    label: 'History',
    icon: ListOrdered,
    shown: props.historyShown,
    flip: () => emit('update:historyShown', !props.historyShown)
  },
  {
    label: 'I/O',
    icon: Cable,
    shown: props.devicesShown,
    flip: () => emit('update:devicesShown', !props.devicesShown)
  },
  {
    label: 'Machine code',
    icon: Binary,
    shown: props.bytesShown,
    flip: () => emit('update:bytesShown', !props.bytesShown)
  }
]);
</script>

<template>
  <!--
    The bottom of the shell: with two panes nothing scrolls behind it. On a narrower screen, where
    the page itself scrolls, it stays at the bottom of the window.
  -->
  <footer class="transport">
    <!-- Next to the buttons that ran the program, so a stop is seen where it was caused. -->
    <p
      v-if="error"
      role="alert"
      class="flex items-start gap-2 px-4 pt-2.5 text-sm text-destructive"
    >
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
    <!--
      Three zones: running the program, moving through its history, and the panels on show. Side
      by side where they fit; otherwise each wraps onto a row of its own.
    -->
    <div
      class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto]"
      role="toolbar"
      aria-label="Program and history controls"
    >
      <div class="flex flex-wrap items-center gap-1.5" role="group" aria-label="Run">
        <Button
          size="sm"
          class="quiet-disabled px-3 pointer-coarse:h-11 hover:bg-primary/85 disabled:opacity-100"
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
          <TooltipContent>
            Step one phase of the next line: fetch, decode, then execute
          </TooltipContent>
        </Tooltip>
        <Button
          v-if="running"
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          @click="emit('pause')"
        >
          <Pause />
          Pause
        </Button>
        <Button
          v-else
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          :disabled="finished"
          @click="emit('run')"
        >
          <FastForward />
          Run
        </Button>
        <Select :model-value="speed" @update:model-value="setSpeed">
          <SelectTrigger
            size="sm"
            class="sm:min-w-24 pointer-coarse:data-[size=sm]:h-11"
            :aria-label="`Run speed: ${SPEED_LABELS[speed]}`"
          >
            <!-- The value alone ("Fast") does not say what it is the value of, so an icon says it. -->
            <SelectValue>
              <Gauge class="text-muted-foreground" aria-hidden="true" />
              <span class="hidden sm:inline">{{ SPEED_LABELS[speed] }}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="(label, value) in SPEED_LABELS" :key="value" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="text-muted-foreground pointer-coarse:h-11"
              aria-label="Reset the CPU"
              @click="emit('reset')"
            >
              <RotateCcw />
              <span class="hidden xl:inline">Reset</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Clears registers, flags, memory and the history. The program is kept.
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- No min-w-0 below lg: when it does not fit beside the run controls, it wraps whole. -->
      <div
        class="flex flex-1 basis-56 items-center gap-1 lg:min-w-0 lg:border-x lg:px-4"
        role="group"
        aria-label="History"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              aria-label="Undo the last instruction"
              :disabled="executed === 0"
              @click="emit('undo')"
            >
              <Undo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo the last instruction</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              aria-label="Redo the undone instruction"
              :disabled="undone === 0"
              @click="emit('redo')"
            >
              <Redo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo the undone instruction</TooltipContent>
        </Tooltip>
        <input
          type="range"
          class="timeline mx-2 h-4 w-10 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-40 sm:w-16 pointer-coarse:h-11"
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
      </div>

      <!-- What the page shows, apart from the controls that drive the program. -->
      <div class="toggle-group" role="group" aria-label="Panels">
        <!-- Icons only below xl, so the name moves into the label and a tooltip. -->
        <Tooltip v-for="toggle in toggles" :key="toggle.label">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="px-2.5 pointer-coarse:h-11"
              :aria-label="toggle.label"
              :aria-pressed="toggle.shown"
              @click="toggle.flip"
            >
              <component :is="toggle.icon" />
              <span class="hidden xl:inline">{{ toggle.label }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent class="xl:hidden">{{ toggle.label }}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  </footer>
</template>
