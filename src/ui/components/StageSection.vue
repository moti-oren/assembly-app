<script setup lang="ts">
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

defineProps<{
  title: string;
  /** What the section is, for a screen reader, where its title changes with what is on show. */
  label?: string;
}>();
defineSlots<{
  default?: () => unknown;
  /** A quiet remark beside the title. */
  aside?: () => unknown;
  /** What the section teaches, in a sentence or two under its title. */
  lesson?: () => unknown;
}>();
</script>

<!--
  One section of a topic's stage: a panel between hairlines like the CPU's, so every page keeps
  the same rhythm (surfaces.css).
-->
<template>
  <section :aria-label="label ?? title">
    <Card size="sm">
      <CardHeader>
        <CardTitle>
          <h2>{{ title }}</h2>
        </CardTitle>
        <CardAction v-if="$slots.aside" class="text-xs text-muted-foreground">
          <slot name="aside" />
        </CardAction>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <p
          v-if="$slots.lesson"
          class="max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground"
        >
          <slot name="lesson" />
        </p>
        <slot />
      </CardContent>
    </Card>
  </section>
</template>
