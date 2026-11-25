<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import { Wrench } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { faultSummary } from '@/ui/logicFault';
import { useHexStyle } from '@/ui/useHexStyle';
import type { LogicLens } from '@/ui/useLogicLens';

const props = defineProps<{ lens: LogicLens }>();
const hexStyle = useHexStyle();

const summary = computed(() =>
  props.lens.faultCount.value > 0
    ? faultSummary(
        props.lens.healthy.value,
        props.lens.solution.value,
        props.lens.faultCount.value,
        hexStyle.value
      )
    : null
);

// The button goes with the last fault: the focus it held stays here, not at the top of the page.
const note = useTemplateRef<HTMLElement>('note');
async function repairAll(): Promise<void> {
  props.lens.repairAll();
  await nextTick();
  note.value?.focus({ preventScroll: true });
}
</script>

<!-- What the learner broke in the circuit, what it does to the answer, and the way to mend it. -->
<template>
  <div
    ref="note"
    role="group"
    aria-label="Broken gates"
    tabindex="-1"
    class="outline-none"
    :class="summary && 'well mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg px-3 py-2'"
  >
    <!-- The region is there before its text is, or the first note would not be announced. -->
    <p class="max-w-prose min-w-0 flex-1 basis-64 text-sm text-pretty" aria-live="polite">
      <template v-if="summary">
        <span class="font-semibold">{{ summary.broken }}</span>
        {{ summary.effect }}
      </template>
      <span v-else class="sr-only">Every gate works.</span>
    </p>
    <Button
      v-if="summary"
      variant="outline"
      size="sm"
      class="max-md:w-full md:ml-auto pointer-coarse:h-11"
      @click="repairAll"
    >
      <Wrench />
      Repair every gate
    </Button>
  </div>
</template>
