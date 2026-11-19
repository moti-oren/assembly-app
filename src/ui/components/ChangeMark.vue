<script setup lang="ts">
defineProps<{
  /** Whether the last instruction changed the wrapped value. */
  on: boolean;
  /** Whether it wrote the value, which may have stayed the same; only shown when it did. */
  written?: boolean;
  /** Changes on every execution, so the flash replays even when the same value changes twice. */
  tick: number;
}>();
import { useLocale } from '@/ui/useLocale';
const { t } = useLocale();
</script>

<template>
  <span
    class="change-mark"
    :class="{
      'bg-changed text-changed-foreground': on,
      'change-mark-written': written && !on
    }"
  >
    <span v-if="on" :key="tick" class="change-flash" aria-hidden="true" />
    <slot />
    <span v-if="written && !on" class="sr-only">{{ t.changes.writtenSame }}</span>
  </span>
</template>
