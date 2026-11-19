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

/** How many instructions the history holds, undone ones included. */
defineProps<{ instructions: number }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <!-- A reset clears the history too, so Undo cannot bring the state back. -->
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reset the CPU?</AlertDialogTitle>
        <AlertDialogDescription>
          Registers, flags and memory go back to their start values, and the history is cleared ({{
            instructions
          }}
          {{ instructions === 1 ? 'instruction' : 'instructions' }}). The program is kept. This
          can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep the current state</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          Reset the CPU
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
