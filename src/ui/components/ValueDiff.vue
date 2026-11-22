<script setup lang="ts">
import type { ValueChange } from '@/ui/stepDiff';

defineProps<{
  /** What the last step did to the value; nothing is shown when it left the value alone. */
  change: ValueChange | null;
}>();
</script>

<!-- The last step's effect on one value, for the foot of its tooltip. -->
<template>
  <p
    v-if="change"
    class="flex w-full flex-wrap items-baseline gap-x-1 border-t border-current/25 pt-1.5 font-mono tabular-nums"
  >
    <template v-if="change.unchanged">
      <span class="font-sans">Written with the same value:</span>
      <span class="font-semibold">{{ change.after }}</span>
    </template>
    <template v-else>
      <span class="font-sans">Previous</span>
      <span>{{ change.before }}</span>
      <span aria-hidden="true">→</span>
      <span class="font-sans">Now</span>
      <span class="font-semibold">{{ change.after }}</span>
      <span v-if="change.jump" class="font-sans font-semibold">(jump)</span>
    </template>
  </p>
</template>
