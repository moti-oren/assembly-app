<script setup lang="ts">
import { rv32AluLink } from '@/core/rv32AluLink';
import { rv32NumberLink } from '@/core/rv32NumberLink';
import { rv32RegisterLink } from '@/core/rv32RegisterLink';
import { computed } from 'vue';
import { assemble, encode } from '@/core/rv32/encode';
import type { ExecutionRecord } from '@/core/rv32/execute';
import { formatInstruction, type Instruction } from '@/core/rv32/instructions';
import { DATA_BASE, type CpuState } from '@/core/rv32/state';
import { formatLabel } from '@/core/shared/program';
import { Card, CardContent } from '@/components/ui/card';
import { RV32_DEVICE_ACCESS } from '@/ui/deviceAccess';
import { RV32_CODE_PLACE, SHORT_LINE_ADDRESS, rv32LineCode } from '@/ui/programCode';
import { describeAccess } from '@/ui/rv32Explain';
import { RV32_GRAMMAR } from '@/ui/rv32Grammar';
import { byteAt, rv32MemoryPlaces, RV32_ADDRESSES } from '@/ui/rv32View';
import { rv32Sounds } from '@/ui/sounds';
import type { CpuOf } from '@/ui/useCpu';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { PANEL_LABELS } from '@/ui/usePanelOrder';
import { rv32UsesDevices } from '@/ui/usesDevices';
import { useRv32Pipeline } from '@/ui/useRv32Pipeline';
import { useRv32Timing } from '@/ui/useRv32Timing';
import { usePrediction } from '@/ui/usePrediction';
import { useProgramCode } from '@/ui/useProgramCode';
import { useChallenge } from '@/ui/useChallenge';
import { useChallenges } from '@/ui/useChallenges';
import { useStack } from '@/ui/useStack';
import { useWorkbench } from '@/ui/useWorkbench';
import { rv32Stack } from '@/ui/rv32Stack';
import { useWorkbenchPage } from '@/ui/useWorkbenchPage';
import { rv32Predictor } from '@/ui/rv32Prediction';
import AppChrome from './AppChrome.vue';
import DevicesPanel from './DevicesPanel.vue';
import FlatMemory from './FlatMemory.vue';
import HistoryLog from './HistoryLog.vue';
import InstructionBuilder from './InstructionBuilder.vue';
import PredictionBar from './PredictionBar.vue';
import ChallengePanel from './ChallengePanel.vue';
import ProgramPanel from './ProgramPanel.vue';
import Rv32Alu from './Rv32Alu.vue';
import Rv32ChangeStrip from './Rv32ChangeStrip.vue';
import Rv32Compare from './Rv32Compare.vue';
import Rv32Cycle from './Rv32Cycle.vue';
import Rv32Diagram from './Rv32Diagram.vue';
import Rv32Encoding from './Rv32Encoding.vue';
import Rv32Pipeline from './Rv32Pipeline.vue';
import Rv32Registers from './Rv32Registers.vue';
import SidebarColumn from './SidebarColumn.vue';
import StackPanel from './StackPanel.vue';
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
  lockedLines,
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
  speed
} = cpu;

// The result strip is shown only off a desktop; elsewhere it is not even worked out.
const layout = useLayoutMode();

/** RISC-V has no flags: that card explains the comparisons that take their place. */
const LABELS = { ...PANEL_LABELS, flags: 'No flags', operation: 'ALU' };

const pipeline = useRv32Pipeline();
const timing = useRv32Timing(cpu);

const memoryPlaces = rv32MemoryPlaces(state);
const page = useWorkbenchPage(() => lastRecord.value?.access != null, memoryPlaces);
const { asking, last, tally, skipped, answer, skip, followBuilder, controls } = usePrediction(
  cpu,
  rv32Predictor,
  { clearBuilder: page.clearBuilder }
);
const { running } = controls;

const challenge = useChallenge(cpu);
const {
  panels,
  commands,
  registerLink,
  controlUnavailable,
  columns,
  paletteOpen,
  examplesOpen,
  clearAsked,
  resetAsked,
  historyLength,
  askReset,
  runAgain,
  confirmReset,
  clearProgram
} = useWorkbench(controls, {
  aluLink: rv32AluLink,
  numberLink: rv32NumberLink,
  registerLink: rv32RegisterLink,
  // Every RISC-V instruction has a control unit to show.
  controlUnavailable: () => null,
  usesDevices: rv32UsesDevices,
  // The timing is the chart's own, worked out once for both.
  soundOf: () => rv32Sounds(history.value, state, pipeline.shown.value ? timing.value : null),
  commands: () => [...pipeline.commands(), ...challenge.commands.value],
  page
});
const { historyShown, bytesShown, devicesShown, inspectedLine, inspect } = panels;
const { leftKeys, rightKeys, closable, move, close } = columns;
const stack = useStack(cpu, rv32Stack);
const { open: challengesOpen } = useChallenges();
const { shown: pipelineShown } = pipeline;

