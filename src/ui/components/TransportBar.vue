<script setup lang="ts">
import { computed } from 'vue';
import {
  Cable,
  FastForward,
  Footprints,
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
import type { PendingInstruction, RunSpeed } from '@/ui/useCpu';

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
}>();

const SPEED_LABELS: Record<RunSpeed, string> = {
  slow: 'Slow',
  normal: 'Normal',
  fast: 'Fast',
  instant: 'Instant'
};

/** The phase button names what pressing it does next. */
const nextPhase = computed(() =>
  props.phase === null ? 'Fetch' : props.phase === 'fetch' ? 'Decode' : 'Execute'
);

const total = computed(() => props.executed + props.undone);
</script>

<template>
  <!-- Always on screen, so the program can be driven while watching any part of the CPU. -->
  <footer class="sticky bottom-0 z-20 border-t bg-background/85 backdrop-blur-sm">
    <div
      class="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6"
      role="toolbar"
      aria-label="Program and history controls"
    >
      <div class="flex items-center gap-1.5">
        <Button size="sm" :disabled="finished" @click="emit('step')">
          <StepForward />
          Step
        </Button>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="sm"
              class="w-24 justify-start"
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
        <Button v-if="running" variant="outline" size="sm" @click="emit('pause')">
          <Pause />
          Pause
        </Button>
        <Button v-else variant="outline" size="sm" :disabled="finished" @click="emit('run')">
          <FastForward />
          Run
        </Button>
        <Select :model-value="speed" @update:model-value="emit('update:speed', $event as RunSpeed)">
          <SelectTrigger size="sm" class="w-26" aria-label="Run speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="(label, value) in SPEED_LABELS" :key="value" :value="value">
              {{ label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <span class="hidden h-6 w-px bg-border sm:block" aria-hidden="true" />

      <div class="flex min-w-0 flex-1 basis-72 items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
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
          class="mx-1.5 h-4 min-w-0 flex-1 cursor-pointer accent-pointer disabled:cursor-default disabled:opacity-40"
          min="0"
          :max="Math.max(total, 1)"
          :value="executed"
          :disabled="total === 0"
          aria-label="Move through the executed instructions"
          @input="emit('seek', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="w-16 text-right font-mono text-xs text-muted-foreground tabular-nums">
          {{ executed }} / {{ total }}
        </span>
        <Button
          variant="ghost"
          size="sm"
          :class="historyShown ? 'bg-secondary' : ''"
          :aria-pressed="historyShown"
          @click="emit('update:historyShown', !historyShown)"
        >
          <ListOrdered />
          <span class="hidden sm:inline">History</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          :class="devicesShown ? 'bg-secondary' : ''"
          :aria-pressed="devicesShown"
          @click="emit('update:devicesShown', !devicesShown)"
        >
          <Cable />
          <span class="hidden sm:inline">I/O</span>
        </Button>
      </div>
    </div>
  </footer>
</template>
