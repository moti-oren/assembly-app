<script setup lang="ts">
import { watch } from 'vue';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';

defineProps<{ lines: number }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ confirm: [] }>();

/**
 * The program is cleared once the dialog has closed, and the focus is the page's to place: the
 * button that opened the dialog is gone with the lines, and the focus would fall to the page.
 */
let confirmed = false;
// A dialog that closed without its close event leaves no stale yes for the next one.
watch(open, (isOpen) => {
  if (isOpen) confirmed = false;
});
function onCloseAutoFocus(event: Event): void {
  if (!confirmed) return;
  confirmed = false;
  event.preventDefault();
  emit('confirm');
}
</script>

<template>
  <!-- Undo steps through executed instructions only, so a cleared program cannot come back. -->
  <AlertDialog v-model:open="open">
    <AlertDialogContent @close-auto-focus="onCloseAutoFocus">
      <AlertDialogHeader>
        <AlertDialogTitle>
          Clear all {{ lines }} {{ lines === 1 ? 'line' : 'lines' }}?
        </AlertDialogTitle>
        <AlertDialogDescription>The program can't be restored with Undo.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep the program</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="confirmed = true">
          Clear the program
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
