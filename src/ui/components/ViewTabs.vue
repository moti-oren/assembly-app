<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { PHONE_VIEW_LABELS, PHONE_VIEWS } from '@/ui/layoutMode';
import { sound } from '@/ui/soundEngine';
import { useWorkbenchView } from '@/ui/useWorkbenchView';

const { view } = useWorkbenchView();

function choose(wanted: (typeof PHONE_VIEWS)[number]): void {
  if (view.value !== wanted) sound.play('detent');
  view.value = wanted;
}
</script>

<!-- A phone's three views of the workbench: what you write, the CPU, and what is on its bus. -->
<template>
  <nav class="flex-none border-b bg-card px-4 py-1.5" aria-label="View">
    <div
      class="segmented"
      :style="{ '--segments': PHONE_VIEWS.length, '--active': PHONE_VIEWS.indexOf(view) }"
      role="group"
    >
      <Button
        v-for="each in PHONE_VIEWS"
        :key="each"
        variant="ghost"
        size="sm"
        class="h-8 px-2 text-xs pointer-coarse:h-10"
        :aria-pressed="view === each"
        @click="choose(each)"
      >
        {{ PHONE_VIEW_LABELS[each] }}
      </Button>
    </div>
  </nav>
</template>
