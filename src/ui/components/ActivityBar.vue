<script setup lang="ts">
import { MessageSquare, Settings } from '@lucide/vue';
import { TOPIC_CHOICES } from '@/ui/topics';
import { useFeedback } from '@/ui/useFeedback';
import { useSettings } from '@/ui/useSettings';
import { useTopic } from '@/ui/useTopic';
import TopicIcon from './TopicIcon.vue';

const { topic } = useTopic();
const feedback = useFeedback();
const settings = useSettings();
</script>

<!--
  The column down the left edge of a desktop, VS Code style: the topics at the top, and at the
  foot what belongs to the app rather than to a page. Part of the shell, so it stays as pages
  change, and a topic pressed keeps the focus.
-->
<template>
  <div class="activity-bar">
    <nav class="flex flex-col" aria-label="Topics">
      <button
        v-for="choice in TOPIC_CHOICES"
        :key="choice.id"
        type="button"
        class="activity-item"
        :title="choice.title"
        :aria-current="topic === choice.id ? 'page' : undefined"
        @click="topic = choice.id"
      >
        <TopicIcon :topic="choice.id" />
        <span>{{ choice.label }}</span>
      </button>
    </nav>
    <div class="mt-auto flex flex-col">
      <button
        v-if="feedback.available"
        type="button"
        class="activity-item"
        title="Send feedback"
        aria-label="Send feedback"
        aria-haspopup="dialog"
        data-feedback-opener
        @click="feedback.open.value = true"
      >
        <MessageSquare aria-hidden="true" />
        <span aria-hidden="true">Feedback</span>
      </button>
      <button
        type="button"
        class="activity-item"
        title="Settings"
        aria-haspopup="dialog"
        data-settings-opener
        @click="settings.open.value = true"
      >
        <Settings aria-hidden="true" />
        <span>Settings</span>
      </button>
    </div>
  </div>
</template>
