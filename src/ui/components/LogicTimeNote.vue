<script setup lang="ts">
import { computed } from 'vue';
import { timeSummary } from '@/ui/logicTime';
import type { LogicLens } from '@/ui/useLogicLens';

const props = defineProps<{ lens: LogicLens }>();

const note = computed(() => {
  const { on, step, last, worst } = props.lens.time;
  return on.value ? timeSummary(step.value, last.value, worst.value).note : '';
});
</script>

<!-- What the adder's wires are doing at the gate delay on show, while time is slowed down. -->
<template>
  <!-- The region is there before its text is, or the first note would not be announced. -->
  <p
    class="max-w-prose text-sm text-pretty text-muted-foreground"
    :class="{ 'sr-only': !note }"
    aria-live="polite"
  >
    {{ note }}
  </p>
</template>
