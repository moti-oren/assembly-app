<script setup lang="ts">
import { Info } from '@lucide/vue';
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import { Button } from '@/components/ui/button';

defineProps<{
  /** What the explanation is about, for the button's accessible name. */
  label: string;
}>();
</script>

<template>
  <!--
    A panel's standing explanation, kept out of the way until asked for. A click rather than a
    hover opens it, so it works on a touch screen and stays open while it is read.
  -->
  <PopoverRoot>
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="icon-xs"
        class="text-muted-foreground hover:text-foreground pointer-coarse:size-11"
        :aria-label="label"
      >
        <Info />
      </Button>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="bottom"
        align="start"
        :side-offset="6"
        :collision-padding="16"
        class="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-md outline-hidden data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <slot />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
