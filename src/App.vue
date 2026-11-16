<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatInstruction } from '@/core/instructions';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppHeader from '@/ui/components/AppHeader.vue';
import ChangeStrip from '@/ui/components/ChangeStrip.vue';
import CpuDiagram from '@/ui/components/CpuDiagram.vue';
import CommandPalette, { type PaletteCommand } from '@/ui/components/CommandPalette.vue';
import FlagsPanel from '@/ui/components/FlagsPanel.vue';
import HistoryLog from '@/ui/components/HistoryLog.vue';
import InstructionBuilder from '@/ui/components/InstructionBuilder.vue';
import LastOperation from '@/ui/components/LastOperation.vue';
import MemoryView from '@/ui/components/MemoryView.vue';
import ProgramPanel from '@/ui/components/ProgramPanel.vue';
import RegistersPanel from '@/ui/components/RegistersPanel.vue';
import TransportBar from '@/ui/components/TransportBar.vue';
import { EXAMPLE_PROGRAMS } from '@/core/program';
import { RUN_SPEEDS, useCpu, type RunSpeed } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';
import { usePreferences } from '@/ui/usePreferences';
import { raisedOverflow, stepSound } from '@/ui/sounds';

const cpu = useCpu();
const {
  state,
  history,
  error,
  program,
  insertAt,
  lastRecord,
  future,
  memoryHeat,
  finished,
  speed,
  running
} = cpu;

useDataFlow(state, history);

const programLines = computed(() => program.value.map(formatInstruction));

const { isDark, soundOn, cpuView, toggleTheme, play } = usePreferences();

// One instruction forward sounds like what it did; anything bigger is a single ratchet.
watch(
  () => history.value.length,
  (length, previous) => {
    const record = lastRecord.value;
    if (length === previous + 1 && record) {
      play(stepSound(record, state));
      if (raisedOverflow(record, state)) play('overflow', 0.03);
      if (record.line !== null && finished.value) play('halt', 0.12);
    } else if (length === previous - 1) {
      play('undo');
    } else {
      play('ratchet');
    }
  }
);
watch(error, (message) => message && play('error'));
watch(
  () => program.value.length,
  (length, previous) => length === previous + 1 && play('punch')
);

const paletteOpen = ref(false);
/** The full list of executed instructions; the timeline itself is always in the bar. */
const historyShown = ref(false);

const commands = computed<PaletteCommand[]>(() => [
  {
    group: 'Program',
    label: 'Step one line',
    disabled: finished.value,
    run: cpu.stepProgram
  },
  running.value
    ? { group: 'Program', label: 'Pause', run: cpu.pause }
    : { group: 'Program', label: 'Run', disabled: finished.value, run: cpu.runProgram },
  {
    group: 'Program',
    label: 'Clear the program',
    disabled: program.value.length === 0,
    run: cpu.clearProgram
  },
  { group: 'History', label: 'Undo', disabled: history.value.length === 0, run: cpu.undoLast },
  { group: 'History', label: 'Redo', disabled: future.value.length === 0, run: cpu.redo },
  {
    group: 'History',
    label: historyShown.value ? 'Hide the history list' : 'Show the history list',
    run: () => {
      historyShown.value = !historyShown.value;
    }
  },
  { group: 'History', label: 'Reset the CPU', run: cpu.reset },
  ...(Object.keys(RUN_SPEEDS) as RunSpeed[]).map((name) => ({
    group: 'Run speed',
    label: name[0].toUpperCase() + name.slice(1),
    disabled: speed.value === name,
    run: () => {
      speed.value = name;
    }
  })),
  ...EXAMPLE_PROGRAMS.map((example, index) => ({
    group: 'Examples',
    label: `Load "${example.name}"`,
    run: () => cpu.loadExample(index)
  })),
  {
    group: 'Preferences',
    label: isDark.value ? 'Switch to light theme' : 'Switch to dark theme',
    run: toggleTheme
  },
  {
    group: 'Preferences',
    label: cpuView.value === 'diagram' ? 'Show the CPU as tables' : 'Show the CPU as a diagram',
    run: () => {
      cpuView.value = cpuView.value === 'diagram' ? 'table' : 'diagram';
    }
  },
  {
    group: 'Preferences',
    label: soundOn.value ? 'Turn sound off' : 'Turn sound on',
    run: () => {
      soundOn.value = !soundOn.value;
    }
  }
]);
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <!-- On a wide screen the app fills the window and never scrolls as a whole. -->
    <div
      class="app-surface flex min-h-svh flex-col bg-muted/40 lg:h-svh lg:overflow-hidden dark:bg-background"
    >
      <AppHeader
        @reset="cpu.reset"
        @load-example="cpu.loadExample"
        @commands="paletteOpen = true"
      />
      <CommandPalette v-model:open="paletteOpen" :commands="commands" />
      <ChangeStrip v-if="lastRecord" class="lg:hidden" :state="state" :record="lastRecord" />

      <!-- Left: what you write. Right: what the CPU holds. -->
      <main
        class="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-rows-[minmax(0,1fr)] lg:px-6"
      >
        <div class="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:p-px">
          <InstructionBuilder
            class="lg:min-h-0 lg:shrink"
            :run="cpu.run"
            :add="cpu.addToProgram"
            :error="error"
            :program-lines="programLines"
            :insert-line="insertAt ?? program.length"
          />
          <!-- The history list shares the program's space instead of squeezing the builder. -->
          <div class="flex flex-col gap-4 sm:flex-row lg:min-h-44 lg:flex-1">
            <ProgramPanel
              v-model:insert-at="insertAt"
              class="min-w-0 flex-1"
              :program="program"
              :ip="state.registers.ip"
              :last-line="lastRecord?.line ?? null"
              :finished="finished"
              @clear="cpu.clearProgram"
              @remove="cpu.removeProgramLine"
            />
            <HistoryLog
              v-if="historyShown"
              class="min-w-0 flex-1"
              :history="history"
              :future="future"
              @seek="cpu.seek"
            />
          </div>
        </div>
        <div class="flex min-w-0 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:p-px">
          <CpuDiagram
            v-if="cpuView === 'diagram'"
            class="shrink-0"
            :state="state"
            :record="lastRecord"
            :tick="history.length"
          />
          <template v-else>
            <RegistersPanel
              class="shrink-0"
              :state="state"
              :previous="lastRecord?.before.registers ?? null"
              :tick="history.length"
            />
            <LastOperation class="shrink-0" :state="state" :record="lastRecord" />
            <FlagsPanel
              class="shrink-0"
              :state="state"
              :previous="lastRecord?.before.flags ?? null"
              :record="lastRecord"
              :tick="history.length"
            />
          </template>
          <MemoryView
            class="lg:min-h-36 lg:flex-1"
            :state="state"
            :heat="memoryHeat"
            :record="lastRecord"
            :tick="history.length"
          />
        </div>
      </main>

      <TransportBar
        v-model:speed="speed"
        v-model:history-shown="historyShown"
        :finished="finished"
        :running="running"
        :executed="history.length"
        :undone="future.length"
        @step="cpu.stepProgram"
        @run="cpu.runProgram"
        @pause="cpu.pause"
        @undo="cpu.undoLast"
        @redo="cpu.redo"
        @seek="cpu.seek"
      />
    </div>
  </TooltipProvider>
</template>
