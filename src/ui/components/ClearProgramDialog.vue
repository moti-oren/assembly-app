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

const { t } = useLocale();

defineProps<{ lines: number }>();
const open = defineModel<boolean>('open', { required: true });
const emit = defineEmits<{ confirm: [] }>();
</script>

<template>
  <!-- Undo steps through executed instructions only, so a cleared program cannot come back. -->
  <AlertDialog v-model:open="open">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ t.clearDialog.title(lines) }}</AlertDialogTitle>
        <AlertDialogDescription>{{ t.clearDialog.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>{{ t.clearDialog.keep }}</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="emit('confirm')">
          {{ t.clearDialog.confirm }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
