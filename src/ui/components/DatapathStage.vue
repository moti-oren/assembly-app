<script setup lang="ts">
import type { StageView } from '@/ui/rv32Datapath';

defineProps<{
  title: string;
  /** The stage's short name, as pipeline diagrams write it: IF, ID, EX, MEM, WB. */
  tag: string;
  stage: StageView;
  /** Changes with every execution and phase, so a used stage lights up afresh. */
  tick: number;
  /** Whether the tag is a pipeline stage, set as a chip that lights up while the stage works. */
  chip?: boolean;
}>();
</script>

<template>
  <section
    class="chip-block relative min-w-0 overflow-hidden rounded-lg border px-3 py-2"
    :class="{
      'border-pointer/70': stage.use === 'read',
      'border-written/80': stage.use === 'write',
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
    <h3 class="unit-title mb-1">
      {{ title }}
      <span :class="chip ? ['stage-chip', { 'stage-chip-active': stage.use }] : ''">{{ tag }}</span>
    </h3>
    <p class="font-mono text-xs break-words" :class="{ standby: !stage.use }">
      {{ stage.text }}
    </p>
    <slot />
  </section>
</template>
