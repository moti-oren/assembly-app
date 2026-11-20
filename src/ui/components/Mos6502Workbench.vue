<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue';
import { assemble, encode } from '@/core/mos6502/encode';
import type { ExecutionRecord } from '@/core/mos6502/executionContext';
import { formatInstruction, type Instruction } from '@/core/mos6502/instructions';
import type { CpuState } from '@/core/mos6502/state';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent } from '@/components/ui/card';
import { MOS6502_DEVICE_ACCESS } from '@/ui/deviceAccess';
import { chooseEncoding } from '@/ui/encodingShown';
import { MOS6502_CODE_PLACE, mos6502LineCode } from '@/ui/programCode';
import { describeAccess } from '@/ui/mos6502Explain';
import { MOS6502_GRAMMAR } from '@/ui/mos6502Grammar';
import { byteAt, mos6502MemoryPlaces, MOS6502_ADDRESSES } from '@/ui/mos6502View';
import { mos6502Sounds } from '@/ui/sounds';
import type { CpuOf } from '@/ui/useCpu';
import { PANEL_LABELS } from '@/ui/usePanelOrder';
import { mos6502UsesDevices } from '@/ui/usesDevices';
import { useWorkbench } from '@/ui/useWorkbench';
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

const LABELS = { ...PANEL_LABELS, operation: 'ALU & cycles' };

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
  usesDevices: mos6502UsesDevices,
  soundOf: (record) => mos6502Sounds(record, state),
  page: {
    focusBuilder: () => builder.value?.focus(),
    foldBuilder: () => builder.value?.fold(),
    showStackTop: () => memoryView.value?.showStackTop(),
    showLastAccess: () => memoryView.value?.showLastAccess(),
    hasLastAccess: () => lastRecord.value?.access != null
  }
});
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const { leftKeys, rightKeys, closable, move, close } = columns;

const memoryPlaces = mos6502MemoryPlaces(state);
const memoryAccess = computed(() => {
  const record = lastRecord.value;
  return record?.access
    ? { address: record.access.address, size: 1, text: describeAccess(record)! }
    : null;
});

const programLines = computed(() => program.value.map(formatInstruction));

/** The machine code of every program line; the program itself is never run from these bytes. */
const assembled = computed(() => assemble(program.value));
/** The first instruction the builder's entry stands for, once it is complete. */
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
    @reset-cpu="cpu.reset"
  />
  <Mos6502ChangeStrip
    class="lg:hidden"
    :state="state"
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
      :labels="LABELS"
      :closable="closable"
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
