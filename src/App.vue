<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, watch } from 'vue';
import { MOS6502 } from '@/core/mos6502/architecture';
import { formatInstruction as formatMos6502 } from '@/core/mos6502/instructions';
import { mos6502AluLink } from '@/core/mos6502AluLink';
import { RV32 } from '@/core/rv32/architecture';
import { formatInstruction as formatRv32 } from '@/core/rv32/instructions';
import { rv32AluLink } from '@/core/rv32AluLink';
import { X86 } from '@/core/x86/architecture';
import { formatInstruction as formatX86 } from '@/core/x86/instructions';
import { x86AluLink } from '@/core/x86AluLink';
import type { ComparedId } from '@/core/comparison';
import type { ComparisonTask } from '@/core/comparisonTasks';
import SharedProgramDialog from '@/ui/components/SharedProgramDialog.vue';
import { TooltipProvider } from '@/components/ui/tooltip';
import { analytics } from '@/ui/analyticsClient';
import type { ArchitectureId } from '@/ui/architectures';
import type { SharedProgram } from '@/ui/shareLink';
import { useAppAnalytics } from '@/ui/useAppAnalytics';
import { useComparison } from '@/ui/useComparison';
import { sound } from '@/ui/soundEngine';
import { useCpu } from '@/ui/useCpu';
import { followed, useCpuMoment } from '@/ui/useCpuMoment';
import { useFeedback } from '@/ui/useFeedback';
import { useKeyboardInset } from '@/ui/useKeyboardInset';
import { usePreferences } from '@/ui/usePreferences';
import { useSettings } from '@/ui/useSettings';
import { useShare } from '@/ui/useShare';
import { useSharedProgram } from '@/ui/useSharedProgram';
import { useTopic } from '@/ui/useTopic';

// Each workbench is its own chunk, so the first one shown does not wait for the others.
const loadX86 = () => import('@/ui/components/X86Workbench.vue');
const loadRv32 = () => import('@/ui/components/Rv32Workbench.vue');
const loadMos6502 = () => import('@/ui/components/Mos6502Workbench.vue');
const X86Workbench = defineAsyncComponent(loadX86);
const Rv32Workbench = defineAsyncComponent(loadRv32);
const Mos6502Workbench = defineAsyncComponent(loadMos6502);
const LogicWorkbench = defineAsyncComponent(() => import('@/ui/components/LogicWorkbench.vue'));
const CompareDialog = defineAsyncComponent(() => import('@/ui/components/CompareDialog.vue'));
const FeedbackDialog = defineAsyncComponent(() => import('@/ui/components/FeedbackDialog.vue'));
const SettingsDialog = defineAsyncComponent(() => import('@/ui/components/SettingsDialog.vue'));
const ShareDialog = defineAsyncComponent(() => import('@/ui/components/ShareDialog.vue'));

/** Every CPU lives for the whole visit: switching shows the other one as it was left. */
const x86 = useCpu(X86);
const rv32 = useCpu(RV32);
const mos6502 = useCpu(MOS6502);
const { architecture } = usePreferences();
const { topic } = useTopic();
useKeyboardInset();
useAppAnalytics();
const { open: comparisonOpen, wanted: comparisonWanted } = useComparison();
const { wanted: feedbackWanted } = useFeedback();
const { wanted: settingsWanted } = useSettings();
const { wanted: shareWanted } = useShare();

/** Opens a task's program on its CPU, from the comparison. */
function loadSolution(task: ComparisonTask, id: ComparedId): void {
  const from = { name: task.name, description: task.lesson };
  if (id === 'x86') x86.loadProgram(task.x86.program, from);
  else if (id === 'rv32') rv32.loadProgram(task.rv32.program, from);
  else mos6502.loadProgram(task.mos6502.program, from);
  architecture.value = id;
  comparisonOpen.value = false;
  analytics.track({ name: 'solution-loaded', architecture: id, task: task.id });
}

const programs = { x86: x86.program, rv32: rv32.program, mos6502: mos6502.program };
const programOf = (id: ArchitectureId) => programs[id].value;
/** What a share link is made of: the program of the CPU on show. */
const shownProgram = computed(() => programOf(architecture.value));

/** Opens a program that came through a share link on its CPU. */
function loadShared(shared: SharedProgram): void {
  const from = { name: 'Shared program', description: 'Opened from a link.' };
  if (shared.id === 'x86') x86.loadProgram(shared.program, from);
  else if (shared.id === 'rv32') rv32.loadProgram(shared.program, from);
  else mos6502.loadProgram(shared.program, from);
  architecture.value = shared.id;
  topic.value = 'cpu';
}
const shared = useSharedProgram({ current: programOf, load: loadShared });

// The logic topic shows the gates behind the last instruction of the CPU chosen here.
const { moment, seekShown } = useCpuMoment({
  x86: followed(x86, (record) => formatX86(record.instruction), x86AluLink),
  rv32: followed(rv32, (record) => formatRv32(record.instruction), rv32AluLink),
  mos6502: followed(mos6502, (record) => formatMos6502(record.instruction), mos6502AluLink)
});

// The others are fetched once the page is idle, so switching never shows an empty, half-loaded
// workbench while its chunk arrives.
onMounted(() => {
  const prefetch = (): void => void Promise.all([loadX86(), loadRv32(), loadMos6502()]);
  if ('requestIdleCallback' in window) requestIdleCallback(prefetch);
  else setTimeout(prefetch, 1500);
});

// A program left running on a timer would keep stepping out of sight.
watch([architecture, topic], () => {
  x86.pause();
  rv32.pause();
  mos6502.pause();
  sound.play('detent');
});
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <!-- The shell: header, the two panes of the workbench, and the transport bar under them. -->
    <div class="app-surface">
      <!-- A workbench once shown is kept, so switching back to it is instant. -->
      <KeepAlive>
        <LogicWorkbench
          v-if="topic === 'logic'"
          :moment="moment"
          @seek="seekShown"
          @back="topic = 'cpu'"
        />
        <X86Workbench v-else-if="architecture === 'x86'" :cpu="x86" />
        <Rv32Workbench v-else-if="architecture === 'rv32'" :cpu="rv32" />
        <Mos6502Workbench v-else :cpu="mos6502" />
      </KeepAlive>
    </div>
    <CompareDialog v-if="comparisonWanted" v-model:open="comparisonOpen" @load="loadSolution" />
    <FeedbackDialog v-if="feedbackWanted" />
    <SettingsDialog v-if="settingsWanted" />
    <ShareDialog v-if="shareWanted" :architecture="architecture" :program="shownProgram" />
    <SharedProgramDialog
      :pending="shared.pending.value"
      :problem="shared.problem.value"
      @accept="shared.accept"
      @dismiss="shared.dismiss"
    />
  </TooltipProvider>
</template>
