<script setup lang="ts">
import type { FunctionalComponent } from 'vue';
import { useShellParts, type ShellPart } from '@/ui/useShellParts';

const props = defineProps<{ part: ShellPart }>();
const shell = useShellParts();

/** Made once, so it is patched as the page's part changes rather than mounted anew. */
const Part: FunctionalComponent = () => shell.render(props.part);
</script>

<!-- A place of the shell: what the page on show put there, or what stands in until one has. -->
<template>
  <Part v-if="shell.filled.value" />
  <slot v-else />
</template>
