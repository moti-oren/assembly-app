<script setup lang="ts">
import { onActivated, onMounted, useTemplateRef } from 'vue';
import { TOPIC_CHOICES, type TopicId } from '@/ui/topics';
import { useTopic } from '@/ui/useTopic';
import { useTopicTabFocus } from '@/ui/useTopicTabFocus';

const { topic } = useTopic();
const tabFocus = useTopicTabFocus();

function choose(id: TopicId): void {
  if (id === topic.value) return;
  tabFocus.keep();
  topic.value = id;
}

// The tab pressed was the last page's: this page's own tab of the topic takes the focus over.
const tabs = useTemplateRef<HTMLElement>('tabs');
function takeFocus(): void {
  if (!tabFocus.take()) return;
  tabs.value?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
}
onMounted(takeFocus);
onActivated(takeFocus);
</script>

<!--
  Which topic is on show. Each keeps its state, so switching back finds it as it was left. Flat
  tabs with a bar under the one on show, then a hairline: the topics are where you are, and the
  header's one segmented control is left to the choice inside a topic.
-->
<template>
  <nav ref="tabs" class="flex shrink-0 items-stretch self-stretch" aria-label="Topic">
    <button
      v-for="choice in TOPIC_CHOICES"
      :key="choice.id"
      type="button"
      class="topic-tab"
      :aria-pressed="topic === choice.id"
      @click="choose(choice.id)"
    >
      {{ choice.label }}
    </button>
    <span class="ml-2 h-5 w-px self-center bg-border" aria-hidden="true" />
  </nav>
</template>
