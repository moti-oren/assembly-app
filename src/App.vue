<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef } from 'vue';
import { assemble } from '@/core/encode';
import { formatInstruction, type Instruction } from '@/core/instructions';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppHeader from '@/ui/components/AppHeader.vue';
import ChangeStrip from '@/ui/components/ChangeStrip.vue';
import ClearProgramDialog from '@/ui/components/ClearProgramDialog.vue';
import CpuCycle from '@/ui/components/CpuCycle.vue';
import CpuDiagram from '@/ui/components/CpuDiagram.vue';
import DevicesPanel from '@/ui/components/DevicesPanel.vue';
import EncodingPanel from '@/ui/components/EncodingPanel.vue';
import CommandPalette from '@/ui/components/CommandPalette.vue';
import FlagsPanel from '@/ui/components/FlagsPanel.vue';
import HistoryLog from '@/ui/components/HistoryLog.vue';
import InstructionBuilder from '@/ui/components/InstructionBuilder.vue';
import LastOperation from '@/ui/components/LastOperation.vue';
import MemoryView from '@/ui/components/MemoryView.vue';
import ProgramPanel from '@/ui/components/ProgramPanel.vue';
import RegistersPanel from '@/ui/components/RegistersPanel.vue';
import TransportBar from '@/ui/components/TransportBar.vue';
import { chooseEncoding } from '@/ui/encodingShown';
import { useCommands } from '@/ui/useCommands';
import { useCpu } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';
import { usePanels } from '@/ui/usePanels';
import { usePreferences } from '@/ui/usePreferences';
import { useSoundEffects } from '@/ui/useSoundEffects';

const cpu = useCpu();
const {
  state,
  history,
  error,
  errorFrom,
  program,
  insertAt,
  lastRecord,
  future,
  memoryHeat,
  finished,
  pending,
  speed,
  running
} = cpu;

useDataFlow(state, history);
useSoundEffects(cpu);

const { cpuView } = usePreferences();
const panels = usePanels(cpu);
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const builder = useTemplateRef('builder');
const memoryView = useTemplateRef('memoryView');
/** True while the user is asked to confirm clearing the program. */
const clearAsked = ref(false);
const commands = useCommands(cpu, panels, {
  focusBuilder: () => builder.value?.focus(),
  askClearProgram: () => {
    clearAsked.value = true;
  },
  showStackTop: () => memoryView.value?.showStackTop(),
  showLastAccess: () => memoryView.value?.showLastAccess()
});
const paletteOpen = ref(false);

const programLines = computed(() => program.value.map(formatInstruction));

/** The machine code of every program line; the program itself is never run from these bytes. */
const assembled = computed(() => assemble(program.value));
/** The complete instruction sitting in the builder, if any. */
const draft = shallowRef<Instruction | null>(null);

const encodingShown = computed(() =>
  chooseEncoding({
    program: program.value,
    lines: assembled.value.lines,
    draft: draft.value,
    inspected: inspectedLine.value,
    next: finished.value ? null : state.registers.ip,
    last: lastRecord.value
  })
);
</script>

<template>
  <TooltipProvider :delay-duration="250">
    <!-- The page scrolls as a whole: every panel keeps its own height instead of sharing one window. -->
    <div class="app-surface flex min-h-svh flex-col bg-muted/40 dark:bg-background">
      <AppHeader
        @reset="cpu.reset"
        @load-example="cpu.loadExample"
        @commands="paletteOpen = true"
      />
      <CommandPalette v-model:open="paletteOpen" :commands="commands" />
      <ClearProgramDialog
        v-model:open="clearAsked"
        :lines="program.length"
        @confirm="cpu.clearProgram"
      />
      <ChangeStrip v-if="lastRecord" class="lg:hidden" :state="state" :record="lastRecord" />

      <!-- Left: what you write. Right: the machine: the CPU, then what is on its bus. -->
      <main
        class="mx-auto grid w-full max-w-7xl flex-1 content-start items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-6"
      >
        <div class="flex min-w-0 flex-col gap-4">
          <InstructionBuilder
            ref="builder"
            :run="cpu.run"
            :add="cpu.addToProgram"
            :error="errorFrom === 'builder' ? error : null"
            :program-lines="programLines"
            :insert-line="insertAt ?? program.length"
            @draft="draft = $event"
          />
          <!-- Side by side only where one column spans the page; a half-width column is too narrow. -->
          <div class="flex flex-col gap-4 sm:flex-row lg:flex-col">
            <ProgramPanel
              v-model:insert-at="insertAt"
              class="min-w-0 flex-1"
              :program="program"
              :assembled="assembled.lines"
              :ip="state.registers.ip"
              :last-line="lastRecord?.line ?? null"
              :finished="finished"
              @clear="clearAsked = true"
              @remove="cpu.removeProgramLine"
              @inspect="inspect"
            />
            <HistoryLog
              v-if="historyShown"
              class="min-w-0 flex-1"
              :history="history"
              :future="future"
              @seek="cpu.seek"
            />
          </div>
          <EncodingPanel v-if="bytesShown" :shown="encodingShown" />
        </div>
        <div class="flex min-w-0 flex-col gap-4">
          <CpuDiagram
            v-if="cpuView === 'diagram'"
            :state="state"
            :record="lastRecord"
            :pending="pending"
            :tick="history.length"
          />
          <template v-else>
            <Card size="sm">
              <CardContent>
                <CpuCycle :state="state" :record="lastRecord" :pending="pending" />
              </CardContent>
            </Card>
            <RegistersPanel
              :state="state"
              :previous="lastRecord?.before.registers ?? null"
              :tick="history.length"
            />
            <LastOperation :state="state" :record="lastRecord" />
            <FlagsPanel
              :state="state"
              :previous="lastRecord?.before.flags ?? null"
              :record="lastRecord"
              :tick="history.length"
            />
          </template>
          <!-- The devices sit by the CPU whose bus they hang off, in sight while a program runs. -->
          <DevicesPanel v-if="devicesShown" :state="state" @input="cpu.setInput" />
          <MemoryView
            ref="memoryView"
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
        v-model:devices-shown="devicesShown"
        v-model:bytes-shown="bytesShown"
        :finished="finished"
        :running="running"
        :error="errorFrom === 'program' ? error : null"
        :phase="pending?.phase ?? null"
        :executed="history.length"
        :undone="future.length"
        @step="cpu.stepProgram"
        @phase="cpu.stepPhase"
        @run="cpu.runProgram"
        @pause="cpu.pause"
        @undo="cpu.undoLast"
        @redo="cpu.redo"
        @seek="cpu.seek"
      />
    </div>
  </TooltipProvider>
</template>
