<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/ui/useLocale';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';

const { shown } = useRv32Pipeline();
const { t } = useLocale();

const VIEWS = computed(() => [
  {
    pipeline: false,
    label: t.value.rv32.cycleView.single,
    title: t.value.rv32.cycleView.singleHint
  },
  {
    pipeline: true,
    label: t.value.rv32.cycleView.pipeline,
    title: t.value.rv32.cycleView.pipelineHint
  }
]);
</script>

<template>
  <div
    class="flex shrink-0 items-center gap-0.5 rounded-md border p-0.5"
    role="group"
    :aria-label="t.rv32.cycleView.label"
  >
    <Button
      v-for="view in VIEWS"
      :key="String(view.pipeline)"
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
