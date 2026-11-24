<script setup lang="ts">
import type { CpuMoment } from '@/ui/cpuMoment';
import { useLayoutMode } from '@/ui/useLayoutMode';

defineProps<{
  /** The moment of the CPU the topic follows. */
  moment: CpuMoment<unknown>;
  /** The operation on show, on one line. */
  equation: string;
  /** Whether the learner changed what the CPU gave. */
  edited: boolean;
  /** Why the CPU's last instruction has nothing to show here, when it has nothing. */
  unavailable: string | null;
  /** A quiet remark on what is shown, such as a result the CPU threw away. */
  aside: string | null;
}>();

// Below a desktop the strip above the panes says the operation too: only one of them aloud.
const mode = useLayoutMode();
</script>

<!-- Where what a topic shows came from: a moment of the CPU, or the learner's own values. -->
<template>
  <div class="flex flex-col gap-1.5">
    <p class="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
      <template v-if="moment.instruction">
        <span>{{ moment.cpu }}, step {{ moment.position }} of {{ moment.total }}</span>
        <span class="font-mono text-code font-semibold text-foreground">{{
          moment.instruction
        }}</span>
      </template>
      <span v-else>Nothing has run on the {{ moment.cpu }} yet: these are values to try.</span>
      <span
        v-if="edited"
        class="rounded-sm border border-foreground/40 px-1.5 py-px text-2xs font-semibold text-foreground"
        >What if</span
      >
    </p>
    <p
      class="font-mono text-sm font-semibold wrap-anywhere"
      :aria-live="mode === 'desktop' ? 'polite' : 'off'"
    >
      {{ equation }}
    </p>
    <p v-if="unavailable && !edited" class="max-w-prose text-xs text-pretty">
      {{ unavailable }}
    </p>
    <p v-else-if="aside" class="text-xs text-pretty text-muted-foreground">{{ aside }}</p>
  </div>
</template>
