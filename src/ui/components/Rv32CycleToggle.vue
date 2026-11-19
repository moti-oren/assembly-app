<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';

const { shown } = useRv32Pipeline();

const VIEWS = [
  { pipeline: false, label: 'One by one', title: "Show one instruction's cycle" },
  { pipeline: true, label: 'Pipeline', title: 'Show the pipeline' }
] as const;
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5"
    role="group"
    aria-label="Cycle view"
  >
    <Button
      v-for="view in VIEWS"
      :key="view.label"
      size="xs"
      class="h-5 px-1.5 text-2xs pointer-coarse:h-11"
      :variant="shown === view.pipeline ? 'secondary' : 'ghost'"
      :aria-pressed="shown === view.pipeline"
      :title="view.title"
      @click="shown = view.pipeline"
    >
      {{ view.label }}
    </Button>
  </div>
</template>
