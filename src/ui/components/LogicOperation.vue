<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { FREE_OPERATIONS } from '@/ui/logicView';
import type { LogicLens } from '@/ui/useLogicLens';
import WidthPicker from './WidthPicker.vue';

defineProps<{ lens: LogicLens }>();
</script>

<!-- Which circuit is on show: the operation it works out, and how many bits wide it is. -->
<template>
  <div class="flex flex-col gap-4">
    <div>
      <h3 class="mb-(--sublabel-gap) text-xs font-semibold">Operation</h3>
      <div class="toggle-group flex-wrap" role="group" aria-label="Operation">
        <Button
          v-for="choice in FREE_OPERATIONS"
          :key="choice.id"
          variant="ghost"
          size="sm"
          class="h-7 px-2.5 text-xs pointer-coarse:h-11"
          :aria-pressed="lens.operation.value === choice.id"
          @click="lens.pick(choice.id)"
        >
          {{ choice.label }}
        </Button>
      </div>
    </div>
    <WidthPicker :width="lens.request.value.width" @set="lens.setWidth" />
  </div>
</template>
