<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { ARCHITECTURE_CHOICES } from '@/ui/architectures';
import { usePreferences } from '@/ui/usePreferences';

const { architecture } = usePreferences();
</script>

<!-- Each CPU keeps its own program and history, so switching back finds them as they were. -->
<template>
  <div
    class="segmented shrink-0"
    :style="{
      '--segments': ARCHITECTURE_CHOICES.length,
      '--active': ARCHITECTURE_CHOICES.findIndex((choice) => choice.id === architecture)
    }"
    role="group"
    aria-label="Architecture"
  >
    <Button
      v-for="choice in ARCHITECTURE_CHOICES"
      :key="choice.id"
      variant="ghost"
      size="sm"
      class="h-7 px-3 text-xs max-sm:px-2 pointer-coarse:h-10"
      :aria-pressed="architecture === choice.id"
      @click="architecture = choice.id"
    >
      {{ choice.label }}
    </Button>
  </div>
</template>
