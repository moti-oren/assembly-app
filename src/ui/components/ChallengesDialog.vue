<script setup lang="ts">
import { watch } from 'vue';
import { Check } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { architectureLabel, type ArchitectureId } from '@/ui/architectures';
import { solvedText, type ChallengeInfo } from '@/ui/challengeView';
import { useChallenges } from '@/ui/useChallenges';

defineProps<{
  /** The CPU on show, whose challenges these are. */
  architecture: ArchitectureId;
  challenges: readonly ChallengeInfo[];
}>();

const emit = defineEmits<{ start: [id: string] }>();

const { open, active, solved } = useChallenges();

/**
 * A challenge is started once the list has closed: the page then puts the focus on its panel,
 * and the list must not hand it back to the button that opened it.
 */
let starting: string | null = null;
watch(open, (isOpen) => {
  if (isOpen) starting = null;
});
function start(id: string): void {
  starting = id;
  open.value = false;
}
function onCloseAutoFocus(event: Event): void {
  const id = starting;
  starting = null;
  if (id === null) return;
  event.preventDefault();
  emit('start', id);
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)] sm:max-w-xl"
      @close-auto-focus="onCloseAutoFocus"
    >
      <DialogHeader>
        <DialogTitle>Challenges for the {{ architectureLabel(architecture) }}</DialogTitle>
        <DialogDescription>
          A small task each. Write the program; it is checked as you go, by running it on a CPU of
          its own.
        </DialogDescription>
      </DialogHeader>
      <ul class="-mr-2 flex min-h-0 flex-col gap-2 overflow-y-auto pr-2">
        <li
          v-for="challenge in challenges"
          :key="challenge.id"
          class="flex items-start gap-3 rounded-lg border bg-card/60 px-3 py-2.5"
        >
          <div class="min-w-0 flex-1">
            <h3 class="flex items-center gap-1.5 text-sm font-semibold">
              {{ challenge.title }}
              <Check
                v-if="solved[challenge.id] !== undefined"
                class="size-4 stroke-[3]"
                aria-hidden="true"
              />
            </h3>
            <p class="mt-0.5 text-sm leading-relaxed text-pretty text-muted-foreground">
              {{ challenge.brief }}
            </p>
            <p v-if="solved[challenge.id] !== undefined" class="mt-1 text-xs">
              {{ solvedText(solved[challenge.id], challenge.par) }}
            </p>
          </div>
          <Button
            :variant="active[architecture] === challenge.id ? 'outline' : 'secondary'"
            size="sm"
            class="min-w-24 shrink-0 pointer-coarse:h-11"
            :aria-label="`${active[architecture] === challenge.id ? 'Start over' : 'Start'}: ${challenge.title}`"
            @click="start(challenge.id)"
          >
            {{ active[architecture] === challenge.id ? 'Start over' : 'Start' }}
          </Button>
        </li>
      </ul>
      <p class="text-xs text-muted-foreground">
        Starting a challenge replaces that CPU's program and clears its history, as an example does.
      </p>
    </DialogContent>
  </Dialog>
</template>
