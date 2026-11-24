<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { FREE_OPERATIONS, WIDTHS } from '@/ui/logicView';
import type { LogicLens } from '@/ui/useLogicLens';

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
    <div>
      <h3 class="mb-(--sublabel-gap) text-xs font-semibold">Width in bits</h3>
      <div
        class="segmented w-max"
        :style="{
          '--segments': WIDTHS.length,
          '--active': WIDTHS.indexOf(lens.request.value.width)
        }"
        role="group"
        aria-label="Width in bits"
      >
        <Button
          v-for="each in WIDTHS"
          :key="each"
          variant="ghost"
          size="sm"
          class="h-7 px-3 text-xs pointer-coarse:h-11"
          :aria-pressed="lens.request.value.width === each"
          @click="lens.setWidth(each)"
        >
          {{ each }}
        </Button>
      </div>
    </div>
  </div>
</template>
