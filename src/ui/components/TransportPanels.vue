<script setup lang="ts">
import { computed } from 'vue';
import { Binary, Cable, ListOrdered } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const props = defineProps<{
  historyShown: boolean;
  devicesShown: boolean;
  bytesShown: boolean;
  /** Whether each switch is always named, or only where the bar has room for it. */
  named?: boolean;
  /** In a phone's sheet: three equal columns, each name under its icon. */
  stacked?: boolean;
}>();

const emit = defineEmits<{
  'update:historyShown': [shown: boolean];
  'update:devicesShown': [shown: boolean];
  'update:bytesShown': [shown: boolean];
}>();

const toggles = computed(() => [
  {
    label: 'History',
    icon: ListOrdered,
    shown: props.historyShown,
    flip: () => emit('update:historyShown', !props.historyShown)
  },
  {
    label: 'I/O',
    icon: Cable,
    shown: props.devicesShown,
    flip: () => emit('update:devicesShown', !props.devicesShown)
  },
  {
    label: 'Machine code',
    icon: Binary,
    shown: props.bytesShown,
    flip: () => emit('update:bytesShown', !props.bytesShown)
  }
]);
</script>

<!-- What the page shows, apart from the controls that drive the program. -->
<template>
  <div
    class="toggle-group"
    :class="stacked ? 'grid w-full grid-cols-3' : { 'flex w-full': named }"
    role="group"
    aria-label="Panels"
  >
    <!-- Icons only where there is no room, so the name moves into the label and a tooltip. -->
    <Tooltip v-for="toggle in toggles" :key="toggle.label">
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="px-2.5 pointer-coarse:h-11"
          :class="
            stacked
              ? 'h-14 min-w-0 flex-col gap-1 px-1 text-xs pointer-coarse:h-14'
              : { 'flex-1': named }
          "
          :aria-label="toggle.label"
          :aria-pressed="toggle.shown"
          @click="toggle.flip"
        >
          <component :is="toggle.icon" />
          <span :class="{ 'hidden xl:inline': !named }">{{ toggle.label }}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent v-if="!named" class="xl:hidden">{{ toggle.label }}</TooltipContent>
    </Tooltip>
  </div>
</template>
