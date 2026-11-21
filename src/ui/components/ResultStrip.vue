<script setup lang="ts">
import { computed } from 'vue';
import { CYCLE_PHASES, type CyclePhase } from '@/core/shared/cycle';
import { TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { describeChange, leftOut, STRIP_ENTRIES, type DiffEntry } from '@/ui/stepDiff';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import DiffChip from './DiffChip.vue';
import TapTooltip from './TapTooltip.vue';

const props = defineProps<{
  /** The last executed instruction, as written; null before the first one. */
  ran: string | null;
  /** Everything it wrote or moved, most important first. */
  changes: DiffEntry[];
  /** Memory writes past the ones in `changes`, only counted. */
  omitted: number;
  /** True while the program runs on a timer. */
  running: boolean;
  /** The phase the line at the instruction pointer has reached, when stepping by phase. */
  phase?: CyclePhase | null;
  /** The label of the line that runs next; null at the end of the program. */
  next?: string | null;
}>();

const { show } = useWorkbenchView();

const total = computed(() => props.changes.length + props.omitted);

/** True once the line being stepped is at or past the phase at `index`. */
function reached(index: number): boolean {
  return !!props.phase && CYCLE_PHASES.indexOf(props.phase) >= index;
}
</script>

<template>
  <!--
    Where the CPU is not in sight (a phone on another view, a tablet under its drawer), this keeps
    the last result there. It has a fixed height from the start, so nothing drops when the first
    result comes. A tap goes to the CPU; a tap on +N lists every change instead. While a program
    runs, a screen reader is not told every step: the region is busy, and it hears the result once
    the run stops (switching aria-live itself off and on is not announced reliably).
  -->
  <div
    class="z-(--z-strip) flex h-8.25 flex-none items-center gap-3 border-b bg-card px-4 font-mono text-xs leading-4 whitespace-nowrap"
    @click="show('cpu')"
  >
    <span class="flex shrink-0 items-center gap-1.5 text-muted-foreground">
      <span class="flex gap-0.5" aria-hidden="true">
        <span
          v-for="(each, index) in CYCLE_PHASES"
          :key="each"
          class="size-1.5 rounded-full transition-colors"
          :class="reached(index) ? 'bg-pointer' : 'bg-foreground/15'"
        />
      </span>
      <span v-if="phase" class="sr-only">{{ phase }} done</span>
      <span :title="next ? `Line ${next} runs next` : 'The program has ended'">
        <span class="sr-only">Next: </span>{{ next ?? 'end' }}
      </span>
    </span>
    <div
      class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden py-1.5"
      aria-live="polite"
      :aria-busy="running"
    >
      <span v-if="ran === null" class="truncate font-sans text-muted-foreground">
        Run an instruction to see what it changes
      </span>
      <span v-else class="shrink-0 font-semibold">{{ ran }}</span>
      <DiffChip
        v-for="(change, index) in changes.slice(0, STRIP_ENTRIES.wide)"
        :key="change.name"
        :entry="change"
        :class="{ 'max-sm:hidden': index >= STRIP_ENTRIES.phone }"
      />
      <span v-if="ran !== null && total === 0" class="font-sans text-muted-foreground">
        changed nothing
      </span>
    </div>
    <TapTooltip v-if="leftOut(total, STRIP_ENTRIES.phone) > 0" v-slot="{ toggle }">
      <TooltipTrigger as-child>
        <!-- Its hit area reaches 44px on a touch screen, past the strip's own height. -->
        <button
          type="button"
          class="relative -ml-1 shrink-0 rounded-full border px-1.5 py-0.5 text-2xs text-muted-foreground outline-none after:absolute after:-inset-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:after:-inset-x-3 pointer-coarse:after:-inset-y-3"
          :class="{ 'sm:hidden': leftOut(total, STRIP_ENTRIES.wide) === 0 }"
          @click.stop="toggle"
        >
          <span class="sm:hidden">+{{ leftOut(total, STRIP_ENTRIES.phone) }}</span>
          <span class="max-sm:hidden">+{{ leftOut(total, STRIP_ENTRIES.wide) }}</span>
          <span class="sr-only"> more: list every change</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="end">
        <ul class="flex flex-col gap-0.5 py-0.5 font-mono tabular-nums">
          <li v-for="change in changes" :key="change.name">
            <span class="font-semibold">{{ change.name }}</span> {{ describeChange(change) }}
          </li>
          <li v-if="omitted > 0" class="font-sans text-muted-foreground">
            and {{ omitted }} more memory writes
          </li>
        </ul>
      </TooltipContent>
    </TapTooltip>
  </div>
</template>
