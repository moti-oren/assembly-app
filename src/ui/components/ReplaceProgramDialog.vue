<script setup lang="ts">
import { computed } from 'vue';
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
import { useReplaceGuard } from '@/ui/useReplaceGuard';

const { pending, asked, confirm, cancel } = useReplaceGuard();

const open = computed({
  get: () => pending.value !== null,
  set: (value) => {
    if (!value) cancel();
  }
});
</script>

<!-- The question before an example, a challenge or a task replaces the learner's program. -->
<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Replace your program?</AlertDialogTitle>
        <AlertDialogDescription v-if="asked">
          “{{ asked.name }}” takes the place of your {{ asked.lines }}
          {{ asked.lines === 1 ? 'line' : 'lines' }} and starts the CPU afresh. Your program can't
          be restored with Undo.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep my program</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="confirm">Replace it</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
