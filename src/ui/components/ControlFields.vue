<script setup lang="ts">
import type { ControlLens } from '@/ui/useControlLens';

defineProps<{ lens: ControlLens }>();
</script>

<!-- The fields the word's 32 bits fall into, and which of them a decoder reads. -->
<template>
  <ol
    class="grid gap-1.5 text-xs @xl:grid-cols-2 @4xl:grid-cols-3"
    aria-label="The fields of the word"
  >
    <li
      v-for="field in lens.fields.value"
      :key="`${field.label}-${field.high}`"
      class="rounded-md border px-3 py-2"
      :class="field.decoded ? 'border-wire' : 'border-dashed border-wire text-muted-foreground'"
    >
      <p class="flex flex-wrap items-baseline gap-x-2">
        <span class="font-mono font-semibold text-foreground">{{ field.label }}</span>
        <span>{{ field.range }}</span>
        <span class="font-mono tabular-nums">{{ field.bits }}</span>
      </p>
      <p class="mt-0.5 text-pretty text-muted-foreground">
        {{ field.note }}<template v-if="field.decoded">. A decoder reads it.</template>
      </p>
    </li>
  </ol>
</template>
