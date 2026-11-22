<script setup lang="ts">
import type { PaletteCommand } from '@/ui/paletteCommand';
import AppErrorNotice from './AppErrorNotice.vue';
import AppHeader from './AppHeader.vue';
import ClearProgramDialog from './ClearProgramDialog.vue';
import CommandPalette from './CommandPalette.vue';
import ResetCpuDialog from './ResetCpuDialog.vue';

defineProps<{
  examples: readonly { name: string; description: string }[];
  commands: PaletteCommand[];
  /** Lines that clearing the program would lose. */
  programLength: number;
  /** Instructions a reset would lose, undone ones included. */
  historyLength: number;
}>();

const emit = defineEmits<{
  loadExample: [index: number];
  /** Confirmed: clear the program. */
  clearProgram: [];
  /** Confirmed: reset the CPU and drop the history. */
  resetCpu: [];
}>();

const examplesOpen = defineModel<boolean>('examplesOpen', { required: true });
const paletteOpen = defineModel<boolean>('paletteOpen', { required: true });
const clearAsked = defineModel<boolean>('clearAsked', { required: true });
const resetAsked = defineModel<boolean>('resetAsked', { required: true });
</script>

<!-- What surrounds the panels of every architecture: the header, the palette and the dialogs. -->
<template>
  <AppHeader
    v-model:examples-open="examplesOpen"
    :examples="examples"
    @load-example="emit('loadExample', $event)"
    @commands="paletteOpen = true"
  />
  <CommandPalette v-model:open="paletteOpen" :commands="commands" />
  <ClearProgramDialog
    v-model:open="clearAsked"
    :lines="programLength"
    @confirm="emit('clearProgram')"
  />
  <ResetCpuDialog
    v-model:open="resetAsked"
    :instructions="historyLength"
    @confirm="emit('resetCpu')"
  />
  <AppErrorNotice />
</template>
