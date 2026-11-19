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
import { useLocale } from '@/ui/useLocale';

/** How many instructions the history holds, undone ones included. */
defineProps<{ instructions: number }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ confirm: [] }>();
const { t } = useLocale();
</script>

<template>
  <!-- A reset clears the history too, so Undo cannot bring the state back. -->
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t.resetDialog.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{
          t.resetDialog.description(instructions)
        }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t.resetDialog.keep }}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          {{ t.resetDialog.confirm }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
