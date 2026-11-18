<script setup lang="ts">
import { computed, shallowRef, useTemplateRef } from 'vue';
import { assemble, encode } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import { DATA_BASE, type CpuState } from '@/core/rv32/state';
import { Card, CardContent } from '@/components/ui/card';
import { RV32_DEVICE_ACCESS } from '@/ui/deviceAccess';
import { chooseEncoding } from '@/ui/encodingShown';
import { RV32_CODE_PLACE, rv32LineCode } from '@/ui/programCode';
import { describeAccess } from '@/ui/rv32Explain';
import { RV32_GRAMMAR } from '@/ui/rv32Grammar';
import { byteAt, rv32MemoryPlaces, RV32_ADDRESSES } from '@/ui/rv32View';
import { rv32StepSound } from '@/ui/sounds';
import type { CpuOf } from '@/ui/useCpu';
import { PANEL_LABELS } from '@/ui/usePanelOrder';
import { rv32UsesDevices } from '@/ui/usesDevices';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import { useWorkbench } from '@/ui/useWorkbench';
import AppChrome from './AppChrome.vue';
import DevicesPanel from './DevicesPanel.vue';
import FlatMemory from './FlatMemory.vue';
import HistoryLog from './HistoryLog.vue';
import InstructionBuilder from './InstructionBuilder.vue';
import ProgramPanel from './ProgramPanel.vue';
import Rv32Alu from './Rv32Alu.vue';
import Rv32ChangeStrip from './Rv32ChangeStrip.vue';
import Rv32Compare from './Rv32Compare.vue';
import Rv32Cycle from './Rv32Cycle.vue';
import Rv32Diagram from './Rv32Diagram.vue';
import Rv32Encoding from './Rv32Encoding.vue';
import Rv32Pipeline from './Rv32Pipeline.vue';
import Rv32Registers from './Rv32Registers.vue';
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

/** RISC-V has no flags: that card explains the comparisons that take their place. */
const LABELS = { ...PANEL_LABELS, flags: 'No flags', operation: 'ALU' };

const pipeline = useRv32Pipeline();
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
  usesDevices: rv32UsesDevices,
  soundOf: (record) => ({ step: rv32StepSound(record, state), overflow: false }),
  commands: pipeline.commands,
  page: {
    focusBuilder: () => builder.value?.focus(),
    foldBuilder: () => builder.value?.fold(),
    showStackTop: () => memoryView.value?.showStackTop(),
    showLastAccess: () => memoryView.value?.showLastAccess(),
    hasLastAccess: () => lastRecord.value?.access != null
  }
});
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const { leftKeys, rightKeys, rightColumn, move } = columns;
const { shown: pipelineShown } = pipeline;

const memoryPlaces = rv32MemoryPlaces(state);
const memoryAccess = computed(() => {
  const record = lastRecord.value;
  const access = record?.access;
  return access && record
    ? { address: access.address, size: access.size, text: describeAccess(record)! }
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

<!-- RISC-V's panels, in the columns every architecture shares. -->
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
    @reset="askReset"
    @load-example="cpu.loadExample"
    @clear-program="cpu.clearProgram"
    @reset-cpu="cpu.reset"
  />
  <Rv32ChangeStrip class="lg:hidden" :state="state" :record="lastRecord" />

  <!-- Left: what you write. Right: the machine: the CPU, then what is on its bus. -->
  <main
    class="mx-auto grid w-full max-w-(--page-width) flex-1 content-start items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-6"
  >
    <!-- Each column's cards can be dragged into any order, but never into the other column. -->
    <SortableColumn :keys="leftKeys" :labels="LABELS" @move="(key, to) => move('left', key, to)">
      <template #builder>
        <InstructionBuilder
          ref="builder"
          :grammar="RV32_GRAMMAR"
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
          :code="assembled.lines.map(rv32LineCode)"
          :code-place="RV32_CODE_PLACE"
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
        <Rv32Encoding :shown="encodingShown" />
      </template>
    </SortableColumn>

    <SortableColumn
      :keys="rightKeys"
      :labels="LABELS"
      @move="(key, to) => move(rightColumn, key, to)"
    >
      <template #cpu>
        <Rv32Diagram
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
            <Rv32Pipeline v-if="pipelineShown" :history="history" :program="program" />
            <Rv32Cycle
              v-else
              :state="state"
              :program="program"
              :record="lastRecord"
              :pending="pending"
            />
          </CardContent>
        </Card>
      </template>
      <template #registers>
        <Rv32Registers
          :state="state"
          :previous="lastRecord?.before.registers ?? null"
          :record="lastRecord"
          :tick="history.length"
        />
      </template>
      <template #operation>
        <Rv32Alu :record="lastRecord" />
      </template>
      <template #flags>
        <Rv32Compare :state="state" :program="program" :record="lastRecord" />
      </template>
      <template #devices>
        <DevicesPanel :state="state" :access="RV32_DEVICE_ACCESS" @input="cpu.setInput" />
      </template>
      <template #memory>
        <FlatMemory
          ref="memoryView"
          :state="state"
          :byte-at="(address) => byteAt(state, program, address)"
          :places="memoryPlaces"
          :format="RV32_ADDRESSES"
          :initial="DATA_BASE"
          :heat="memoryHeat"
          :access="memoryAccess"
          intro="One flat space of 32-bit addresses: RAM from 0x00000000 (the code first), the devices at 0x10000000. Dots mark addresses with nothing wired to them."
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
</template>
