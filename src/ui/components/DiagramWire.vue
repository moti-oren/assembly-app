<script setup lang="ts">
defineProps<{
  /** How the last instruction used this connection, if it did. */
  kind?: 'read' | 'write';
  /** Changes on every execution, so the wire lights up afresh. */
  tick: number;
}>();
</script>

<template>
  <span class="wire" aria-hidden="true">
    <span v-if="kind" :key="tick" class="wire-lit" :data-kind="kind" />
  </span>
</template>
