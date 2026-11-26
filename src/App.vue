<script setup lang="ts">
import { computed, defineAsyncComponent, h, nextTick, onMounted, watch, type Component } from 'vue';
import { MOS6502 } from '@/core/mos6502/architecture';
import { formatInstruction as formatMos6502 } from '@/core/mos6502/instructions';
import { mos6502AluLink } from '@/core/mos6502AluLink';
import { mos6502ControlLink } from '@/core/mos6502ControlLink';
import { mos6502NumberLink } from '@/core/mos6502NumberLink';
import { mos6502RegisterLink } from '@/core/mos6502RegisterLink';
import { RV32 } from '@/core/rv32/architecture';
import { formatInstruction as formatRv32 } from '@/core/rv32/instructions';
import { rv32AluLink } from '@/core/rv32AluLink';
import { rv32ControlLink } from '@/core/rv32ControlLink';
import { memoryBefore } from '@/core/rv32ControlMemory';
import { rv32NumberLink } from '@/core/rv32NumberLink';
import { rv32RegisterLink } from '@/core/rv32RegisterLink';
import { X86 } from '@/core/x86/architecture';
import { formatInstruction as formatX86 } from '@/core/x86/instructions';
import { x86AluLink } from '@/core/x86AluLink';
import { x86ControlLink } from '@/core/x86ControlLink';
import { x86NumberLink } from '@/core/x86NumberLink';
import { x86RegisterLink } from '@/core/x86RegisterLink';
import { hasCircuit } from '@/core/aluLink';
import { hasControl } from '@/core/controlLink';
import { hasNumbers } from '@/core/numberLink';
import { hasRegisters } from '@/core/registerLink';
import type { ComparedId } from '@/core/comparison';
import type { ComparisonTask } from '@/core/comparisonTasks';
import PageSkeleton from '@/ui/components/PageSkeleton.vue';
import ReplaceProgramDialog from '@/ui/components/ReplaceProgramDialog.vue';
import SharedProgramDialog from '@/ui/components/SharedProgramDialog.vue';
import { TooltipProvider } from '@/components/ui/tooltip';
import { analytics } from '@/ui/analyticsClient';
import { ARCHITECTURE_CHOICES, type ArchitectureId } from '@/ui/architectures';
import type { SharedProgram } from '@/ui/shareLink';
import { useAppAnalytics } from '@/ui/useAppAnalytics';
import { startChallenge } from '@/ui/useChallenge';
import { useChallenges } from '@/ui/useChallenges';
import { useComparison } from '@/ui/useComparison';
import { useReplaceGuard } from '@/ui/useReplaceGuard';
import { sound } from '@/ui/soundEngine';
import { useCpu } from '@/ui/useCpu';
import { followed, useCpuMoment } from '@/ui/useCpuMoment';
import { useFeedback } from '@/ui/useFeedback';
import { useKeyboardInset } from '@/ui/useKeyboardInset';
import { usePreferences } from '@/ui/usePreferences';
import { useSettings } from '@/ui/useSettings';
import { useSidebarLayout } from '@/ui/useSidebarLayout';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import { useShare } from '@/ui/useShare';
import { useSharedProgram } from '@/ui/useSharedProgram';
import { useTopic } from '@/ui/useTopic';

// Each page is its own chunk, loaded the first time it is shown. Until it has arrived the page's
// shell stands in its place, so a switch never leaves the window empty.
const page = (loader: () => Promise<Component>, badge: string, topic = false) =>
  defineAsyncComponent({
    loader,
    loadingComponent: { render: () => h(PageSkeleton, { badge, topic }) },
    delay: 0
  });
const badgeOf = (id: ArchitectureId) =>
  ARCHITECTURE_CHOICES.find((choice) => choice.id === id)?.badge ?? '';
const loadX86 = () => import('@/ui/components/X86Workbench.vue');
const loadRv32 = () => import('@/ui/components/Rv32Workbench.vue');
const loadMos6502 = () => import('@/ui/components/Mos6502Workbench.vue');
const X86Workbench = page(loadX86, badgeOf('x86'));
const Rv32Workbench = page(loadRv32, badgeOf('rv32'));
const Mos6502Workbench = page(loadMos6502, badgeOf('mos6502'));
const LogicWorkbench = page(() => import('@/ui/components/LogicWorkbench.vue'), 'LG', true);
const NumbersWorkbench = page(() => import('@/ui/components/NumbersWorkbench.vue'), 'NM', true);
const StorageWorkbench = page(() => import('@/ui/components/StorageWorkbench.vue'), 'ST', true);
const ControlWorkbench = page(() => import('@/ui/components/ControlWorkbench.vue'), 'CU', true);
const ChallengesDialog = defineAsyncComponent(() => import('@/ui/components/ChallengesDialog.vue'));
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
const { open: challengesOpen, wanted: challengesWanted } = useChallenges();
const workbenchView = useWorkbenchView();
const sidebar = useSidebarLayout();
const { wanted: feedbackWanted } = useFeedback();
const { wanted: settingsWanted } = useSettings();
const { wanted: shareWanted } = useShare();
const replaceGuard = useReplaceGuard();

