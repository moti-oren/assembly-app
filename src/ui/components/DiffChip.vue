<script setup lang="ts">
import type { DiffEntry } from '@/ui/stepDiff';

defineProps<{
  entry: DiffEntry;
}>();
</script>

<!--
  One value the last step touched, as `name before → after`. A write is orange; a write of the
  same value only underlined; the instruction pointer blue, as everywhere it shows where
  execution is.
-->
<template>
  <span
    class="inline-flex shrink-0 items-baseline gap-1 rounded-sm px-1.5 py-0.5 tabular-nums"
    :class="
      entry.kind === 'pointer'
        ? 'bg-pointer-soft text-pointer'
        : entry.unchanged
          ? 'change-mark-written text-foreground'
          : 'bg-changed text-changed-foreground'
    "
  >
    <span>{{ entry.name }}</span>
    <template v-if="entry.unchanged">
      <span class="font-semibold">{{ entry.after }}</span>
      <span class="font-sans text-2xs text-muted-foreground">written, unchanged</span>
    </template>
    <template v-else>
      <span class="opacity-70">{{ entry.before }}</span>
      <span aria-hidden="true">→</span>
      <span class="sr-only">to</span>
      <span class="font-semibold">{{ entry.after }}</span>
    </template>
    <span v-if="entry.jump" class="font-sans text-2xs font-semibold">jump</span>
  </span>
</template>
