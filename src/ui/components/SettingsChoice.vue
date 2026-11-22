<script setup lang="ts" generic="Value extends string">
import { Button } from '@/components/ui/button';

defineProps<{ options: readonly { value: Value; label: string }[] }>();
const chosen = defineModel<Value>({ required: true });
</script>

<!-- A setting with a few values, one of which is chosen. -->
<template>
  <div
    class="segmented"
    :style="{
      '--segments': options.length,
      '--active': options.findIndex((each) => each.value === chosen)
    }"
    role="group"
  >
    <Button
      v-for="option in options"
      :key="option.value"
      type="button"
      variant="ghost"
      size="sm"
      class="h-7 px-3 text-xs pointer-coarse:h-11"
      :aria-pressed="chosen === option.value"
      @click="chosen = option.value"
    >
      {{ option.label }}
    </Button>
  </div>
</template>
