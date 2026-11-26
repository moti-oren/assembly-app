<script setup lang="ts">
import PaneFrame from './PaneFrame.vue';
</script>

<!--
  A page's two panes while its chunk is on its way: empty, in the shell that stays around them,
  so a switch only fills them in.
-->
<template>
  <PaneFrame aria-busy="true">
    <p class="sr-only" role="status">Loading…</p>
    <div class="workbench-pane" data-pane="sidebar" />
    <div class="workbench-pane" data-pane="stage" />
  </PaneFrame>
</template>
