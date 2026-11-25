<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import type { ControlLink } from '@/core/controlLink';
import { equationText, pcAbsentText, unavailableText } from '@/ui/controlView';
import type { CpuMoment } from '@/ui/cpuMoment';
import { sectionKey, type TopicSectionInfo } from '@/ui/topicSections';
import { useControlCommands } from '@/ui/useControlCommands';
import { useControlLens } from '@/ui/useControlLens';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useTopic } from '@/ui/useTopic';
import { useTopicSections } from '@/ui/useTopicSections';
import { useTopicView } from '@/ui/useTopicView';
import ControlEffect from './ControlEffect.vue';
import ControlFields from './ControlFields.vue';
import ControlLines from './ControlLines.vue';
import ControlPc from './ControlPc.vue';
import ControlPlane from './ControlPlane.vue';
import ControlWord from './ControlWord.vue';
import ControlWordEntry from './ControlWordEntry.vue';
import StageSection from './StageSection.vue';
import TopicWorkbench from './TopicWorkbench.vue';

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
const mode = useLayoutMode();
const { topic } = useTopic();
const { showControls } = useTopicView();
const folded = useTopicSections();

// The box is in the sidebar, which a narrow screen or a folded section may be hiding.
const entry = useTemplateRef<HTMLElement>('entry');
async function focusWord(): Promise<void> {
  showControls();
  folded.expand(sectionKey('control', 'word'));
  await nextTick();
  entry.value?.querySelector<HTMLElement>('[data-control-word]')?.focus();
}
const commands = useControlCommands(lens, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back'),
  focusWord
});

// The word as it decodes with every line working; a line the learner broke is said after it.
const equation = computed(() =>
  equationText(lens.word.value, lens.healthy.value, lens.faults.value)
);

/**
 * The sidebar's sections. A phone shows the sidebar as a view of its own, so there the fields
 * stay under the bits they are made of.
 */
const sections = computed<TopicSectionInfo[]>(() => [
  { id: 'word', label: 'Instruction word' },
  ...(mode.value === 'phone' ? [] : [{ id: 'fields', label: 'Fields of the word' }])
]);
</script>

<!-- The control topic: the lines the CPU's last instruction was decoded into, and the next PC. -->
<template>
  <TopicWorkbench
    topic="control"
    badge="CU"
    stage-label="Control unit"
    :commands="commands"
    :sections="sections"
    :moment="moment"
    :equation="equation"
    :edited="lens.isEdited.value"
    :from-cpu="lens.fromCpu.value !== null"
    :unavailable="unavailableText(moment.link)"
    :aside="null"
    @seek="emit('seek', $event)"
    @back="emit('back')"
    @restore="lens.restore()"
  >
    <template #word>
      <div ref="entry">
        <ControlWordEntry :lens="lens" />
      </div>
    </template>
    <template #fields>
      <ControlFields :lens="lens" />
    </template>

    <template #stage>
      <StageSection title="The instruction, as 32 bits" label="The instruction word">
        <template #lesson>
          This is all the control unit gets. It reads a few of these bits and, from them alone, sets
          every line that tells the rest of the CPU what to do. Press a bit to flip it, or type
          another word in hex, and see what it becomes.
        </template>
        <ControlWord :lens="lens" :with-fields="mode === 'phone'" />
      </StageSection>

      <StageSection title="The main decoder: what kind is it?" label="The main decoder">
        <template #lesson>
          Every row is one AND gate that reads the seven bits of the opcode, some of them through a
          NOT. Only the row whose pattern the word carries is on. Every column on the right is one
          OR gate: a line is 1 when the row that is on has a dot in it.
        </template>
        <ControlPlane
          :solution="lens.solution.value.main"
          :faults="lens.faults.value"
          :wires="lens.shape.value.wires"
          caption="The main decoder: one AND gate for each kind of instruction, and the control lines it feeds"
          row-heading="Kind"
        />
      </StageSection>

      <StageSection title="The ALU decoder: which operation?" label="The ALU decoder">
        <template #lesson>
          The opcode does not say which operation. This second decoder reads what the first one
          found, with funct3 and two bits of funct7, and sets the lines of the ALU. One of them is
          the adder’s sub line.
        </template>
        <ControlPlane
          :solution="lens.solution.value.alu"
          :faults="lens.faults.value"
          :wires="lens.shape.value.wires"
          caption="The ALU decoder: one AND gate for each operation, and the ALU lines it feeds"
          row-heading="Operation"
        />
      </StageSection>

      <StageSection title="What the lines tell the CPU" label="The control lines">
        <template #lesson>
          Press a line to see what it switches, and break it: a line stuck at 0 or at 1 stays there
          whatever the word says. It stays broken as the CPU steps, so you can follow a program with
          it.
        </template>
        <ControlLines :lens="lens" @open="topic = $event" />
      </StageSection>

      <StageSection title="What the lines make the CPU do" label="What the instruction does">
        <template #lesson>
          The lines are all the rest of the CPU gets. Here they turn its switches, with nothing else
          knowing which instruction this is: what goes into the ALU, whether memory is used, what rd
          takes.
        </template>
        <ControlEffect :lens="lens" />
      </StageSection>

      <StageSection title="Where PC goes next" label="The program counter">
        <template #lesson>
          PC is a register like any other, loaded at the end of every instruction. Two adders work
          out the two places it could go, and the Branch and Jump lines choose between them.
        </template>
        <ControlPc
          v-if="lens.pc.value"
          :lens="lens"
          :solution="lens.pc.value"
          :next="moment.next"
          @next="emit('seek', $event)"
        />
        <p v-else class="max-w-prose text-sm text-pretty">
          {{ pcAbsentText(lens.fromCpu.value) }}
        </p>
      </StageSection>

      <p class="max-w-prose px-4 py-(--pane-section-py) text-xs text-pretty text-muted-foreground">
        This is the control unit of a CPU that does a whole instruction in one clock cycle. It reads
        only the bits that tell RV32IM’s instructions apart: a real one also checks the rest of
        funct7, and funct3 where not every value is an instruction.
      </p>
    </template>
  </TopicWorkbench>
</template>
