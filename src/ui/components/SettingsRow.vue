<script setup lang="ts">
import { useId } from 'vue';

defineProps<{
  label: string;
  description?: string;
  /** The control goes under the text, where it is too wide to sit beside it. */
  stacked?: boolean;
}>();

const id = useId();
</script>

<!-- One setting: what it is and what it does, with its control (the slot) at the end of the row. -->
<template>
  <div
    class="flex gap-x-6 gap-y-2.5 border-t py-3.5 first:border-t-0"
    :class="stacked ? 'flex-col' : 'items-center justify-between max-sm:gap-x-4'"
  >
    <div class="min-w-0">
      <p :id="`${id}-label`" class="text-sm font-medium">{{ label }}</p>
      <p
        v-if="description"
        :id="`${id}-description`"
        class="mt-0.5 text-xs leading-relaxed text-pretty text-muted-foreground"
      >
        {{ description }}
      </p>
    </div>
    <div class="shrink-0" :class="{ 'self-start': stacked }">
      <slot
        :named="{
          'aria-labelledby': `${id}-label`,
          'aria-describedby': description ? `${id}-description` : undefined
        }"
      />
    </div>
  </div>
</template>
