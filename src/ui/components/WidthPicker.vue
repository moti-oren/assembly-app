<script setup lang="ts">
import type { Width } from '@/core/logic/alu';
import { Button } from '@/components/ui/button';
import { WIDTHS } from '@/ui/logicView';

defineProps<{
  width: Width;
  /** The widths that cannot be picked for what is on show; none when left out. */
  disallowed?: readonly Width[];
}>();
defineEmits<{ set: [width: Width] }>();
</script>

<!-- How many bits wide what a topic shows is: 8, 16 or 32. -->
<template>
  <div>
    <h3 class="mb-(--sublabel-gap) text-xs font-semibold">Width in bits</h3>
    <div
      class="segmented w-max"
      :style="{ '--segments': WIDTHS.length, '--active': WIDTHS.indexOf(width) }"
      role="group"
      aria-label="Width in bits"
    >
      <Button
        v-for="each in WIDTHS"
        :key="each"
        variant="ghost"
        size="sm"
        class="h-7 px-3 text-xs pointer-coarse:h-11 pointer-coarse:min-w-11"
        :disabled="disallowed?.includes(each)"
        :aria-pressed="width === each"
        @click="$emit('set', each)"
      >
        {{ each }}
      </Button>
    </div>
  </div>
</template>
