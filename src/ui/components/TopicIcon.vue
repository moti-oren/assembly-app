<script setup lang="ts">
import { Binary, CircuitBoard, Cpu, MemoryStick, Workflow } from '@lucide/vue';
import type { TopicId } from '@/ui/topics';

defineProps<{ topic: TopicId }>();

const ICONS = {
  cpu: Cpu,
  logic: CircuitBoard,
  numbers: Binary,
  storage: MemoryStick,
  control: Workflow
};
</script>

<!-- The icon of a topic, the same wherever the way into it is drawn. -->
<template>
  <component :is="ICONS[topic]" aria-hidden="true" />
</template>
