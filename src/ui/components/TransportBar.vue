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
import { isRunSpeed, RUN_SPEED_NAMES, type RunSpeed } from '@/ui/runSpeeds';
import { useLocale } from '@/ui/useLocale';
import type { PendingInstruction } from '@/ui/usePhaseStepping';

const { t } = useLocale();

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

/** The phase button names what pressing it does next, by the phase's own name. */
const nextPhase = computed(() =>
  props.phase === null ? 'Fetch' : props.phase === 'fetch' ? 'Decode' : 'Execute'
);

const total = computed(() => props.executed + props.undone);

const positionText = computed(() => t.value.transport.position(props.executed, total.value));

/** How far along the history the slider is, for the filled part of its track. */
const progress = computed(() =>
  total.value === 0 ? '0%' : `${(props.executed / total.value) * 100}%`
);

const toggles = computed(() => [
  {
    key: 'history',
    label: t.value.transport.history,
    icon: ListOrdered,
    shown: props.historyShown,
    flip: () => emit('update:historyShown', !props.historyShown)
  },
  {
    key: 'devices',
    label: t.value.transport.devices,
    icon: Cable,
    shown: props.devicesShown,
    flip: () => emit('update:devicesShown', !props.devicesShown)
  },
  {
    key: 'bytes',
    label: t.value.transport.machineCode,
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
      class="ui-auto mx-auto flex max-w-(--page-width) items-start gap-2 px-4 pt-2.5 text-sm text-destructive lg:px-6"
    >
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {{ error }}
    </p>
    <!-- Each group wraps onto a row of its own rather than pushing the page wider than the screen. -->
    <div
      class="mx-auto flex max-w-(--page-width) flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6"
      role="toolbar"
      :aria-label="t.transport.controls"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <Button size="sm" class="pointer-coarse:h-11" :disabled="finished" @click="emit('step')">
          <StepForward class="rtl:-scale-x-100" />
          {{ t.transport.step }}
        </Button>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="w-24 justify-start pointer-coarse:h-11"
              :aria-label="t.transport.phaseLabel(nextPhase)"
              :disabled="finished"
              @click="emit('phase')"
            >
              <Footprints />
              {{ nextPhase }}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ t.transport.phaseHint }}
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
          {{ t.transport.pause }}
        </Button>
        <Button
          v-else
          variant="outline"
          size="sm"
          class="pointer-coarse:h-11"
          :disabled="finished"
          @click="emit('run')"
        >
          <FastForward class="rtl:-scale-x-100" />
          <span class="sm:hidden">{{ t.transport.run }}</span>
          <span class="hidden sm:inline">{{ t.transport.runProgram }}</span>
        </Button>
        <Select :model-value="speed" @update:model-value="setSpeed">
          <SelectTrigger
            size="sm"
            class="sm:min-w-24 lg:min-w-38 pointer-coarse:data-[size=sm]:h-11"
            :aria-label="t.transport.speedLabel(t.speeds[speed])"
          >
            <!--
              The value alone ("Fast") does not say what it is the value of, so below lg an icon
              says it. On a phone the icon is all there is room for; the label names the value.
            -->
            <SelectValue>
              <Gauge class="text-muted-foreground lg:hidden" aria-hidden="true" />
              <span class="hidden text-muted-foreground lg:inline">{{ t.transport.speed }}</span>
              <span class="hidden sm:inline">{{ t.speeds[speed] }}</span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="value in RUN_SPEED_NAMES" :key="value" :value="value">
              {{ t.speeds[value] }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Only where both groups share one row; below lg the second one wraps under the first. -->
      <span class="hidden h-6 w-px bg-border lg:block" aria-hidden="true" />

      <!-- No min-w-0: when its buttons do not fit beside the run controls, it wraps whole. -->
      <div class="flex flex-1 basis-72 items-center gap-1.5">
        <!-- With the history, since a reset clears it too. -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="pointer-coarse:h-11"
              :aria-label="t.transport.resetLabel"
              @click="emit('reset')"
            >
              <RotateCcw />
              <span class="hidden xl:inline">{{ t.transport.reset }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ t.transport.resetHint }}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              :aria-label="t.transport.undo"
              :disabled="executed === 0"
              @click="emit('undo')"
            >
              <Undo2 class="rtl:-scale-x-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t.transport.undo }}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="pointer-coarse:size-11"
              :aria-label="t.transport.redo"
              :disabled="undone === 0"
              @click="emit('redo')"
            >
              <Redo2 class="rtl:-scale-x-100" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ t.transport.redo }}</TooltipContent>
        </Tooltip>
        <input
          type="range"
          dir="ltr"
          class="timeline mx-1.5 h-4 w-10 flex-1 cursor-pointer disabled:cursor-default disabled:opacity-40 sm:w-16 pointer-coarse:h-11"
          :style="{ '--progress': progress }"
          min="0"
          :max="Math.max(total, 1)"
          :value="executed"
          :disabled="total === 0"
          :aria-label="t.transport.seek"
          :aria-valuetext="positionText"
          @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
        />
        <span
          class="hidden min-w-16 shrink-0 text-end sm:inline font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums"
          :title="positionText"
          aria-hidden="true"
        >
          {{ executed }} / {{ total }}
        </span>
      </div>

      <span class="hidden h-6 w-px bg-border lg:block" aria-hidden="true" />

      <!-- What the page shows, apart from the controls that drive the program. -->
      <div class="flex items-center gap-1.5" role="group" :aria-label="t.transport.panels">
        <!-- Icons only below xl, so the name moves into the label and a tooltip. -->
        <Tooltip v-for="toggle in toggles" :key="toggle.key">
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
