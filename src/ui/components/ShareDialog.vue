<script setup lang="ts">
import { nextTick, watch } from 'vue';
import { Check, Copy } from '@lucide/vue';
import type { ProgramInstruction } from '@/core/shared/program';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { architectureLabel, type ArchitectureId } from '@/ui/architectures';
import { useShare } from '@/ui/useShare';
import { useShareLink } from '@/ui/useShareLink';

const props = defineProps<{
  /** The CPU on show, and its program: what the link opens. */
  architecture: ArchitectureId;
  program: readonly ProgramInstruction[];
}>();

const { open } = useShare();
const { link, long, copied, failed, copy } = useShareLink(() => props, open);

function selectAll(event: FocusEvent): void {
  if (event.target instanceof HTMLInputElement) event.target.select();
}

// The field takes the focus as the dialog opens, before the link is made: once the link is in it,
// it is picked whole, so a copy by hand takes all of it.
watch(link, async (value) => {
  if (!value) return;
  await nextTick();
  const field = document.querySelector<HTMLInputElement>('[data-share-link]');
  if (field && field === document.activeElement) field.select();
});

/** What opened the dialog may be gone by the time it closes (the palette, a phone's sheet). */
function returnFocus(event: Event): void {
  const opener = document.querySelector<HTMLElement>('[data-share-opener]');
  if (!opener) return;
  event.preventDefault();
  opener.focus();
}
</script>

<!-- The link that opens this program on someone else's screen. -->
<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md" @close-auto-focus="returnFocus">
      <DialogHeader>
        <DialogTitle>Share this program</DialogTitle>
        <DialogDescription>
          Whoever opens this link gets the program on the {{ architectureLabel(architecture) }},
          ready to run.
        </DialogDescription>
      </DialogHeader>

      <div class="flex gap-2">
        <Input
          :model-value="link"
          readonly
          aria-label="Link to this program"
          data-share-link
          class="font-mono text-xs pointer-coarse:h-11"
          @focus="selectAll"
        />
        <Button class="shrink-0 pointer-coarse:h-11" :disabled="link === ''" @click="copy">
          <component :is="copied ? Check : Copy" class="face-swap" aria-hidden="true" />
          {{ copied ? 'Copied' : 'Copy link' }}
        </Button>
      </div>

      <p aria-live="polite" class="sr-only">{{ copied ? 'Link copied' : '' }}</p>
      <p v-if="failed" role="alert" class="notice-arrive text-sm text-destructive">
        It could not be copied. Select the link and copy it yourself.
      </p>
      <p v-if="long" class="text-xs text-muted-foreground">
        This is a long link: some chat and mail apps cut long links short.
      </p>
      <p class="text-xs text-muted-foreground">
        The program is in the link itself ({{ program.length }}
        {{ program.length === 1 ? 'line' : 'lines' }}). Nothing is uploaded, and the registers,
        memory and history are not part of it.
      </p>
    </DialogContent>
  </Dialog>
</template>
