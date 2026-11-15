<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatInstruction } from '@/core/instructions';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppHeader from '@/ui/components/AppHeader.vue';
import CpuDiagram from '@/ui/components/CpuDiagram.vue';
import CommandPalette, { type PaletteCommand } from '@/ui/components/CommandPalette.vue';
import FlagsPanel from '@/ui/components/FlagsPanel.vue';
import HistoryLog from '@/ui/components/HistoryLog.vue';
import InstructionBuilder from '@/ui/components/InstructionBuilder.vue';
import LastOperation from '@/ui/components/LastOperation.vue';
import MemoryView from '@/ui/components/MemoryView.vue';
import ProgramPanel from '@/ui/components/ProgramPanel.vue';
import RegistersPanel from '@/ui/components/RegistersPanel.vue';
import { EXAMPLE_PROGRAMS } from '@/core/program';
import { RUN_SPEEDS, useCpu, type RunSpeed } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';
import { usePreferences } from '@/ui/usePreferences';

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

const { isDark, soundOn, cpuView, toggleTheme, tick } = usePreferences();

// Forward in time ticks high, backward ticks low.
watch(
  () => history.value.length,
  (length, previous) => tick(length > previous ? 660 : 440)
);

const paletteOpen = ref(false);

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
    <div class="app-surface min-h-svh bg-muted/40 dark:bg-background">
      <AppHeader
        @reset="cpu.reset"
        @load-example="cpu.loadExample"
        @commands="paletteOpen = true"
      />
      <CommandPalette v-model:open="paletteOpen" :commands="commands" />

      <!-- Left: what you write. Right: what the CPU holds. -->
      <main
        class="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:p-6"
      >
        <div class="flex min-w-0 flex-col gap-4">
          <InstructionBuilder
            :run="cpu.run"
            :add="cpu.addToProgram"
            :error="error"
            :program-lines="programLines"
            :insert-line="insertAt ?? program.length"
          />
          <ProgramPanel
            v-model:insert-at="insertAt"
            v-model:speed="speed"
            :program="program"
            :ip="state.registers.ip"
            :last-line="lastRecord?.line ?? null"
            :finished="finished"
            :running="running"
            @step="cpu.stepProgram"
            @run="cpu.runProgram"
            @pause="cpu.pause"
            @clear="cpu.clearProgram"
            @remove="cpu.removeProgramLine"
          />
          <HistoryLog
            :history="history"
            :future="future"
            @undo="cpu.undoLast"
            @redo="cpu.redo"
            @seek="cpu.seek"
          />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <CpuDiagram
            v-if="cpuView === 'diagram'"
            :state="state"
            :record="lastRecord"
            :tick="history.length"
          />
          <template v-else>
            <RegistersPanel
              :state="state"
              :previous="lastRecord?.before.registers ?? null"
              :tick="history.length"
            />
            <LastOperation :state="state" :record="lastRecord" />
            <FlagsPanel
              :state="state"
              :previous="lastRecord?.before.flags ?? null"
              :tick="history.length"
            />
          </template>
          <MemoryView :state="state" :heat="memoryHeat" :tick="history.length" />
        </div>
      </main>
    </div>
  </TooltipProvider>
</template>
