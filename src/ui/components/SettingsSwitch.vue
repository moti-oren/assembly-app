<script setup lang="ts">
defineProps<{ disabled?: boolean }>();
const on = defineModel<boolean>({ required: true });
</script>

<!-- A setting that is on or off. Its name comes from the row it is in. -->
<template>
  <button
    type="button"
    role="switch"
    class="flex items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:py-3 pointer-coarse:pl-2"
    :aria-checked="on"
    :disabled="disabled"
    @click="on = !on"
  >
    <span class="sheet-switch" aria-hidden="true" />
  </button>
</template>
