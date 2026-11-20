<script setup lang="ts">
import { CYCLE_PHASES, type CyclePhase } from '@/core/shared/cycle';
import { useWorkbenchView } from '@/ui/useWorkbenchView';

const props = defineProps<{
  /** The last executed instruction, as written; null before the first one. */
  ran: string | null;
  /** Everything it changed, as short `name value` pairs. */
  changes: { name: string; value: string }[];
  /** The phase the line at the instruction pointer has reached, when stepping by phase. */
  phase?: CyclePhase | null;
  /** The label of the line that runs next; null at the end of the program. */
  next?: string | null;
}>();

const { show } = useWorkbenchView();

/** True once the line being stepped is at or past the phase at `index`. */
function reached(index: number): boolean {
  return !!props.phase && CYCLE_PHASES.indexOf(props.phase) >= index;
}
</script>

<template>
  <!--
    Where the CPU is not in sight (a phone on another view, a tablet under its drawer), this keeps
    the last result there. It has a fixed height from the start, so nothing drops when the first
    result comes. A tap goes to the CPU.
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
    <div class="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto py-1.5" aria-live="polite">
      <span v-if="ran === null" class="font-sans text-muted-foreground">
        Run an instruction to see what it changes
      </span>
      <span v-else class="font-semibold">{{ ran }}</span>
      <span
        v-for="change in changes"
        :key="change.name"
        class="rounded-sm bg-changed px-1.5 py-0.5 text-changed-foreground"
      >
        {{ change.name }} <span class="font-semibold">{{ change.value }}</span>
      </span>
      <span v-if="ran !== null && changes.length === 0" class="font-sans text-muted-foreground">
        changed nothing
      </span>
    </div>
  </div>
</template>
