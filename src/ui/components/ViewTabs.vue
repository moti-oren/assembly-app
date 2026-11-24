<script setup lang="ts" generic="View extends string">
import { sound } from '@/ui/soundEngine';

defineProps<{
  /** The views, in the order of their tabs. */
  views: readonly View[];
  labels: Record<View, string>;
}>();

const view = defineModel<View>('view', { required: true });

function choose(wanted: View): void {
  if (view.value !== wanted) sound.play('detent');
  view.value = wanted;
}
</script>

<!--
  A phone's views of a workbench, one on show at a time. Flat tabs on a hairline, so they do not
  read as a second switch under the header's.
-->
<template>
  <nav class="flex flex-none border-b bg-card" aria-label="View">
    <button
      v-for="each in views"
      :key="each"
      type="button"
      class="view-tab"
      :aria-pressed="view === each"
      @click="choose(each)"
    >
      {{ labels[each] }}
    </button>
  </nav>
</template>
