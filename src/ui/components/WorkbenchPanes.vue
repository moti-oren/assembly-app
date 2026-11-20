<script setup lang="ts">
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import ViewTabs from './ViewTabs.vue';

const mode = useLayoutMode();
const { view, drawerOpen } = useWorkbenchView();
</script>

<!--
  The two panes of every workbench. Side by side on a desktop; on a tablet the sidebar is a
  drawer over the stage, and on a phone the tabs pick which view is on show (surfaces.css).
-->
<template>
  <ViewTabs v-if="mode === 'phone'" />
  <main class="workbench" :data-view="view" :data-drawer="drawerOpen ? 'open' : 'closed'">
    <slot />
  </main>
</template>