const memoryAccess = computed(() => {
  const record = lastRecord.value;
  const text = record && describeAccess(record);
  return record?.access && text
    ? { address: record.access.address, size: record.access.size, text }
    : null;
});

const { programLines, assembled, draft, encodingShown } = useProgramCode(cpu, inspectedLine, {
  format: formatInstruction,
  assemble,
  encode
});
followBuilder(draft);
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
    @load-example="cpu.loadExample"
    @clear-program="clearProgram"
    @reset-cpu="confirmReset"
  />
  <Rv32ChangeStrip
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
      <template #challenge>
        <ChallengePanel
          v-if="challenge.challenge.value && challenge.result.value"
          v-model:hint-shown="challenge.hintShown.value"
          :challenge="challenge.challenge.value"
          :result="challenge.result.value"
          :given="challenge.given.value"
          :next="challenge.next.value"
          @restart="challenge.restart"
          @next="challenge.startNext"
          @list="challengesOpen = true"
        />
      </template>
      <template #builder>
        <InstructionBuilder
          ref="builder"
          :grammar="RV32_GRAMMAR"
          :run="controls.run"
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
          :code="assembled.lines.map(rv32LineCode)"
          :code-place="RV32_CODE_PLACE"
          :line-address="SHORT_LINE_ADDRESS"
          :ip="nextLine"
          :last-line="lastRecord?.line ?? null"
          :finished="finished"
          :source="programSource"
          :editing-line="editing?.line ?? null"
          :stale="programStale"
          :last-move="lastLineMove"
          :locked="lockedLines"
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
        <Rv32Encoding :shown="encodingShown" />
      </template>
    </SidebarColumn>

    <StageColumn class="workbench-pane" data-pane="stage" :keys="rightKeys">
      <template #cpu>
        <Rv32Diagram
          :state="state"
          :program="program"
          :record="lastRecord"
          :after="lastAfter"
          :pending="pending"
          :stored="registerLink"
          :control="controlUnavailable"
          :tick="history.length"
        />
      </template>
      <template #cycle>
        <Card size="sm">
          <CardContent>
            <Rv32Pipeline
              v-if="pipelineShown"
              :timing="timing"
              :history="history"
              :program="program"
              :state="state"
              :pending="pending"
              :running="running"
              :control-unavailable="controlUnavailable"
            />
            <Rv32Cycle
              v-else
              :state="state"
              :program="program"
              :record="lastRecord"
              :pending="pending"
              :control-unavailable="controlUnavailable"
            />
          </CardContent>
        </Card>
      </template>
      <template #registers>
        <Rv32Registers
          :state="state"
          :previous="lastRecord?.before.registers ?? null"
          :record="lastRecord"
          :after="lastAfter"
          :stored="registerLink"
          :tick="history.length"
        />
      </template>
      <template #operation>
        <Rv32Alu :record="lastRecord" />
      </template>
      <template #flags>
        <Rv32Compare :state="state" :program="program" :record="lastRecord" />
      </template>
      <template #stack>
        <StackPanel :view="stack" @memory="page.showStackTop" />
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
          :writes="lastWrites"
          :access="memoryAccess"
          intro="One flat space of 32-bit addresses: RAM from 0x00000000 (the code first), the devices at 0x10000000. Dots mark addresses with nothing wired to them."
          :tick="history.length"
        />
      </template>
    </StageColumn>
  </WorkbenchPanes>

  <PredictionBar
    :asking="asking"
    :last="last"
    :skipped="skipped"
    :tally="tally"
    @answer="answer"
    @skip="skip"
  />
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
    @step="controls.stepProgram"
    @phase="controls.stepPhase"
    @run="controls.runProgram"
    @pause="controls.pause"
    @undo="cpu.undoLast"
    @redo="cpu.redo"
    @reset="askReset"
    @again="runAgain"
    @seek="cpu.seek"
  />
</template>
