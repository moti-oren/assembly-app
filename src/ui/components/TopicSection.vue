<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTopicSections } from '@/ui/useTopicSections';
import SidebarSection from './SidebarSection.vue';

defineProps<{
  /** The section's name in storage, where whether it is collapsed is remembered. */
  storageKey: string;
  label: string;
}>();

const sections = useTopicSections();
</script>

<!-- One section of a topic's sidebar: a panel like the CPU's, which folds to its header. -->
<template>
  <SidebarSection
    :label="label"
    :collapsed="sections.isCollapsed(storageKey)"
    :closable="false"
    :resizable="false"
    fixed
    @toggle="sections.toggle(storageKey)"
  >
    <Card size="sm">
      <CardHeader>
        <CardTitle role="heading" aria-level="2">
          <h2>{{ label }}</h2>
        </CardTitle>
      </CardHeader>
      <!-- It scrolls when the section is short, and a browser then makes it a tab stop: named. -->
      <CardContent role="group" :aria-label="label">
        <slot />
      </CardContent>
    </Card>
  </SidebarSection>
</template>
