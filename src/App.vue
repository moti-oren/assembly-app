<script setup lang="ts">
import { computed } from 'vue';
import { formatInstruction } from '@/core/instructions';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppHeader from '@/ui/components/AppHeader.vue';
import FlagsPanel from '@/ui/components/FlagsPanel.vue';
import HistoryLog from '@/ui/components/HistoryLog.vue';
import InstructionBuilder from '@/ui/components/InstructionBuilder.vue';
import MemoryView from '@/ui/components/MemoryView.vue';
import ProgramPanel from '@/ui/components/ProgramPanel.vue';
import RegistersPanel from '@/ui/components/RegistersPanel.vue';
import { useCpu } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';

const cpu = useCpu();
const {
  state,
  history,
  error,
  program,
  insertAt,
  lastRecord,
  lastMemoryWrites,
  finished,
  speed,
  running
} = cpu;

useDataFlow(state, history);

const programLines = computed(() => program.value.map(formatInstruction));
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <div class="app-surface min-h-svh bg-muted/40 dark:bg-background">
      <AppHeader @reset="cpu.reset" @load-example="cpu.loadExample" />

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
          <HistoryLog :history="history" @undo="cpu.undoLast" />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <RegistersPanel
            :state="state"
            :previous="lastRecord?.before.registers ?? null"
            :tick="history.length"
          />
          <FlagsPanel
            :state="state"
            :previous="lastRecord?.before.flags ?? null"
            :tick="history.length"
          />
          <MemoryView :state="state" :highlight="lastMemoryWrites" :tick="history.length" />
        </div>
      </main>
    </div>
  </TooltipProvider>
</template>
