<script setup lang="ts">
import { PanelLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { useLayoutMode } from '@/ui/useLayoutMode';
import ActivityBar from './ActivityBar.vue';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import HeaderShell from './HeaderShell.vue';

defineProps<{
  /** The chip of the page on its way, so the header already reads as that page. */
  badge: string;
  /** A topic's page has a strip under its header below a desktop, and calls its drawer Controls. */
  topic: boolean;
}>();

const mode = useLayoutMode();
</script>

<!--
  A page's shell while its own chunk is on its way: the header, the activity bar, the two panes
  and the bar under them stand where the page will put its own, at the same heights at every
  width, so a switch only fills them in instead of leaving an empty window.
-->
<template>
  <HeaderShell :badge="badge" menu-label="Topics and settings">
    <template #lead>
      <!-- Where the page's drawer button will be, so the switch beside it does not move. -->
      <Button
        v-if="mode === 'tablet'"
        variant="outline"
        size="sm"
        class="invisible pointer-coarse:h-11"
        aria-hidden="true"
        tabindex="-1"
      >
        <PanelLeft />
        {{ topic ? 'Controls' : 'Code' }}
      </Button>
    </template>
    <template #context>
      <ArchitectureSwitch />
    </template>
  </HeaderShell>
  <div
    v-if="topic && mode !== 'desktop'"
    class="h-8.25 flex-none border-b bg-card max-md:h-7.5 max-md:border-b-0 max-md:bg-recessed"
  />
  <div v-if="mode === 'phone'" class="flex flex-none border-b bg-card" aria-hidden="true">
    <span class="view-tab invisible">View</span>
  </div>
  <div class="workbench-frame">
    <ActivityBar v-if="mode === 'desktop'" stand-in />
    <main class="workbench" data-shows="stage" data-drawer="closed" aria-busy="true">
      <p class="sr-only" role="status">Loading…</p>
      <div class="workbench-pane" data-pane="sidebar" />
      <div class="workbench-pane" data-pane="stage" />
    </main>
  </div>
  <!-- The bar's own rhythm: its padding around a control's height, a mouse's or a finger's. -->
  <footer class="transport">
    <div class="py-2"><div class="h-7 pointer-coarse:h-11" /></div>
  </footer>
</template>
