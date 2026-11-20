<script setup lang="ts">
import { onDeactivated, ref } from 'vue';
import { Tooltip } from '@/components/ui/tooltip';

const open = ref(false);
// A workbench left for another architecture is kept alive, and would leave the tooltip on show.
onDeactivated(() => {
  open.value = false;
});
</script>

<!--
  A tooltip that a tap opens too. A touch screen has no pointer to hover with, and what these
  explain (a register, a flag) is part of the lesson. The trigger calls `toggle` on a click; a
  tap anywhere else closes it again.
-->
<template>
  <Tooltip v-model:open="open" disable-closing-trigger>
    <slot :toggle="() => (open = !open)" />
  </Tooltip>
</template>
