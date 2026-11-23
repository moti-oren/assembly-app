<script setup lang="ts">
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import type { CpuMoment } from '@/ui/cpuMoment';
import { useLayoutMode } from '@/ui/useLayoutMode';

defineProps<{
  /** The moment of the CPU the topic follows. */
  moment: CpuMoment<unknown>;
  /** The operation on show, on one line. */
  equation: string;
  /** Whether the learner changed what the CPU gave. */
  edited: boolean;
  /** Whether the CPU's last instruction gave the topic something to show. */
  fromCpu: boolean;
  /** Why the CPU's last instruction has nothing to show here, when it has nothing. */
  unavailable: string | null;
  /** A quiet remark on what is shown, such as a result the CPU threw away. */
  aside: string | null;
}>();
defineEmits<{ seek: [position: number]; back: []; restore: [] }>();

const mode = useLayoutMode();
</script>

<!-- Where what a topic shows came from: a moment of the CPU, or the learner's own values. -->
<template>
  <section
    class="flex flex-wrap items-center gap-x-4 gap-y-2 max-md:gap-y-1.5"
    aria-label="Where this came from"
  >
    <div class="min-w-0 flex-1 basis-64">
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
      <p class="mt-1 font-mono text-sm font-semibold" aria-live="polite">{{ equation }}</p>
      <p v-if="unavailable && !edited" class="mt-1 max-w-prose text-xs text-pretty">
        {{ unavailable }}
      </p>
      <p v-else-if="aside" class="mt-1 text-xs text-muted-foreground">{{ aside }}</p>
    </div>

    <!--
      On a phone the buttons are one quiet row above the text: the way back first, at the left
      edge, and the steps at the right. The way back is the page's main button only where there
      is room for it beside the text.
    -->
    <div class="flex flex-wrap items-center gap-1.5 max-md:order-first max-md:w-full">
      <Button
        v-if="edited"
        variant="outline"
        size="sm"
        class="pointer-coarse:h-11"
        @click="$emit('restore')"
      >
        <RotateCcw />
        {{ fromCpu ? 'The CPU’s values' : 'Starting values' }}
      </Button>
      <div class="toggle-group max-md:ml-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          class="quiet-disabled disabled:opacity-100 pointer-coarse:size-11"
          aria-label="The operation before this one"
          title="The operation before this one"
          :disabled="moment.previous === null"
          @click="moment.previous !== null && $emit('seek', moment.previous)"
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="quiet-disabled disabled:opacity-100 pointer-coarse:size-11"
          aria-label="The operation after this one"
          title="The operation after this one"
          :disabled="moment.next === null"
          @click="moment.next !== null && $emit('seek', moment.next)"
        >
          <ChevronRight />
        </Button>
      </div>
      <Button
        :variant="mode === 'phone' ? 'ghost' : 'default'"
        size="sm"
        class="max-md:order-first max-md:-ml-2 max-md:px-2 max-md:text-muted-foreground pointer-coarse:h-11"
        :aria-label="`Back to the ${moment.cpu}`"
        @click="$emit('back')"
      >
        <ArrowLeft />
        <span class="max-md:hidden">Back to the</span> {{ moment.cpu }}
      </Button>
    </div>
  </section>
</template>
