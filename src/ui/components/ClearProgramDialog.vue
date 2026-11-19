<script setup lang="ts">
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
</script>

<template>
  <!-- Undo steps through executed instructions only, so a cleared program cannot come back. -->
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>
          Clear all {{ lines }} {{ lines === 1 ? 'line' : 'lines' }}?
        </AlertDialogTitle>
        <AlertDialogDescription>The program can't be restored with Undo.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep the program</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          Clear the program
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
