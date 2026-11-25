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
import { architectureLabel } from '@/ui/architectures';
import type { ShareProblem, SharedProgram } from '@/ui/shareLink';

defineProps<{
  /** A shared program that would replace the one this CPU holds. */
  pending: SharedProgram | null;
  /** Why the link that was opened gave no program. */
  problem: ShareProblem | null;
  /** How many lines the program it would replace holds. */
  replacedLines: number;
}>();
// The dialog closes itself on either answer, so `accept` names its program: by the time it is
// heard, `dismiss` may already have cleared the one that waited.
const emit = defineEmits<{ accept: [shared: SharedProgram]; dismiss: [] }>();
</script>

<!-- What a share link needs said: it would replace a program, or it could not be read. -->
<template>
  <AlertDialog
    :open="pending !== null || problem !== null"
    @update:open="$event || emit('dismiss')"
  >
    <AlertDialogContent v-if="pending">
      <AlertDialogHeader>
        <AlertDialogTitle>Open the shared program?</AlertDialogTitle>
        <AlertDialogDescription>
          This link holds a program for the {{ architectureLabel(pending.id) }} ({{
            pending.program.length
          }}
          {{ pending.program.length === 1 ? 'line' : 'lines' }}). Opening it replaces your
          {{ architectureLabel(pending.id) }} program ({{ replacedLines }}
          {{ replacedLines === 1 ? 'line' : 'lines' }}), and resets that CPU. This can't be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep my program</AlertDialogCancel>
        <AlertDialogAction variant="destructive" @click="emit('accept', pending)">
          Open the shared program
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
    <AlertDialogContent v-else-if="problem">
      <AlertDialogHeader>
        <AlertDialogTitle>This link could not be opened</AlertDialogTitle>
        <AlertDialogDescription>
          {{
            problem === 'newer'
              ? 'It was made by a newer version of CPU Playground. Reload the page to get the latest version, then open the link again.'
              : 'It holds no program this app can read: it may have been cut short on the way. Ask for the link again.'
          }}
          Your own program was not changed.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogAction @click="emit('dismiss')">OK</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
