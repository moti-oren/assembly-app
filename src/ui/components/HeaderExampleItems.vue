<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';

defineProps<{
  /** The example programs of the architecture on show, by name. */
  examples: readonly { name: string; description: string }[];
}>();
defineEmits<{ load: [index: number] }>();
</script>

<!-- The example programs, as the items of a menu. -->
<template>
  <DropdownMenuLabel class="text-xs font-normal text-muted-foreground">
    Replaces your program and clears the CPU and its history
  </DropdownMenuLabel>
  <DropdownMenuSeparator />
  <DropdownMenuItem
    v-for="(example, index) in examples"
    :key="example.name"
    class="flex-col items-start gap-0.5 pointer-coarse:py-2.5"
    @select="$emit('load', index)"
  >
    <span class="font-medium">{{ example.name }}</span>
    <span class="text-xs text-muted-foreground">{{ example.description }}</span>
  </DropdownMenuItem>
</template>
