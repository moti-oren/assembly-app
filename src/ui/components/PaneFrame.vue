<script setup lang="ts" generic="View extends string">
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import ViewTabs from './ViewTabs.vue';

const props = defineProps<{
  /** The views a phone switches between, in the order of their tabs. */
  views: readonly View[];
  labels: Record<View, string>;
  /** The view that shows the sidebar; every other one shows the stage. */
  sidebarView: View;
}>();

const view = defineModel<View>('view', { required: true });

const mode = useLayoutMode();
// One drawer for every page, so a tablet's sidebar stays as it was left from topic to topic.
const { drawerOpen } = useWorkbenchView();
</script>

<!--
  The two panes of a workbench, the CPU's or a topic's. Side by side on a desktop; on a tablet
  the sidebar is a drawer over the stage, and on a phone the tabs pick which view is on show
  (surfaces.css).
-->
<template>
  <ViewTabs v-if="mode === 'phone'" v-model:view="view" :views="views" :labels="labels" />
  <main
    class="workbench"
    :data-view="view"
    :data-shows="view === props.sidebarView ? 'sidebar' : 'stage'"
    :data-drawer="drawerOpen ? 'open' : 'closed'"
  >
    <slot />
  </main>
</template>
