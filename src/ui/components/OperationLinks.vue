<script setup lang="ts">
import type { AluLink } from '@/core/aluLink';
import type { NumberLink } from '@/core/numberLink';
import { numbersLinkWhat, unavailableIn } from '@/ui/topicLinks';
import TopicLinkButton from './TopicLinkButton.vue';

defineProps<{
  /** Where the operation on show leads in the logic topic, and in the number topic. */
  alu: AluLink;
  numbers: NumberLink;
}>();
</script>

<!-- The ways from one operation of the CPU into the other topics. -->
<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <TopicLinkButton topic="logic" :unavailable="unavailableIn(alu)" />
    <TopicLinkButton
      topic="numbers"
      :unavailable="unavailableIn(numbers)"
      :what="numbersLinkWhat(numbers)"
    />
  </div>
</template>
