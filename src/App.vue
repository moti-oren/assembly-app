<script setup lang="ts">
import { defineAsyncComponent, watch } from 'vue';
import { MOS6502 } from '@/core/mos6502/architecture';
import { RV32 } from '@/core/rv32/architecture';
import { X86 } from '@/core/x86/architecture';
import type { ComparedId } from '@/core/comparison';
import type { ComparisonTask } from '@/core/comparisonTasks';
import { ConfigProvider } from 'reka-ui';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useComparison } from '@/ui/useComparison';
import { useLocale } from '@/ui/useLocale';
import { useCpu } from '@/ui/useCpu';
import { usePreferences } from '@/ui/usePreferences';

// Each workbench is loaded when it is first shown: most visits only ever see one of them.
const X86Workbench = defineAsyncComponent(() => import('@/ui/components/X86Workbench.vue'));
const Rv32Workbench = defineAsyncComponent(() => import('@/ui/components/Rv32Workbench.vue'));
const Mos6502Workbench = defineAsyncComponent(() => import('@/ui/components/Mos6502Workbench.vue'));
const CompareDialog = defineAsyncComponent(() => import('@/ui/components/CompareDialog.vue'));

/** Every CPU lives for the whole visit: switching shows the other one as it was left. */
const x86 = useCpu(X86);
const rv32 = useCpu(RV32);
const mos6502 = useCpu(MOS6502);
const { architecture } = usePreferences();
const { direction } = useLocale();
const { open: comparisonOpen, wanted: comparisonWanted } = useComparison();

/** Opens a task's program on its CPU, from the comparison. */
function loadSolution(task: ComparisonTask, id: ComparedId): void {
  if (id === 'x86') x86.loadProgram(task.x86.program);
  else if (id === 'rv32') rv32.loadProgram(task.rv32.program);
  else mos6502.loadProgram(task.mos6502.program);
  architecture.value = id;
  comparisonOpen.value = false;
}

// A program left running on a timer would keep stepping out of sight.
watch(architecture, () => {
  x86.pause();
  rv32.pause();
  mos6502.pause();
});
</script>

<template>
  <!-- The menus, tooltips and dialogs of reka-ui open and move by this direction, not the page's. -->
  <ConfigProvider :dir="direction">
    <TooltipProvider :delay-duration="250">
      <!-- The page scrolls as a whole: every panel keeps its own height instead of sharing one window. -->
      <div class="app-surface flex min-h-svh flex-col bg-page">
        <X86Workbench v-if="architecture === 'x86'" :cpu="x86" />
        <Rv32Workbench v-else-if="architecture === 'rv32'" :cpu="rv32" />
        <Mos6502Workbench v-else :cpu="mos6502" />
      </div>
      <CompareDialog v-if="comparisonWanted" v-model:open="comparisonOpen" @load="loadSolution" />
    </TooltipProvider>
  </ConfigProvider>
</template>
