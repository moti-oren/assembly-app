<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue';
import type { CpuMoment } from '@/ui/cpuMoment';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useTopicView } from '@/ui/useTopicView';

defineProps<{
  /** The moment of the CPU the topic follows. */
  moment: CpuMoment<unknown>;
  /** The operation on show, on one line. */
  equation: string;
  /** Whether the learner changed what the CPU gave. */
  edited: boolean;
}>();
defineEmits<{ back: [] }>();

const mode = useLayoutMode();
const { showControls } = useTopicView();
</script>

<!--
  Where the sidebar is not in sight (a phone on the drawing, a tablet with its drawer closed),
  this keeps the operation on show there, at the height of the CPU's result strip. A tap goes
  to the controls. A phone has no activity bar, so the way back to the CPU is here.
-->
<template>
  <div
    class="z-(--z-strip) flex h-8.25 flex-none items-center gap-3 border-b bg-card px-4 font-mono text-xs leading-4 whitespace-nowrap max-md:h-7.5 max-md:border-b-0 max-md:bg-recessed max-md:pl-2"
    @click="showControls"
  >
    <!-- Its hit area reaches 44px on a touch screen, past the strip's own height. -->
    <button
      v-if="mode === 'phone'"
      type="button"
      class="relative flex shrink-0 items-center gap-1 rounded-sm px-1 font-sans text-muted-foreground outline-none after:absolute after:-inset-x-1 after:-inset-y-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      :aria-label="`Back to the ${moment.cpu}`"
      @click.stop="$emit('back')"
    >
      <ArrowLeft class="size-3.5" aria-hidden="true" />
      {{ moment.cpu }}
    </button>
    <span v-else-if="moment.instruction" class="shrink-0 text-muted-foreground">
      {{ moment.instruction }}
    </span>
    <span class="min-w-0 flex-1 truncate font-semibold" aria-live="polite">{{ equation }}</span>
    <span
      v-if="edited"
      class="shrink-0 rounded-sm border border-foreground/40 px-1.5 font-sans text-2xs font-semibold"
      >What if</span
    >
  </div>
</template>
