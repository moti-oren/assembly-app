<script setup lang="ts">
import { defineAsyncComponent, watch } from 'vue';
import { RV32 } from '@/core/rv32/architecture';
import { X86 } from '@/core/x86/architecture';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCpu } from '@/ui/useCpu';
import { usePreferences } from '@/ui/usePreferences';

// Each workbench is loaded when it is first shown: most visits only ever see one of them.
const X86Workbench = defineAsyncComponent(() => import('@/ui/components/X86Workbench.vue'));
const Rv32Workbench = defineAsyncComponent(() => import('@/ui/components/Rv32Workbench.vue'));

/** Both CPUs live for the whole visit: switching shows the other one as it was left. */
const x86 = useCpu(X86);
const rv32 = useCpu(RV32);
const { architecture } = usePreferences();

// A program left running on a timer would keep stepping out of sight.
watch(architecture, () => {
  x86.pause();
  rv32.pause();
});
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <!-- The page scrolls as a whole: every panel keeps its own height instead of sharing one window. -->
    <div class="app-surface flex min-h-svh flex-col bg-muted/40 dark:bg-background">
      <X86Workbench v-if="architecture === 'x86'" :cpu="x86" />
      <Rv32Workbench v-else :cpu="rv32" />
    </div>
  </TooltipProvider>
</template>
