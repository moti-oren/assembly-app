<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue';
import { formatInstruction, type Instruction } from '@/core/x86/instructions';
import { assemble, encode } from '@/core/x86/encode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { CpuState } from '@/core/x86/state';
import { Card, CardContent } from '@/components/ui/card';
import { X86_DEVICE_ACCESS } from '@/ui/deviceAccess';
import { describeMemoryAccess } from '@/ui/describe';
import { chooseEncoding } from '@/ui/encodingShown';
import { X86_CODE_PLACE, x86LineCode } from '@/ui/programCode';
import { raisedOverflow, stepSound } from '@/ui/sounds';
import type { CpuOf } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';
import { PANEL_LABELS } from '@/ui/usePanelOrder';
import { x86UsesDevices } from '@/ui/usesDevices';
import { useWorkbench } from '@/ui/useWorkbench';
import { X86_GRAMMAR } from '@/ui/x86Grammar';
import AppChrome from './AppChrome.vue';
import ChangeStrip from './ChangeStrip.vue';
import CpuCycle from './CpuCycle.vue';
import CpuDiagram from './CpuDiagram.vue';
import DevicesPanel from './DevicesPanel.vue';
import EncodingPanel from './EncodingPanel.vue';
import FlagsPanel from './FlagsPanel.vue';
import HistoryLog from './HistoryLog.vue';
import InstructionBuilder from './InstructionBuilder.vue';
import LastOperation from './LastOperation.vue';
import MemoryView from './MemoryView.vue';
import ProgramPanel from './ProgramPanel.vue';
import RegistersPanel from './RegistersPanel.vue';
import SortableColumn from './SortableColumn.vue';
import TransportBar from './TransportBar.vue';

const props = defineProps<{
  cpu: CpuOf<Instruction, CpuState, ExecutionRecord>;
}>();

// The CPU is the same object for the life of the workbench; App keeps it across switches.
const { cpu } = props;
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
  nextLine,
  finished,
  pending,
  speed,
  running
} = cpu;

useDataFlow(state, history);

const builder = useTemplateRef('builder');
const memoryView = useTemplateRef('memoryView');

const {
  panels,
  commands,
  columns,
  paletteOpen,
  examplesOpen,
  clearAsked,
  resetAsked,
  historyLength,
  askReset
} = useWorkbench(cpu, {
  usesDevices: x86UsesDevices,
  soundOf: (record) => ({
    step: stepSound(record, state),
    overflow: raisedOverflow(record, state)
  }),
  page: {
    focusBuilder: () => builder.value?.focus(),
    foldBuilder: () => builder.value?.fold(),
    showStackTop: () => memoryView.value?.showStackTop(),
    showLastAccess: () => memoryView.value?.showLastAccess(),
    hasLastAccess: () => {
      void state.memoryVersion;
      return lastRecord.value !== null && describeMemoryAccess(state, lastRecord.value) !== null;
    }
  }
});
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const { leftKeys, rightKeys, rightColumn, move } = columns;

const programLines = computed(() => program.value.map(formatInstruction));

/** The machine code of every program line; the program itself is never run from these bytes. */
const assembled = computed(() => assemble(program.value));
/** The complete instruction sitting in the builder, if any. */
const draft = shallowRef<Instruction | null>(null);

const encodingShown = computed(() =>
  chooseEncoding(
    {
      program: program.value,
      lines: assembled.value.lines,
      draft: draft.value,
      inspected: inspectedLine.value,
      next: finished.value ? null : nextLine.value,
      last: lastRecord.value
    },
    encode
  )
);
</script>

<!-- The 8086's panels, in the columns every architecture shares. -->
<template>
  <AppChrome
    v-model:examples-open="examplesOpen"
    v-model:palette-open="paletteOpen"
    v-model:clear-asked="clearAsked"
    v-model:reset-asked="resetAsked"
    :examples="cpu.architecture.examples"
    :commands="commands"
    :program-length="program.length"
    :history-length="historyLength"
    @load-example="cpu.loadExample"
    @clear-program="cpu.clearProgram"
    @reset-cpu="cpu.reset"
  />
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
          :grammar="X86_GRAMMAR"
          :run="cpu.run"
          :add="cpu.addToProgram"
          :error="errorFrom === 'builder' ? error : null"
          :program-lines="programLines"
          :insert-line="insertAt ?? program.length"
          @draft="draft = $event?.[0] ?? null"
        />
      </template>
      <template #program>
        <ProgramPanel
          v-model:insert-at="insertAt"
          :program="program"
          :format="formatInstruction"
          :code="assembled.lines.map(x86LineCode)"
          :code-place="X86_CODE_PLACE"
          :ip="nextLine"
          :last-line="lastRecord?.line ?? null"
          :finished="finished"
          @clear="clearAsked = true"
          @remove="cpu.removeProgramLine"
          @inspect="inspect"
          @examples="examplesOpen = true"
        />
      </template>
      <template #history>
        <HistoryLog
          :history="history"
          :future="future"
          :format="formatInstruction"
          @seek="cpu.seek"
        />
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
        <CpuDiagram :state="state" :record="lastRecord" :pending="pending" :tick="history.length" />
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
        <DevicesPanel :state="state" :access="X86_DEVICE_ACCESS" @input="cpu.setInput" />
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
    @reset="askReset"
    @seek="cpu.seek"
  />
</template>
