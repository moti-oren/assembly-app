<script setup lang="ts">
import { Cpu, Table2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CPU_VIEW_LABELS, usePreferences } from '@/ui/usePreferences';

const { cpuView } = usePreferences();

const VIEWS = [
  { value: 'diagram', label: CPU_VIEW_LABELS.diagram, icon: Cpu },
  { value: 'table', label: CPU_VIEW_LABELS.table, icon: Table2 }
] as const;
</script>

<template>
  <div
    class="segmented"
    :style="{ '--segments': VIEWS.length, '--active': cpuView === 'table' ? 1 : 0 }"
    role="group"
    aria-label="CPU view"
  >
    <Tooltip v-for="view in VIEWS" :key="view.value">
      <TooltipTrigger as-child>
        <Button
          size="icon-xs"
          class="pointer-coarse:size-11"
          variant="ghost"
          :aria-pressed="cpuView === view.value"
          :aria-label="view.label"
          @click="cpuView = view.value"
        >
          <component :is="view.icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ view.label }}</TooltipContent>
    </Tooltip>
  </div>
</template>
