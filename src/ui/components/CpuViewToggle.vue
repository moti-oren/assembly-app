<script setup lang="ts">
import { Cpu, Table2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/ui/useLocale';
import { usePreferences } from '@/ui/usePreferences';

const { cpuView } = usePreferences();
const { t } = useLocale();

const VIEWS = [
  { value: 'diagram', icon: Cpu },
  { value: 'table', icon: Table2 }
] as const;
</script>

<template>
  <div
    class="flex items-center gap-0.5 rounded-md border p-0.5"
    role="group"
    :aria-label="t.cpuView.label"
  >
    <Tooltip v-for="view in VIEWS" :key="view.value">
      <TooltipTrigger as-child>
        <Button
          size="icon-xs"
          class="pointer-coarse:size-11"
          :variant="cpuView === view.value ? 'secondary' : 'ghost'"
          :aria-pressed="cpuView === view.value"
          :aria-label="t.cpuView[view.value]"
          @click="cpuView = view.value"
        >
          <component :is="view.icon" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{{ t.cpuView[view.value] }}</TooltipContent>
    </Tooltip>
  </div>
</template>
