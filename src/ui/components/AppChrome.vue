<script setup lang="ts">
import type { PaletteCommand } from '@/ui/paletteCommand';
import ClearProgramDialog from './ClearProgramDialog.vue';
import CommandPalette from './CommandPalette.vue';
import CpuHeaderActions from './CpuHeaderActions.vue';
import CpuMenuRows from './CpuMenuRows.vue';
import ResetCpuDialog from './ResetCpuDialog.vue';
import SheetExamples from './SheetExamples.vue';
import ShellParts from './ShellParts.vue';

defineProps<{
  examples: readonly { name: string; description: string }[];
  commands: PaletteCommand[];
  /** Lines of the program: what clearing it would lose, and whether there is one to share. */
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
defineSlots<{
  /** The last result, under the header below a desktop. */
  strip(): unknown;
  /** What sits on the transport bar, such as a guess to make. */
  above(): unknown;
  /** The transport bar's controls. */
  bar(): unknown;
}>();

/** The examples: a menu in the header on a desktop, the header's one menu below that. */
const examplesOpen = defineModel<boolean>('examplesOpen', { required: true });
const paletteOpen = defineModel<boolean>('paletteOpen', { required: true });
const clearAsked = defineModel<boolean>('clearAsked', { required: true });
const resetAsked = defineModel<boolean>('resetAsked', { required: true });

function loadFromMenu(index: number): void {
  examplesOpen.value = false;
  emit('loadExample', index);
}
</script>

<!--
  What every architecture puts around its panels: its parts of the shell (the header's buttons
  and menu rows, the result strip, the transport bar), the palette and the dialogs.
-->
<template>
  <ShellParts v-model:menu-open="examplesOpen" @commands="paletteOpen = true">
    <template #actions>
      <CpuHeaderActions
        v-model:examples-open="examplesOpen"
        :examples="examples"
        :program-length="programLength"
        @load-example="emit('loadExample', $event)"
      />
    </template>
    <template #menuActions>
      <CpuMenuRows v-model:menu-open="examplesOpen" :program-length="programLength" />
    </template>
    <template #menu>
      <div class="flex min-h-0 flex-1 flex-col gap-1 border-t pt-2">
        <SheetExamples :examples="examples" @load="loadFromMenu" />
      </div>
    </template>
    <template #strip><slot name="strip" /></template>
    <template #above><slot name="above" /></template>
    <template #bar><slot name="bar" /></template>
  </ShellParts>
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
</template>
