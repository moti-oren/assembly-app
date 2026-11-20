<script setup lang="ts">
import { Ellipsis } from '@lucide/vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { Button } from '@/components/ui/button';

/** Open while the controls are on show; one of them can close it (a reset asks to confirm). */
const open = defineModel<boolean>('open', { default: false });
</script>

<!-- The controls a narrow bar has no room for, a tap away above it. -->
<template>
  <PopoverRoot v-model:open="open">
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
