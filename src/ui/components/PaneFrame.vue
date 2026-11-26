<script setup lang="ts">
import { useShellFrame } from '@/ui/useShellFrame';
import { useWorkbenchView } from '@/ui/useWorkbenchView';

const { frame, view } = useShellFrame();
// One drawer for every page, so a tablet's sidebar stays as it was left from topic to topic.
const { drawerOpen } = useWorkbenchView();
</script>

<!--
  The two panes of a page, the CPU's or a topic's, in the shell's frame beside its activity bar.
  Side by side on a desktop; on a tablet the sidebar is a drawer over the stage, and on a phone
  the shell's view tabs pick which view is on show (surfaces.css).
-->
<template>
  <main
    class="workbench"
    :data-view="view"
    :data-shows="view === frame.sidebarView ? 'sidebar' : 'stage'"
    :data-drawer="drawerOpen ? 'open' : 'closed'"
  >
    <slot />
  </main>
</template>
