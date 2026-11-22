<script setup lang="ts">
import { bitsLeftToRight, startsDigit } from '@/ui/logicLayout';

defineProps<{ width: number; tailed?: boolean }>();
</script>

<!-- The number of each column's bit, above the rows of a circuit. -->
<template>
  <div class="logic-row text-2xs text-tertiary-foreground" data-compact aria-hidden="true">
    <div class="logic-label font-normal!">bit</div>
    <div class="logic-cell" />
    <div
      v-for="bit in bitsLeftToRight(width)"
      :key="bit"
      class="logic-cell font-mono"
      :data-digit-start="startsDigit(width, bit) ? '' : undefined"
    >
      {{ bit }}
    </div>
    <div v-if="tailed" class="logic-cell" />
  </div>
</template>
