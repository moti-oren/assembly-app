<script setup lang="ts">
import { computed, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { assemble } from '@/core/encode';
import { formatInstruction, type Instruction } from '@/core/instructions';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppErrorNotice from '@/ui/components/AppErrorNotice.vue';
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
import ResetCpuDialog from '@/ui/components/ResetCpuDialog.vue';
import SortableColumn from '@/ui/components/SortableColumn.vue';
import TransportBar from '@/ui/components/TransportBar.vue';
import { chooseEncoding } from '@/ui/encodingShown';
import { useCommands } from '@/ui/useCommands';
import { useCpu } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';
import { PANEL_LABELS, usePanelColumns } from '@/ui/usePanelOrder';
import { usePanels } from '@/ui/usePanels';
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

const panels = usePanels(cpu);
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const builder = useTemplateRef('builder');
const memoryView = useTemplateRef('memoryView');
/** True while the user is asked to confirm clearing the program. */
const clearAsked = ref(false);
/** True while the user is asked to confirm a reset, which would lose the history. */
const resetAsked = ref(false);
/** Instructions a reset would lose, undone ones included. */
const historyLength = computed(() => history.value.length + future.value.length);

/** With nothing in the history there is nothing to lose, so the reset happens at once. */
function askReset(): void {
  if (historyLength.value === 0) cpu.reset();
  else resetAsked.value = true;
}
const commands = useCommands(cpu, panels, {
  focusBuilder: () => builder.value?.focus(),
  askClearProgram: () => {
    clearAsked.value = true;
  },
  askReset,
  showStackTop: () => memoryView.value?.showStackTop(),
  showLastAccess: () => memoryView.value?.showLastAccess()
});
// Stepping the program folds the builder's choices, so the line at IP stays in view below it.
watch([() => history.value.length, () => pending.value?.phase], () => {
  const fromProgram = pending.value !== null || (lastRecord.value?.line ?? null) !== null;
  if (fromProgram) builder.value?.fold();
});

const paletteOpen = ref(false);
const examplesOpen = ref(false);

const programLines = computed(() => program.value.map(formatInstruction));

/** The machine code of every program line; the program itself is never run from these bytes. */
const assembled = computed(() => assemble(program.value));
/** The complete instruction sitting in the builder, if any. */
const draft = shallowRef<Instruction | null>(null);

const { leftKeys, rightKeys, rightColumn, move } = usePanelColumns(panels);

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
        v-model:examples-open="examplesOpen"
        @reset="askReset"
        @load-example="cpu.loadExample"
        @commands="paletteOpen = true"
      />
      <CommandPalette v-model:open="paletteOpen" :commands="commands" />
      <ClearProgramDialog
        v-model:open="clearAsked"
        :lines="program.length"
        @confirm="cpu.clearProgram"
      />
      <ResetCpuDialog
        v-model:open="resetAsked"
        :instructions="historyLength"
        @confirm="cpu.reset"
      />
      <AppErrorNotice />
      <ChangeStrip class="lg:hidden" :state="state" :record="lastRecord" />

      <!-- Left: what you write. Right: the machine: the CPU, then what is on its bus. -->
      <main
        class="mx-auto grid w-full max-w-(--page-width) flex-1 content-start items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-6"
      >
        <!-- Each column's cards can be dragged into any order, but never into the other column. -->
        <SortableColumn
          :keys="leftKeys"
          :labels="PANEL_LABELS"
          @move="(key, to) => move('left', key, to)"
        >
          <template #builder>
            <InstructionBuilder
              ref="builder"
              :run="cpu.run"
              :add="cpu.addToProgram"
              :error="errorFrom === 'builder' ? error : null"
              :program-lines="programLines"
              :insert-line="insertAt ?? program.length"
              @draft="draft = $event"
            />
          </template>
          <template #program>
            <ProgramPanel
              v-model:insert-at="insertAt"
              :program="program"
              :assembled="assembled.lines"
              :ip="state.registers.ip"
              :last-line="lastRecord?.line ?? null"
              :finished="finished"
              @clear="clearAsked = true"
              @remove="cpu.removeProgramLine"
              @inspect="inspect"
              @examples="examplesOpen = true"
            />
          </template>
          <template #history>
            <HistoryLog :history="history" :future="future" @seek="cpu.seek" />
          </template>
          <template #encoding>
            <EncodingPanel :shown="encodingShown" />
          </template>
        </SortableColumn>

        <SortableColumn
          :keys="rightKeys"
          :labels="PANEL_LABELS"
          @move="(key, to) => move(rightColumn, key, to)"
        >
          <template #cpu>
            <CpuDiagram
              :state="state"
              :record="lastRecord"
              :pending="pending"
              :tick="history.length"
            />
          </template>
          <template #cycle>
            <Card size="sm">
              <CardContent>
                <CpuCycle :state="state" :record="lastRecord" :pending="pending" />
              </CardContent>
            </Card>
          </template>
          <template #registers>
            <RegistersPanel
              :state="state"
              :previous="lastRecord?.before.registers ?? null"
              :record="lastRecord"
              :tick="history.length"
            />
          </template>
          <template #operation>
            <LastOperation :state="state" :record="lastRecord" />
          </template>
          <template #flags>
            <FlagsPanel
              :state="state"
              :previous="lastRecord?.before.flags ?? null"
              :record="lastRecord"
              :tick="history.length"
            />
          </template>
          <template #devices>
            <DevicesPanel :state="state" @input="cpu.setInput" />
          </template>
          <template #memory>
            <MemoryView
              ref="memoryView"
              :state="state"
              :heat="memoryHeat"
              :record="lastRecord"
              :tick="history.length"
            />
          </template>
        </SortableColumn>
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
