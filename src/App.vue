<script setup lang="ts">
import { X86 } from '@/core/x86/architecture';
import { TooltipProvider } from '@/components/ui/tooltip';
import X86Workbench from '@/ui/components/X86Workbench.vue';
import { useCpu } from '@/ui/useCpu';

const x86 = useCpu(X86);
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <!-- The page scrolls as a whole: every panel keeps its own height instead of sharing one window. -->
    <div class="app-surface flex min-h-svh flex-col bg-muted/40 dark:bg-background">
      <X86Workbench :cpu="x86" />
    </div>
  </TooltipProvider>
</template>
