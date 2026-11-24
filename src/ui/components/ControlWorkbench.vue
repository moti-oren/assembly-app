<script setup lang="ts">
import { computed, onActivated, onMounted, ref, useTemplateRef } from 'vue';
import { CircuitBoard, MemoryStick } from '@lucide/vue';
import type { ControlLink } from '@/core/controlLink';
import { Button } from '@/components/ui/button';
import { equationText, pcAbsentText, unavailableText } from '@/ui/controlView';
import type { CpuMoment } from '@/ui/cpuMoment';
import { useControlCommands } from '@/ui/useControlCommands';
import { useControlLens } from '@/ui/useControlLens';
import { useTopic } from '@/ui/useTopic';
import AppErrorNotice from './AppErrorNotice.vue';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import CommandPalette from './CommandPalette.vue';
import ControlEffect from './ControlEffect.vue';
import ControlLines from './ControlLines.vue';
import ControlPc from './ControlPc.vue';
import ControlPlane from './ControlPlane.vue';
import ControlWord from './ControlWord.vue';
import HeaderShell from './HeaderShell.vue';
import TopicOrigin from './TopicOrigin.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<ControlLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useControlLens(() => props.moment.link);
const { topic } = useTopic();
const paletteOpen = ref(false);

// The control that opened this page is gone with the page it was on: focus starts here instead.
const page = useTemplateRef<HTMLElement>('page');
const focusPage = (): void => page.value?.focus({ preventScroll: true });
onMounted(focusPage);
onActivated(focusPage);
const commands = useControlCommands(lens, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back'),
  focusWord: () => page.value?.querySelector<HTMLElement>('[data-control-word]')?.focus()
});

const equation = computed(() => equationText(lens.word.value, lens.solution.value));
/** Why the CPU's last instruction has no control unit to show here, when it has none. */
const unavailable = computed(() => unavailableText(props.moment.link));
</script>

<!-- The control topic: the lines the CPU's last instruction was decoded into, and the next PC. -->
<template>
  <HeaderShell badge="CU" menu-label="Topics and settings" @commands="paletteOpen = true">
    <template #context>
      <ArchitectureSwitch />
    </template>
  </HeaderShell>
  <CommandPalette v-model:open="paletteOpen" :commands="commands" />
  <AppErrorNotice />

  <main ref="page" class="logic-page outline-none" tabindex="-1" aria-label="The control unit">
    <!-- No section is wider than the page: what is wider inside one scrolls there. -->
    <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-5 *:min-w-0 sm:px-6">
      <TopicOrigin
        :moment="moment"
        :equation="equation"
        :edited="lens.isEdited.value"
        :from-cpu="lens.fromCpu.value !== null"
        :unavailable="unavailable"
        :aside="null"
        @seek="emit('seek', $event)"
        @back="emit('back')"
        @restore="lens.restore()"
      />

      <section class="border-t pt-5" aria-label="The instruction word">
        <h2 class="text-base font-semibold tracking-tight">The instruction, as 32 bits</h2>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          This is all the control unit gets. It reads a few of these bits and, from them alone, sets
          every line that tells the rest of the CPU what to do. Press a bit to flip it, or type
          another word in hex, and see what it becomes.
        </p>
        <div class="mt-3">
          <ControlWord :lens="lens" />
        </div>
      </section>

      <section class="border-t pt-5" aria-label="The main decoder">
        <h2 class="text-base font-semibold tracking-tight">The main decoder: what kind is it?</h2>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          Every row is one AND gate that reads the seven bits of the opcode, some of them through a
          NOT. Only the row whose pattern the word carries is on. Every column on the right is one
          OR gate: a line is 1 when the row that is on has a dot in it.
        </p>
        <div class="mt-3">
          <ControlPlane
            :solution="lens.solution.value.main"
            :faults="lens.faults.value"
            :wires="lens.shape.value.wires"
            caption="The main decoder: one AND gate for each kind of instruction, and the control lines it feeds"
            row-heading="Kind"
          />
        </div>
      </section>

      <section class="border-t pt-5" aria-label="The ALU decoder">
        <h2 class="text-base font-semibold tracking-tight">The ALU decoder: which operation?</h2>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          The opcode does not say which operation. This second decoder reads what the first one
          found, with funct3 and two bits of funct7, and sets the lines of the ALU. One of them is
          the adder’s sub line.
        </p>
        <div class="mt-3">
          <ControlPlane
            :solution="lens.solution.value.alu"
            :faults="lens.faults.value"
            :wires="lens.shape.value.wires"
            caption="The ALU decoder: one AND gate for each operation, and the ALU lines it feeds"
            row-heading="Operation"
          />
        </div>
      </section>

      <section class="border-t pt-5" aria-label="The control lines">
        <h2 class="text-base font-semibold tracking-tight">What the lines tell the CPU</h2>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          Press a line to see what it switches, and break it: a line stuck at 0 or at 1 stays there
          whatever the word says. It stays broken as the CPU steps, so you can follow a program with
          it.
        </p>
        <div class="mt-3">
          <ControlLines :lens="lens" @open="topic = $event" />
        </div>
      </section>

      <section class="border-t pt-5" aria-label="What the instruction does">
        <h2 class="text-base font-semibold tracking-tight">What the lines make the CPU do</h2>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          The lines are all the rest of the CPU gets. Here they turn its switches, with nothing else
          knowing which instruction this is: what goes into the ALU, whether memory is used, what rd
          takes.
        </p>
        <div class="mt-3">
          <ControlEffect :lens="lens" />
        </div>
      </section>

      <section class="border-t pt-5" aria-label="The program counter">
        <h2 class="text-base font-semibold tracking-tight">Where PC goes next</h2>
        <p class="mt-2 max-w-prose text-sm leading-relaxed text-pretty text-muted-foreground">
          PC is a register like any other, loaded at the end of every instruction. Two adders work
          out the two places it could go, and the Branch and Jump lines choose between them.
        </p>
        <div class="mt-3">
          <ControlPc v-if="lens.pc.value" :lens="lens" :solution="lens.pc.value" />
          <p v-else class="max-w-prose text-sm text-pretty">
            {{ pcAbsentText(lens.fromCpu.value) }}
          </p>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4">
        <p class="max-w-prose min-w-0 flex-1 basis-64 text-xs text-pretty text-muted-foreground">
          This is the control unit of a CPU that does a whole instruction in one clock cycle. It
          reads only the bits that tell RV32IM’s instructions apart: a real one also checks the rest
          of funct7, and funct3 where not every value is an instruction.
        </p>
        <Button
          variant="outline"
          size="sm"
          class="max-sm:w-full pointer-coarse:h-11"
          @click="topic = 'logic'"
        >
          <CircuitBoard />
          The gates of the ALU
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="max-sm:w-full pointer-coarse:h-11"
          @click="topic = 'storage'"
        >
          <MemoryStick />
          The flip-flops of a register
        </Button>
      </div>
    </div>
  </main>
</template>
