<script setup lang="ts">
import { ref } from 'vue';
import { CircleAlert, RotateCcw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { RunSpeed } from '@/ui/runSpeeds';
import { useLayoutMode } from '@/ui/useLayoutMode';
import type { PendingInstruction } from '@/ui/usePhaseStepping';
import TransportHistory from './TransportHistory.vue';
import TransportMore from './TransportMore.vue';
import TransportPanels from './TransportPanels.vue';
import TransportRun from './TransportRun.vue';
import TransportSpeed from './TransportSpeed.vue';

defineProps<{
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

const mode = useLayoutMode();
const moreOpen = ref(false);

/** From the More popover: it closes first, since a reset may open a dialog to confirm. */
function resetFromMore(): void {
  moreOpen.value = false;
  emit('reset');
}
</script>

<template>
  <!-- The bottom of the shell: nothing scrolls behind it. -->
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
      Three zones: running the program, moving through its history, and the panels on show. One
      row at every width: what a narrower bar has no room for moves behind its More button.
    -->
    <div
      class="flex items-center gap-x-5 px-4 py-2 max-md:gap-x-1.5 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto]"
      role="toolbar"
      aria-label="Program and history controls"
    >
      <div
        class="flex items-center gap-1.5"
        :class="{ 'min-w-0 flex-1': mode === 'phone' }"
        role="group"
        aria-label="Run"
      >
        <TransportRun
          :finished="finished"
          :running="running"
          :phase="phase"
          :compact="mode === 'phone'"
          @step="emit('step')"
          @phase="emit('phase')"
          @run="emit('run')"
          @pause="emit('pause')"
        />
        <TransportSpeed
          v-if="mode !== 'phone'"
          :speed="speed"
          @update:speed="emit('update:speed', $event)"
        />
        <Tooltip v-if="mode === 'desktop'">
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

      <div
        class="flex items-center gap-1 lg:border-x lg:px-4"
        :class="{ 'min-w-0 flex-1': mode !== 'phone' }"
        role="group"
        aria-label="History"
      >
        <TransportHistory
          :executed="executed"
          :undone="undone"
          :parts="mode === 'phone' ? 'undo' : 'all'"
          @undo="emit('undo')"
          @redo="emit('redo')"
          @seek="emit('seek', $event)"
        />
      </div>

      <TransportPanels
        v-if="mode === 'desktop'"
        :history-shown="historyShown"
        :devices-shown="devicesShown"
        :bytes-shown="bytesShown"
        @update:history-shown="emit('update:historyShown', $event)"
        @update:devices-shown="emit('update:devicesShown', $event)"
        @update:bytes-shown="emit('update:bytesShown', $event)"
      />
      <TransportMore v-else v-model:open="moreOpen">
        <div
          v-if="mode === 'phone'"
          class="flex items-center gap-1"
          role="group"
          aria-label="History"
        >
          <TransportHistory
            :executed="executed"
            :undone="undone"
            parts="rest"
            @redo="emit('redo')"
            @seek="emit('seek', $event)"
          />
        </div>
        <div class="flex items-center justify-between gap-2">
          <TransportSpeed
            v-if="mode === 'phone'"
            :speed="speed"
            named
            @update:speed="emit('update:speed', $event)"
          />
          <Button
            variant="outline"
            size="sm"
            class="ml-auto pointer-coarse:h-11"
            @click="resetFromMore"
          >
            <RotateCcw />
            Reset the CPU
          </Button>
        </div>
        <TransportPanels
          named
          :history-shown="historyShown"
          :devices-shown="devicesShown"
          :bytes-shown="bytesShown"
          @update:history-shown="emit('update:historyShown', $event)"
          @update:devices-shown="emit('update:devicesShown', $event)"
          @update:bytes-shown="emit('update:bytesShown', $event)"
        />
      </TransportMore>
    </div>
  </footer>
</template>
