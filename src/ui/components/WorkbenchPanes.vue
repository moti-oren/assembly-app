<script setup lang="ts">
import { PHONE_VIEW_LABELS, PHONE_VIEWS } from '@/ui/layoutMode';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import PaneFrame from './PaneFrame.vue';

const { view } = useWorkbenchView();
</script>

<!-- The two panes of a CPU's workbench, with a phone's three views of them. -->
<template>
  <PaneFrame
    v-model:view="view"
    :views="PHONE_VIEWS"
    :labels="PHONE_VIEW_LABELS"
    sidebar-view="code"
  >
    <slot />
  </PaneFrame>
</template>
