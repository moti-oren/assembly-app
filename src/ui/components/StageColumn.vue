<script setup lang="ts" generic="K extends string">
/** The stage's panels, one under the other in a fixed order; unlike the sidebar, not movable. */
defineProps<{
  keys: K[];
}>();

defineSlots<Record<K, () => unknown>>();
</script>

<template>
  <div class="flex min-w-0 flex-col *:shrink-0">
    <slot v-for="key in keys" :key="key" :name="key" />
  </div>
</template>
