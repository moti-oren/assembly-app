<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { decode } from '@/core/decode';
import { assemble, encode } from '@/core/encode';
import { formatInstruction, type Instruction } from '@/core/instructions';
import { formatLabel } from '@/core/operands';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import AppHeader from '@/ui/components/AppHeader.vue';
import ChangeStrip from '@/ui/components/ChangeStrip.vue';
import CpuCycle from '@/ui/components/CpuCycle.vue';
import CpuDiagram from '@/ui/components/CpuDiagram.vue';
import DevicesPanel from '@/ui/components/DevicesPanel.vue';
import EncodingPanel from '@/ui/components/EncodingPanel.vue';
import CommandPalette, { type PaletteCommand } from '@/ui/components/CommandPalette.vue';
import FlagsPanel from '@/ui/components/FlagsPanel.vue';
import HistoryLog from '@/ui/components/HistoryLog.vue';
import InstructionBuilder from '@/ui/components/InstructionBuilder.vue';
import LastOperation from '@/ui/components/LastOperation.vue';
import MemoryView from '@/ui/components/MemoryView.vue';
import ProgramPanel from '@/ui/components/ProgramPanel.vue';
import RegistersPanel from '@/ui/components/RegistersPanel.vue';
import TransportBar from '@/ui/components/TransportBar.vue';
import { EXAMPLE_PROGRAMS } from '@/core/program';
import { RUN_SPEEDS, useCpu, type RunSpeed } from '@/ui/useCpu';
import { useDataFlow } from '@/ui/useDataFlow';
import { usePreferences } from '@/ui/usePreferences';
import { raisedOverflow, stepSound } from '@/ui/sounds';

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
  pending,
  speed,
  running
} = cpu;

useDataFlow(state, history);

const programLines = computed(() => program.value.map(formatInstruction));

const { isDark, soundOn, cpuView, toggleTheme, play } = usePreferences();

// One instruction forward sounds like what it did; anything bigger is a single ratchet.
watch(
  () => history.value.length,
  (length, previous) => {
    const record = lastRecord.value;
    if (length === previous + 1 && record) {
      play(stepSound(record, state));
      if (raisedOverflow(record, state)) play('overflow', 0.03);
      if (record.line !== null && finished.value) play('halt', 0.12);
    } else if (length === previous - 1) {
      play('undo');
    } else {
      play('ratchet');
    }
  }
);
watch(error, (message) => message && play('error'));
watch(
  () => program.value.length,
  (length, previous) => length === previous + 1 && play('punch')
);

/** The machine code of every program line; the program itself is never run from these bytes. */
const assembled = computed(() => assemble(program.value));
const bytesShown = ref(false);
/** The complete instruction sitting in the builder, if any. */
const draft = shallowRef<Instruction | null>(null);
/** A program line whose bytes were clicked; it stays on show until the program moves on. */
const inspectedLine = ref<number | null>(null);
watch([() => history.value.length, program], () => {
  inspectedLine.value = null;
});

function inspect(line: number): void {
  inspectedLine.value = line;
  bytesShown.value = true;
}

/** What the machine code panel takes apart: the draft, else a program line, else the last run. */
const encodingShown = computed(() => {
  const { lines } = assembled.value;
  if (draft.value) {
    return {
      instruction: draft.value,
      assembled: encode(draft.value, program.value),
      where: 'as the next line of the program'
    };
  }
  const line = inspectedLine.value ?? (finished.value ? null : state.registers.ip);
  if (line !== null && lines[line]) {
    return {
      instruction: program.value[line],
      assembled: lines[line],
      where: `line ${formatLabel(line)}`
    };
  }
  const record = lastRecord.value;
  if (!record) return null;
  return record.line !== null && lines[record.line]
    ? {
        instruction: program.value[record.line],
        assembled: lines[record.line],
        where: `line ${formatLabel(record.line)}, the last one run`
      }
    : {
        instruction: record.instruction,
        assembled: encode(record.instruction, program.value),
        where: 'the last instruction run'
      };
});

const paletteOpen = ref(false);
/** The full list of executed instructions; the timeline itself is always in the bar. */
const historyShown = ref(false);
/** The LEDs, switches, digits and terminal. They open by themselves when a program uses a port. */
const devicesShown = ref(false);
const usesPort = (instruction: Instruction): boolean => decode(instruction).port !== null;
watch([program, lastRecord], ([lines, record]) => {
  const inProgram = lines.some(usesPort);
  if (inProgram || (record && usesPort(record.instruction))) devicesShown.value = true;
});

const commands = computed<PaletteCommand[]>(() => [
  {
    group: 'Program',
    label: 'Step one line',
    disabled: finished.value,
    run: cpu.stepProgram
  },
  {
    group: 'Program',
    label: 'Step one phase (fetch, decode, execute)',
    disabled: finished.value,
    run: cpu.stepPhase
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
  {
    group: 'History',
    label: historyShown.value ? 'Hide the history list' : 'Show the history list',
    run: () => {
      historyShown.value = !historyShown.value;
    }
  },
  { group: 'History', label: 'Reset the CPU', run: cpu.reset },
  {
    group: 'Program',
    label: bytesShown.value ? 'Hide the machine code' : 'Show the machine code',
    run: () => {
      bytesShown.value = !bytesShown.value;
    }
  },
  {
    group: 'Devices',
    label: devicesShown.value ? 'Hide the I/O devices' : 'Show the I/O devices',
    run: () => {
      devicesShown.value = !devicesShown.value;
    }
  },
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
    <!-- The page scrolls as a whole: every panel keeps its own height instead of sharing one window. -->
    <div class="app-surface flex min-h-svh flex-col bg-muted/40 dark:bg-background">
      <AppHeader
        @reset="cpu.reset"
        @load-example="cpu.loadExample"
        @commands="paletteOpen = true"
      />
      <CommandPalette v-model:open="paletteOpen" :commands="commands" />
      <ChangeStrip v-if="lastRecord" class="lg:hidden" :state="state" :record="lastRecord" />

      <!-- Left: what you write. Right: the machine: the CPU, then what is on its bus. -->
      <main
        class="mx-auto grid w-full max-w-7xl flex-1 content-start items-start gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:px-6"
      >
        <div class="flex min-w-0 flex-col gap-4">
          <InstructionBuilder
            :run="cpu.run"
            :add="cpu.addToProgram"
            :error="error"
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
              @clear="cpu.clearProgram"
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
