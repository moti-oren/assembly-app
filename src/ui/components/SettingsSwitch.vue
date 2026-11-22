<script setup lang="ts">
const props = defineProps<{
  /** It cannot be changed, but it keeps the focus, so its row can still say why. */
  disabled?: boolean;
}>();
const on = defineModel<boolean>({ required: true });

function flip(): void {
  if (!props.disabled) on.value = !on.value;
}
</script>

<!-- A setting that is on or off. Its name comes from the row it is in. -->
<template>
  <button
    type="button"
    role="switch"
    class="flex items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 pointer-coarse:py-3 pointer-coarse:pl-2"
    :aria-checked="on"
    :aria-disabled="disabled || undefined"
    @click="flip"
  >
    <span class="sheet-switch" aria-hidden="true" />
  </button>
</template>
