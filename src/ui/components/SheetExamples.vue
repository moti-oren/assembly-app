<script setup lang="ts">
defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
}>();
defineEmits<{ load: [index: number] }>();
</script>

<!-- The example programs, as the scrolling list of a phone's sheet. -->
<template>
  <h3 class="sheet-heading">Examples</h3>
  <p class="px-1 text-xs text-muted-foreground">
    Replaces your program and clears the CPU and its history
  </p>
  <ul class="scroll-fade -mx-1 px-1" data-sheet-scroll aria-label="Examples">
    <li v-for="(example, index) in examples" :key="example.name">
      <button type="button" class="sheet-row" @click="$emit('load', index)">
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="font-medium">{{ example.name }}</span>
          <span class="text-xs text-pretty text-muted-foreground">{{ example.description }}</span>
        </span>
      </button>
    </li>
  </ul>
</template>
