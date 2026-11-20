<script setup lang="ts">
defineProps<{
  /** A wire that runs up and down; its length is set by the layout, its width is the wire's. */
  vertical?: boolean;
  /** How the last instruction used this connection, if it did. */
  kind?: 'read' | 'write';
  /** Changes on every execution, so the wire lights up afresh. */
  tick: number;
}>();
</script>

<template>
  <span class="wire" :class="{ 'wire-v': vertical }" aria-hidden="true">
    <span v-if="kind" :key="tick" class="wire-lit" :data-kind="kind" />
  </span>
</template>
