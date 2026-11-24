<script setup lang="ts">
import type { NumberLens } from '@/ui/useNumberLens';

defineProps<{ lens: NumberLens }>();
</script>

<!-- One more added to a sum, or taken off a difference: the carry or the borrow coming in. -->
<template>
  <label class="flex w-fit items-center gap-2 text-sm pointer-coarse:min-h-11">
    <input
      type="checkbox"
      class="size-4 pointer-coarse:size-5"
      :checked="'extra' in lens.request.value && lens.request.value.extra === 1"
      @change="lens.flipExtra()"
    />
    {{
      lens.request.value.kind === 'subtract'
        ? 'Take one more off (a borrow coming in)'
        : 'Add one more (a carry coming in)'
    }}
  </label>
</template>
