<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { timeSummary } from '@/ui/logicTime';
import type { LogicLens } from '@/ui/useLogicLens';

const props = defineProps<{ lens: LogicLens }>();

const note = computed(() => {
  const { on, step, last, worst } = props.lens.time;
  return on.value ? timeSummary(step.value, last.value, worst.value).note : '';
});

// While the delays play only where they stop is read out, not every delay on the way, and what
// was said before the play is taken back: "at rest" would no longer be true.
const said = ref('');
watchEffect(() => {
  said.value = props.lens.time.playing.value ? '' : note.value;
});
</script>

<!-- What the adder's wires are doing at the gate delay on show, while time is slowed down. -->
<template>
  <div>
    <p
      class="max-w-prose text-sm text-pretty text-muted-foreground"
      :class="{ 'sr-only': !note }"
      aria-hidden="true"
    >
      {{ note }}
    </p>
    <!-- The region is there before its text is, or the first note would not be announced. -->
    <p class="sr-only" aria-live="polite">{{ said }}</p>
  </div>
</template>
