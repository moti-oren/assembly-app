<script setup lang="ts" generic="Id extends string | number">
import { Button } from '@/components/ui/button';

defineProps<{
  /** What is being chosen, for a screen reader and over the choices when `titled`. */
  label: string;
  choices: readonly { id: Id; label: string }[];
  /** The choice that is on; null when none is. */
  chosen: Id | null;
  /** With its label written over the choices: where the section's own title does not say it. */
  titled?: boolean;
  /** The choices are names from the CPU, such as registers. */
  mono?: boolean;
}>();
defineEmits<{ pick: [id: Id] }>();
</script>

<!-- One choice among a few, in a topic's sidebar: the buttons wrap where they do not fit. -->
<template>
  <div>
    <h3 v-if="titled" class="mb-(--sublabel-gap) text-xs font-semibold">{{ label }}</h3>
    <div class="toggle-group flex-wrap" role="group" :aria-label="label">
      <Button
        v-for="choice in choices"
        :key="choice.id"
        variant="ghost"
        size="sm"
        class="h-7 px-2.5 text-xs pointer-coarse:h-11 pointer-coarse:min-w-11"
        :class="{ 'font-mono': mono }"
        :aria-pressed="chosen === choice.id"
        @click="$emit('pick', choice.id)"
      >
        {{ choice.label }}
      </Button>
    </div>
  </div>
</template>
