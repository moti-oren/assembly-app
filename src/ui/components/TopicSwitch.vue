<script setup lang="ts">
import { TOPIC_CHOICES } from '@/ui/topics';
import { useTopic } from '@/ui/useTopic';

const { topic } = useTopic();
</script>

<!--
  Which topic is on show. Each keeps its state, so switching back finds it as it was left. Flat
  tabs with a bar under the one on show, then a hairline: the topics are where you are, and the
  header's one segmented control is left to the choice inside a topic.
-->
<template>
  <nav class="flex shrink-0 items-stretch self-stretch" aria-label="Topic">
    <button
      v-for="choice in TOPIC_CHOICES"
      :key="choice.id"
      type="button"
      class="topic-tab"
      :aria-pressed="topic === choice.id"
      @click="topic = choice.id"
    >
      {{ choice.label }}
    </button>
    <span class="ml-2 h-5 w-px self-center bg-border" aria-hidden="true" />
  </nav>
</template>
