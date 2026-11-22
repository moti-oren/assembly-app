<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { TOPIC_CHOICES } from '@/ui/topics';
import { useTopic } from '@/ui/useTopic';

const { topic } = useTopic();
</script>

<!-- Which topic is on show. Each keeps its state, so switching back finds it as it was left. -->
<template>
  <div
    class="segmented shrink-0"
    :style="{
      '--segments': TOPIC_CHOICES.length,
      '--active': TOPIC_CHOICES.findIndex((choice) => choice.id === topic)
    }"
    role="group"
    aria-label="Topic"
  >
    <Button
      v-for="choice in TOPIC_CHOICES"
      :key="choice.id"
      variant="ghost"
      size="sm"
      class="h-7 px-3 text-xs pointer-coarse:h-10"
      :aria-pressed="topic === choice.id"
      @click="topic = choice.id"
    >
      {{ choice.label }}
    </Button>
  </div>
</template>
