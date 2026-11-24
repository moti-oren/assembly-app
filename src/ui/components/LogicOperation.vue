<script setup lang="ts">
import { FREE_OPERATIONS } from '@/ui/logicView';
import type { LogicLens } from '@/ui/useLogicLens';
import ChoiceGroup from './ChoiceGroup.vue';
import WidthPicker from './WidthPicker.vue';

defineProps<{ lens: LogicLens }>();
</script>

<!-- Which circuit is on show: the operation it works out, and how many bits wide it is. -->
<template>
  <div class="flex flex-col gap-4">
    <ChoiceGroup
      label="Operation"
      titled
      :choices="FREE_OPERATIONS"
      :chosen="lens.operation.value"
      @pick="lens.pick"
    />
    <WidthPicker :width="lens.request.value.width" @set="lens.setWidth" />
  </div>
</template>