/** Opens a task's program on its CPU, from the comparison. */
function loadSolution(task: ComparisonTask, id: ComparedId): void {
  const from = { name: task.name, description: task.lesson };
  comparisonOpen.value = false;
  replaceGuard.guard(programOf(id), task[id].program, task.name, () => {
    if (id === 'x86') x86.loadProgram(task.x86.program, from);
    else if (id === 'rv32') rv32.loadProgram(task.rv32.program, from);
    else mos6502.loadProgram(task.mos6502.program, from);
    architecture.value = id;
    analytics.track({ name: 'solution-loaded', architecture: id, task: task.id });
  });
}

/** The challenges of the CPU on show, for their list. */
const shownChallenges = computed(
  () =>
    ({ x86: X86.challenges, rv32: RV32.challenges, mos6502: MOS6502.challenges })[
      architecture.value
    ]
);

/** The focus goes to a challenge's panel once it starts, where its task and goals are read. */
function focusChallenge(): void {
  void nextTick(() => document.querySelector<HTMLElement>('[data-challenge-panel]')?.focus());
}

/** Starts a challenge on the CPU on show, from the list. */
function beginChallenge(id: string): void {
  if (architecture.value === 'x86') startChallenge(x86, id, focusChallenge);
  else if (architecture.value === 'rv32') startChallenge(rv32, id, focusChallenge);
  else startChallenge(mos6502, id, focusChallenge);
  topic.value = 'cpu';
  challengesOpen.value = false;
  // Its panel is in the sidebar, which may be folded, behind a drawer or another view.
  workbenchView.show('code');
  sidebar.expand('challenge');
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

const x86Text = (record: (typeof x86.history.value)[number]) => formatX86(record.instruction);
const rv32Text = (record: (typeof rv32.history.value)[number]) => formatRv32(record.instruction);
const mos6502Text = (record: (typeof mos6502.history.value)[number]) =>
  formatMos6502(record.instruction);

// The other topics show the last instruction of the CPU chosen here: its gates, its numbers, the
// registers it wrote, and the control lines it was decoded into.
const { moment: circuitMoment, seekShown } = useCpuMoment({
  x86: followed(x86, x86Text, { link: x86AluLink, shows: hasCircuit }),
  rv32: followed(rv32, rv32Text, { link: rv32AluLink, shows: hasCircuit }),
  mos6502: followed(mos6502, mos6502Text, { link: mos6502AluLink, shows: hasCircuit })
});
const { moment: numberMoment } = useCpuMoment({
  x86: followed(x86, x86Text, { link: x86NumberLink, shows: hasNumbers }),
  rv32: followed(rv32, rv32Text, { link: rv32NumberLink, shows: hasNumbers }),
  mos6502: followed(mos6502, mos6502Text, { link: mos6502NumberLink, shows: hasNumbers })
});
const { moment: registerMoment } = useCpuMoment({
  x86: followed(x86, x86Text, {
    link: (record) => x86RegisterLink(record, x86.afterOf(record)),
    shows: hasRegisters
  }),
  rv32: followed(rv32, rv32Text, {
    link: (record) => rv32RegisterLink(record, rv32.afterOf(record)),
    shows: hasRegisters
  }),
  mos6502: followed(mos6502, mos6502Text, {
    link: (record) => mos6502RegisterLink(record, mos6502.afterOf(record)),
    shows: hasRegisters
  })
});

const { moment: controlMoment } = useCpuMoment({
  x86: followed(x86, x86Text, { link: x86ControlLink, shows: hasControl }),
  rv32: followed(rv32, rv32Text, {
    link: (record) => rv32ControlLink(record, memoryBefore(rv32.state, rv32.program.value, record)),
    shows: hasControl
  }),
  mos6502: followed(mos6502, mos6502Text, { link: mos6502ControlLink, shows: hasControl })
});

// The other CPUs are fetched once the page is idle, so switching between them seldom waits.
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
          :moment="circuitMoment"
          @seek="seekShown"
          @back="topic = 'cpu'"
        />
        <NumbersWorkbench
          v-else-if="topic === 'numbers'"
          :moment="numberMoment"
          @seek="seekShown"
          @back="topic = 'cpu'"
        />
        <StorageWorkbench
          v-else-if="topic === 'storage'"
          :moment="registerMoment"
          @seek="seekShown"
          @back="topic = 'cpu'"
        />
        <ControlWorkbench
          v-else-if="topic === 'control'"
          :moment="controlMoment"
          @seek="seekShown"
          @back="topic = 'cpu'"
        />
        <X86Workbench v-else-if="architecture === 'x86'" :cpu="x86" />
        <Rv32Workbench v-else-if="architecture === 'rv32'" :cpu="rv32" />
        <Mos6502Workbench v-else :cpu="mos6502" />
      </KeepAlive>
    </div>
    <ChallengesDialog
      v-if="challengesWanted"
      :architecture="architecture"
      :challenges="shownChallenges"
      @start="beginChallenge"
    />
    <CompareDialog v-if="comparisonWanted" v-model:open="comparisonOpen" @load="loadSolution" />
    <FeedbackDialog v-if="feedbackWanted" />
    <SettingsDialog v-if="settingsWanted" />
    <ShareDialog v-if="shareWanted" :architecture="architecture" :program="shownProgram" />
    <SharedProgramDialog
      :pending="shared.pending.value"
      :problem="shared.problem.value"
      :replaced-lines="shared.replacedLines.value"
      @accept="shared.accept"
      @dismiss="shared.dismiss"
    />
    <ReplaceProgramDialog />
  </TooltipProvider>
</template>
