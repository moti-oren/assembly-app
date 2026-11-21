<script setup lang="ts">
import type { DiffEntry } from '@/ui/stepDiff';

defineProps<{
  entry: DiffEntry;
}>();
</script>

<!--
  One value the last step touched, as `name before → after`. A write is orange; a write of the
  same value only underlined; the instruction pointer blue, as everywhere it shows where
  execution is. The old value is muted, the new one bold, both at AA contrast on the chip (blue
  text is not, so the pointer's new value is in the foreground colour). When the strip runs out
  of room, the old value is cut short first: the new one always stays whole.
-->
<template>
  <span
    class="inline-flex min-w-0 items-baseline gap-1 rounded-sm px-1.5 py-0.5 tabular-nums"
    :class="
      entry.kind === 'pointer'
        ? 'bg-pointer-soft text-pointer'
        : entry.unchanged
          ? 'change-mark-written text-foreground'
          : 'bg-changed text-changed-foreground'
    "
  >
    <span class="shrink-0">{{ entry.name }}</span>
    <template v-if="entry.unchanged">
      <span class="shrink-0 font-semibold">{{ entry.after }}</span>
      <span class="shrink-0 font-sans text-2xs text-muted-foreground">written, unchanged</span>
    </template>
    <template v-else>
      <span class="min-w-0 truncate text-muted-foreground">{{ entry.before }}</span>
      <span class="shrink-0" aria-hidden="true">→</span>
      <span class="sr-only">to</span>
      <span
        class="shrink-0 font-semibold"
        :class="{ 'text-foreground': entry.kind === 'pointer' }"
        >{{ entry.after }}</span
      >
    </template>
    <span v-if="entry.jump" class="shrink-0 font-sans text-2xs font-semibold">jump</span>
  </span>
</template>
