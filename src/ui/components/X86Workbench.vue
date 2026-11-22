<script setup lang="ts">
import { x86AluLink } from '@/core/x86AluLink';
import { formatInstruction, type Instruction } from '@/core/x86/instructions';
import { assemble, encode } from '@/core/x86/encode';
import type { ExecutionRecord } from '@/core/x86/execute';
import type { CpuState } from '@/core/x86/state';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent } from '@/components/ui/card';
import { X86_DEVICE_ACCESS } from '@/ui/deviceAccess';
import { describeMemoryAccess } from '@/ui/describe';
import { X86_CODE_PLACE, x86LineCode } from '@/ui/programCode';
import { x86Sounds } from '@/ui/sounds';
import type { CpuOf } from '@/ui/useCpu';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useDataFlow } from '@/ui/useDataFlow';
import { PANEL_LABELS } from '@/ui/usePanelOrder';
import { usePreferences } from '@/ui/usePreferences';
import { x86UsesDevices } from '@/ui/usesDevices';
import { useProgramCode } from '@/ui/useProgramCode';
import { useWorkbench } from '@/ui/useWorkbench';
import { useWorkbenchPage } from '@/ui/useWorkbenchPage';
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
import SidebarColumn from './SidebarColumn.vue';
import StageColumn from './StageColumn.vue';
import TransportBar from './TransportBar.vue';
import WorkbenchPanes from './WorkbenchPanes.vue';

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
  lastAfter,
  lastWrites,
  future,
  memoryHeat,
  nextLine,
  finished,
  pending,
  speed,
  running
} = cpu;

useDataFlow(state, history);

// The result strip is shown only off a desktop; elsewhere it is not even worked out.
const layout = useLayoutMode();

const { registerBits } = usePreferences();

const {
  panels,
  commands,
  columns,
  paletteOpen,
  examplesOpen,
  clearAsked,
  resetAsked,
  historyLength,
  askReset,
  runAgain,
  confirmReset
} = useWorkbench(cpu, {
  aluLink: x86AluLink,
  usesDevices: x86UsesDevices,
  commands: () => [
    {
      group: 'CPU',
      label: registerBits.value ? 'Hide the register bits' : 'Show the register bits',
      run: () => {
        registerBits.value = !registerBits.value;
      }
    }
  ],
  soundOf: (record) => x86Sounds(record, state),
  page: useWorkbenchPage(() => {
    void state.memoryVersion;
    return lastRecord.value !== null && describeMemoryAccess(state, lastRecord.value) !== null;
  })
});
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const { leftKeys, rightKeys, closable, move, close } = columns;

const { programLines, assembled, draft, encodingShown } = useProgramCode(cpu, inspectedLine, {
  format: formatInstruction,
  assemble,
  encode
});
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
    @reset-cpu="confirmReset"
  />
  <ChangeStrip
    v-if="layout !== 'desktop'"
    :after="lastAfter"
    :running="running"
    :record="lastRecord"
    :phase="pending?.phase ?? null"
    :next="finished ? null : formatLabel(nextLine)"
  />

  <!-- Left: what you write. Right: the machine: the CPU, then what is on its bus. -->
  <WorkbenchPanes>
    <!-- Each pane's panels can be dragged into any order, but never into the other pane. -->
    <SidebarColumn
      class="workbench-pane"
      data-pane="sidebar"
      :keys="leftKeys"
      :labels="PANEL_LABELS"
      :closable="closable"
      @move="move"
      @close="close"
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
    </SidebarColumn>

    <StageColumn class="workbench-pane" data-pane="stage" :keys="rightKeys">
      <template #cpu>
        <CpuDiagram
          :state="state"
          :record="lastRecord"
          :after="lastAfter"
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
          :after="lastAfter"
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
          :writes="lastWrites"
          :tick="history.length"
        />
      </template>
    </StageColumn>
  </WorkbenchPanes>

  <TransportBar
    v-model:speed="speed"
    v-model:history-shown="historyShown"
    v-model:devices-shown="devicesShown"
    v-model:bytes-shown="bytesShown"
    :finished="finished"
    :empty="program.length === 0"
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
    @again="runAgain"
    @seek="cpu.seek"
  />
</template>
