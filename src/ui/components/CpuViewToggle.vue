<script setup lang="ts">
import { Cpu, Table2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { usePreferences } from '@/ui/usePreferences';

const { cpuView } = usePreferences();

const VIEWS = [
  { value: 'diagram', label: 'Show the CPU as a diagram', icon: Cpu },
  { value: 'table', label: 'Show the CPU as tables', icon: Table2 }
] as const;
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-md border p-0.5" role="group" aria-label="CPU view">
    <Button
      v-for="view in VIEWS"
      :key="view.value"
      size="icon-xs"
      :variant="cpuView === view.value ? 'secondary' : 'ghost'"
      :aria-pressed="cpuView === view.value"
      :aria-label="view.label"
      :title="view.label"
      @click="cpuView = view.value"
    >
      <component :is="view.icon" />
    </Button>
  </div>
</template>
