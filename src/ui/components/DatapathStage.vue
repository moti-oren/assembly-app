<script setup lang="ts">
import type { StageView } from '@/ui/rv32Datapath';

defineProps<{
  title: string;
  /** The stage's short name, as pipeline diagrams write it: IF, ID, EX, MEM, WB. */
  tag: string;
  stage: StageView;
  /** Changes with every execution and phase, so a used stage lights up afresh. */
  tick: number;
}>();
</script>

<template>
  <section
    class="relative min-w-0 overflow-hidden chip-block rounded-lg border px-2.5 py-2 transition duration-300"
    :class="{
      'border-pointer/60': stage.use === 'read',
      'border-written/70': stage.use === 'write',
      'unit-idle': !stage.use
    }"
    :aria-label="title"
  >
    <span
      v-if="stage.use"
      :key="tick"
      class="wire-lit absolute inset-x-0 top-0 h-0.5"
      :data-kind="stage.use"
      aria-hidden="true"
    />
    <h3 class="unit-title">
      {{ title }} <span>{{ tag }}</span>
    </h3>
    <p class="mt-1 font-mono text-xs break-words" :class="{ 'text-muted-foreground': !stage.use }">
      {{ stage.text }}
    </p>
    <slot />
  </section>
</template>
