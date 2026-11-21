<script setup lang="ts">
import { computed } from 'vue';
import { formatPhysical } from '@/core/x86/address';
import { formatHex } from '@/core/shared/numbers';
import { offsetNote, type WorkedAddress } from '@/ui/x86MemoryView';

/** segment:offset worked out into the 20-bit address that goes onto the bus. */
const props = defineProps<{ worked: WorkedAddress }>();

const emit = defineEmits<{
  /** Move the table to the bytes of the last access. */
  show: [];
}>();

const note = computed(() => offsetNote(props.worked.offsetParts));
</script>

<template>
  <span class="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 lg:shrink-0 lg:flex-nowrap">
    <span class="font-sans text-muted-foreground">{{ worked.label }}</span>
    <span class="font-semibold"
      >{{ worked.segment.toUpperCase() }}:{{ formatHex(worked.sum.offset, 16) }}</span
    >
    <span class="text-muted-foreground">=</span>
    <span :title="`${worked.segment.toUpperCase()} shifted left by 4 bits`"
      >{{ formatHex(worked.sum.segment, 16) }}h × 10h</span
    >
    <span class="text-muted-foreground">+</span>
    <span>{{ formatHex(worked.sum.offset, 16) }}h</span>
    <span class="text-muted-foreground">=</span>
    <template v-if="worked.sum.wrapped">
      <span class="text-muted-foreground line-through decoration-1"
        >{{ formatPhysical(worked.sum.sum) }}h</span
      >
      <span class="font-sans text-muted-foreground">wraps past 1MB to</span>
    </template>
    <span class="font-semibold text-pointer">{{ formatPhysical(worked.sum.physical) }}h</span>
  </span>
  <span v-if="note" class="font-sans text-muted-foreground lg:min-w-0 lg:truncate" :title="note"
    >· {{ note }}</span
  >
  <button
    v-if="worked.isLastAccess"
    type="button"
    class="relative ml-auto shrink-0 rounded-sm font-sans text-muted-foreground underline pointer-coarse:after:absolute pointer-coarse:after:-inset-3 pointer-coarse:after:content-[''] decoration-dotted underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
    @click="emit('show')"
  >
    Show in table
  </button>
</template>
