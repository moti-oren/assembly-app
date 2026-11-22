<script setup lang="ts">
import { Ellipsis } from '@lucide/vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { Button } from '@/components/ui/button';
import BottomSheet from './BottomSheet.vue';

defineProps<{
  /**
   * On a phone: the button is framed like the bar's other buttons, at their height, and the
   * controls rise in a sheet instead of floating over the bar.
   */
  sheet?: boolean;
}>();

/** Open while the controls are on show; one of them can close it (a reset asks to confirm). */
const open = defineModel<boolean>('open', { default: false });
</script>

<!-- The controls a narrow bar has no room for, a tap away above it. -->
<template>
  <template v-if="sheet">
    <Button
      variant="outline"
      size="icon-sm"
      class="size-11 shrink-0 text-muted-foreground"
      aria-label="More controls"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="open = true"
    >
      <Ellipsis />
    </Button>
    <BottomSheet
      v-model:open="open"
      title="More controls"
      description="The history, the run speed, a reset and the panels on show."
    >
      <div class="flex flex-col gap-3 pb-1">
        <slot />
      </div>
    </BottomSheet>
  </template>
  <PopoverRoot v-else v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-muted-foreground pointer-coarse:size-11"
        aria-label="More controls"
      >
        <Ellipsis />
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="10"
        :collision-padding="12"
        class="z-50 flex w-80 max-w-[calc(100vw-1.5rem)] flex-col gap-3 rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-(--shadow-overlay) outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
