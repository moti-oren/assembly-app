<script setup lang="ts" generic="Id extends string | number">
import { Button } from '@/components/ui/button';

defineProps<{
  /** What is being chosen, for a screen reader and over the choices when `titled`. */
  label: string;
  choices: readonly { id: Id; label: string }[];
  /** The choice that is on; null when none is. */
  chosen: Id | null;
  /** The choices that cannot be picked for what is on show; none when left out. */
  disabled?: readonly Id[];
  /** With its label written over the choices: where the section's own title does not say it. */
  titled?: boolean;
  /** The choices are names from the CPU, such as registers. */
  mono?: boolean;
  /**
   * Lays the choices out in this many equal columns, for a list too long for one row: its rows
   * then fill, where wrapping would leave the last choice alone on a line of its own.
   */
  columns?: number;
}>();
defineEmits<{ pick: [id: Id] }>();
</script>

<!-- One choice among a few, in a topic's sidebar. -->
<template>
  <div>
    <h3 v-if="titled" class="mb-(--sublabel-gap) text-xs font-semibold">{{ label }}</h3>
    <div
      class="toggle-group"
      :class="columns ? 'grid w-full' : 'flex-wrap'"
      :style="columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined"
      role="group"
      :aria-label="label"
    >
      <Button
        v-for="choice in choices"
        :key="choice.id"
        variant="ghost"
        size="sm"
        class="h-7 text-xs pointer-coarse:h-11 pointer-coarse:min-w-11"
        :class="[columns ? 'px-1' : 'px-2.5', { 'font-mono': mono }]"
        :disabled="disabled?.includes(choice.id)"
        :aria-pressed="chosen === choice.id"
        @click="$emit('pick', choice.id)"
      >
        {{ choice.label }}
      </Button>
    </div>
  </div>
</template>
