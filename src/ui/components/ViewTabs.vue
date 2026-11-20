<script setup lang="ts">
import { PHONE_VIEW_LABELS, PHONE_VIEWS } from '@/ui/layoutMode';
import { sound } from '@/ui/soundEngine';
import { useWorkbenchView } from '@/ui/useWorkbenchView';

const { view } = useWorkbenchView();

function choose(wanted: (typeof PHONE_VIEWS)[number]): void {
  if (view.value !== wanted) sound.play('detent');
  view.value = wanted;
}
</script>

<!--
  A phone's three views of the workbench: what you write, the CPU, and what is on its bus. Flat
  tabs on a hairline, so they do not read as a second architecture switch under the header's.
-->
<template>
  <nav class="flex flex-none border-b bg-card" aria-label="View">
    <button
      v-for="each in PHONE_VIEWS"
      :key="each"
      type="button"
      class="view-tab"
      :aria-pressed="view === each"
      @click="choose(each)"
    >
      {{ PHONE_VIEW_LABELS[each] }}
    </button>
  </nav>
</template>
