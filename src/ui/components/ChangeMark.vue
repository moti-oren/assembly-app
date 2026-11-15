<script setup lang="ts">
defineProps<{
  /** Whether the last instruction changed the wrapped value. */
  on: boolean;
  /** Changes on every execution, so the flash replays even when the same value changes twice. */
  tick: number;
}>();
</script>

<template>
  <span class="change-mark" :class="{ 'bg-changed text-changed-foreground': on }">
    <span v-if="on" :key="tick" class="change-flash" aria-hidden="true" />
    <slot />
  </span>
</template>
