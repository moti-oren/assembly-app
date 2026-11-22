<script setup lang="ts">
import { X } from '@lucide/vue';
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui';
import { Button } from '@/components/ui/button';
import { DialogOverlay } from '@/components/ui/dialog';

defineProps<{
  /** What the sheet holds: its heading. */
  title: string;
  /** One line under the heading, for a screen reader. */
  description: string;
}>();

const open = defineModel<boolean>('open', { default: false });
</script>

<!--
  A phone's sheet: the full width of the screen, risen from its foot over a scrim that closes it.
  What is inside sets its own rows; a part marked `data-sheet-scroll` takes the room left and scrolls.
-->
<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay />
      <DialogContent
        class="bottom-sheet data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
      >
        <div class="bottom-sheet-handle" aria-hidden="true" />
        <div class="flex items-center justify-between gap-2 pl-1">
          <DialogTitle class="text-sm font-semibold">{{ title }}</DialogTitle>
          <DialogClose as-child>
            <Button variant="ghost" size="icon-sm" class="size-11 text-muted-foreground">
              <X />
              <span class="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>
        <DialogDescription class="sr-only">{{ description }}</DialogDescription>
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
