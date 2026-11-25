<script setup lang="ts">
import { phoneViewOf, type StageKey } from '@/ui/stagePanels';

/**
 * The stage's panels, one under the other in a fixed order; unlike the sidebar, not movable.
 * Each is marked with the view a phone shows it in.
 */
defineProps<{
  keys: StageKey[];
}>();

defineSlots<Record<StageKey, () => unknown>>();
</script>

<template>
  <!-- A landmark of its own, so a screen reader can go straight to the CPU and its memory. -->
  <section class="flex min-w-0 flex-col" aria-label="The CPU, its memory and devices">
    <div v-for="key in keys" :key="key" class="min-w-0 shrink-0" :data-in-view="phoneViewOf(key)">
      <slot :name="key" />
    </div>
  </section>
</template>
