<script setup lang="ts">
import { mos6502AluLink } from '@/core/mos6502AluLink';
import { mos6502NumberLink } from '@/core/mos6502NumberLink';
import { computed } from 'vue';
import { assemble, encode } from '@/core/mos6502/encode';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import type { CpuState } from '@/core/mos6502/state';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent } from '@/components/ui/card';
import { MOS6502_DEVICE_ACCESS } from '@/ui/deviceAccess';
import { MOS6502_CODE_PLACE, mos6502LineCode } from '@/ui/programCode';
import { describeAccess } from '@/ui/mos6502Explain';
import { MOS6502_GRAMMAR } from '@/ui/mos6502Grammar';
import { byteAt, mos6502MemoryPlaces, MOS6502_ADDRESSES } from '@/ui/mos6502View';
import { mos6502Sounds } from '@/ui/sounds';
import type { CpuOf } from '@/ui/useCpu';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { PANEL_LABELS } from '@/ui/usePanelOrder';
import { mos6502UsesDevices } from '@/ui/usesDevices';
import { useProgramCode } from '@/ui/useProgramCode';
import { useWorkbench } from '@/ui/useWorkbench';
import { useWorkbenchPage } from '@/ui/useWorkbenchPage';
import AppChrome from './AppChrome.vue';
import DevicesPanel from './DevicesPanel.vue';
import FlatMemory from './FlatMemory.vue';
import HistoryLog from './HistoryLog.vue';
import InstructionBuilder from './InstructionBuilder.vue';
import ProgramPanel from './ProgramPanel.vue';
import Mos6502Alu from './Mos6502Alu.vue';
import Mos6502ChangeStrip from './Mos6502ChangeStrip.vue';
import Mos6502Cycle from './Mos6502Cycle.vue';
import Mos6502Diagram from './Mos6502Diagram.vue';
import Mos6502Encoding from './Mos6502Encoding.vue';
import Mos6502Flags from './Mos6502Flags.vue';
import Mos6502Registers from './Mos6502Registers.vue';
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
  programSource,
  programStale,
  lastLineMove,
  editing,
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

// The result strip is shown only off a desktop; elsewhere it is not even worked out.
const layout = useLayoutMode();

const LABELS = { ...PANEL_LABELS, operation: 'ALU & cycles' };

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
  aluLink: mos6502AluLink,
  numberLink: mos6502NumberLink,
  usesDevices: mos6502UsesDevices,
  soundOf: (record) => mos6502Sounds(record, state),
  page: useWorkbenchPage(() => lastRecord.value?.access != null)
});
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const { leftKeys, rightKeys, closable, move, close } = columns;

const memoryPlaces = mos6502MemoryPlaces(state);

const memoryAccess = computed(() => {
  const record = lastRecord.value;
  const text = record && describeAccess(record);
  return record?.access && text ? { address: record.access.address, size: 1, text } : null;
});

const { programLines, assembled, draft, encodingShown } = useProgramCode(cpu, inspectedLine, {
  format: formatInstruction,
  assemble,
  encode
});
</script>

<!-- The 6502's panels, in the columns every architecture shares. -->
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
  <Mos6502ChangeStrip
    v-if="layout !== 'desktop'"
    :after="lastAfter"
    :running="running"
    :record="lastRecord"
    :phase="pending?.phase ?? null"
    :next="finished ? null : formatLabel(nextLine)"
    :empty="program.length === 0"
  />

  <!-- Left: what you write. Right: the machine: the CPU, then what is on its bus. -->
  <WorkbenchPanes>
    <!-- Each pane's panels can be dragged into any order, but never into the other pane. -->
    <SidebarColumn
      class="workbench-pane"
      data-pane="sidebar"
      :keys="leftKeys"
      :labels="LABELS"
      :closable="closable"
      :program-rows="program.length"
      @move="move"
      @close="close"
    >
      <template #builder>
        <InstructionBuilder
          ref="builder"
          :grammar="MOS6502_GRAMMAR"
          :run="cpu.run"
          :add="cpu.addToProgram"
          :error="errorFrom === 'builder' ? error : null"
          :program-lines="programLines"
          :insert-line="insertAt ?? program.length"
          :editing="editing"
          :replace="cpu.replaceEditedLine"
          @cancel-edit="cpu.editLine(null)"
          @draft="draft = $event?.[0] ?? null"
        />
      </template>
      <template #program>
        <ProgramPanel
          v-model:insert-at="insertAt"
          :program="program"
          :format="formatInstruction"
          :code="assembled.lines.map(mos6502LineCode)"
          :code-place="MOS6502_CODE_PLACE"
          :ip="nextLine"
          :last-line="lastRecord?.line ?? null"
          :finished="finished"
          :source="programSource"
          :editing-line="editing?.line ?? null"
          :stale="programStale"
          :last-move="lastLineMove"
          @reset="askReset"
          @edit="cpu.editLine"
          @move="cpu.moveProgramLine"
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
        <Mos6502Encoding :shown="encodingShown" />
      </template>
    </SidebarColumn>

    <StageColumn class="workbench-pane" data-pane="stage" :keys="rightKeys">
      <template #cpu>
        <Mos6502Diagram
          :state="state"
          :program="program"
          :record="lastRecord"
          :after="lastAfter"
          :pending="pending"
          :tick="history.length"
        />
      </template>
      <template #cycle>
        <Card size="sm">
          <CardContent>
            <Mos6502Cycle
              :state="state"
              :program="program"
              :record="lastRecord"
              :pending="pending"
            />
          </CardContent>
        </Card>
      </template>
      <template #registers>
        <Mos6502Registers
          :state="state"
          :previous="lastRecord?.before.registers ?? null"
          :record="lastRecord"
          :after="lastAfter"
          :tick="history.length"
        />
      </template>
      <template #operation>
        <Mos6502Alu :record="lastRecord" />
      </template>
      <template #flags>
        <Mos6502Flags :state="state" :record="lastRecord" :tick="history.length" />
      </template>
      <template #devices>
        <DevicesPanel :state="state" :access="MOS6502_DEVICE_ACCESS" @input="cpu.setInput" />
      </template>
      <template #memory>
        <FlatMemory
          ref="memoryView"
          :state="state"
          :byte-at="(address) => byteAt(state, program, address)"
          :places="memoryPlaces"
          :format="MOS6502_ADDRESSES"
          :initial="0x0200"
          :heat="memoryHeat"
          :writes="lastWrites"
          :access="memoryAccess"
          intro="64K of 16-bit addresses: the zero page at $0000, the stack in page $01, the code from $0600, the devices at $D000 and the vectors at $FFFA."
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
