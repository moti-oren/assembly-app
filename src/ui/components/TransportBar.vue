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
import { SPEED_LABELS, isRunSpeed, type PendingInstruction, type RunSpeed } from '@/ui/useCpu';

const props = defineProps<{
  finished: boolean;
  /** True while the program is running line by line. */
  running: boolean;
  /** The phase the line at IP has reached when stepping by phase; null between instructions. */
  phase: PendingInstruction['phase'] | null;
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
  <!-- Always on screen, so the program can be driven while watching any part of the CPU. -->
  <footer class="sticky bottom-0 z-(--z-sticky) border-t bg-background/85 backdrop-blur-sm">
    <!-- Next to the buttons that ran the program, so a stop is seen where it was caused. -->
    <p
      v-if="error"
      role="alert"
      class="mx-auto flex max-w-(--page-width) items-start gap-2 px-4 pt-2.5 text-sm text-destructive lg:px-6"
    >
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
    <!-- Each group wraps onto a row of its own rather than pushing the page wider than the screen. -->
    <div
      class="mx-auto flex max-w-(--page-width) flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6"
      role="toolbar"
      aria-label="Program and history controls"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <Button size="sm" class="pointer-coarse:h-11" :disabled="finished" @click="emit('step')">
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
          <span>Run<span class="hidden sm:inline">&nbsp;program</span></span>
        </Button>
        <Select :model-value="speed" @update:model-value="setSpeed">
          <SelectTrigger
            size="sm"
            class="sm:min-w-24 lg:min-w-38 pointer-coarse:data-[size=sm]:h-11"
            :aria-label="`Run speed: ${SPEED_LABELS[speed]}`"
          >
            <!--
              The value alone ("Fast") does not say what it is the value of, so below lg an icon
              says it. On a phone the icon is all there is room for; the label names the value.
            -->
            <SelectValue>
              <Gauge class="text-muted-foreground lg:hidden" aria-hidden="true" />
              <span class="hidden text-muted-foreground lg:inline">Speed:</span>
              <span class="hidden sm:inline">{{ SPEED_LABELS[speed] }}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="(label, value) in SPEED_LABELS" :key="value" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Only where both groups share one row; below lg the second one wraps under the first. -->
      <span class="hidden h-6 w-px bg-border lg:block" aria-hidden="true" />

      <!-- No min-w-0: when its buttons do not fit beside the run controls, it wraps whole. -->
      <div class="flex flex-1 basis-72 items-center gap-1.5">
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
          class="mx-1.5 h-4 w-10 flex-1 sm:w-16 cursor-pointer pointer-coarse:h-11 accent-pointer disabled:cursor-default disabled:opacity-40"
          min="0"
          :max="Math.max(total, 1)"
          :value="executed"
          :disabled="total === 0"
          aria-label="Move through the executed instructions"
          :aria-valuetext="positionText"
          @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
        />
        <span
          class="hidden min-w-16 shrink-0 text-right sm:inline font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums"
          :title="positionText"
          aria-hidden="true"
        >
          {{ executed }} / {{ total }}
        </span>
        <!-- Icons only below xl, so the name moves into the label and a tooltip. -->
        <Tooltip v-for="toggle in toggles" :key="toggle.label">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="pointer-coarse:h-11"
              :class="toggle.shown ? 'bg-secondary' : ''"
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
