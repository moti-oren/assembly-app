<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue';
import type { RegisterLink, RegisterWrite } from '@/core/registerLink';
import type { CpuMoment } from '@/ui/cpuMoment';
import { SEQUENCES } from '@/ui/storageSequence';
import {
  CELLS,
  equationText,
  registerChoices,
  registerTitle,
  unavailableText
} from '@/ui/storageView';
import type { TopicSectionInfo } from '@/ui/topicSections';
import { useHexStyle } from '@/ui/useHexStyle';
import { useStorageCommands } from '@/ui/useStorageCommands';
import { useStorageFile } from '@/ui/useStorageFile';
import { useStorageLens } from '@/ui/useStorageLens';
import { useStorageSequence } from '@/ui/useStorageSequence';
import { useTopic } from '@/ui/useTopic';
import { useTopicView } from '@/ui/useTopicView';
import ChoiceGroup from './ChoiceGroup.vue';
import StageSection from './StageSection.vue';
import StorageCell from './StorageCell.vue';
import StorageFile from './StorageFile.vue';
import StorageRegister from './StorageRegister.vue';
import StorageSequence from './StorageSequence.vue';
import TopicWorkbench from './TopicWorkbench.vue';
import WidthPicker from './WidthPicker.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<RegisterLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useStorageLens(() => props.moment.link);
const file = useStorageFile(() => props.moment.link);
const sequence = useStorageSequence();
const { topic } = useTopic();
const commands = useStorageCommands(lens, file, sequence, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back')
});

const hexStyle = useHexStyle();
const equation = computed(() =>
  equationText(lens.write.value, lens.solution.value.stored, hexStyle.value)
);
// A register picked in the file is shown where a register is: the focus follows it there.
const registerSection = useTemplateRef<{ $el: HTMLElement }>('registerSection');
async function showRegister(write: RegisterWrite): Promise<void> {
  lens.show(write);
  // Once the section is named for the new register, so that name is what is read out.
  await nextTick();
  registerSection.value?.$el.focus();
  // A press of the pointer shows no focus ring: the section itself comes into sight.
  registerSection.value?.$el.scrollIntoView({ block: 'nearest' });
}

// A circuit picked in the sidebar may be far down the stage, or on a phone in another view: the
// page goes to it, so the pick is seen to do something.
const { showStage } = useTopicView();
const cellSection = useTemplateRef<{ $el: HTMLElement }>('cellSection');
const sequenceSection = useTemplateRef<{ $el: HTMLElement }>('sequenceSection');
async function reveal(section: { $el: HTMLElement } | null): Promise<void> {
  showStage();
  await nextTick();
  section?.$el.scrollIntoView({ block: 'start' });
}
function pickCell(id: Parameters<typeof lens.cell.pick>[0]): void {
  lens.cell.pick(id);
  void reveal(cellSection.value);
}
function pickSequence(id: Parameters<typeof sequence.pick>[0]): void {
  sequence.pick(id);
  void reveal(sequenceSection.value);
}

/** The registers the CPU's instruction wrote, when it wrote more than one. */
const written = computed(() =>
  registerChoices(lens.fromCpu.value?.writes ?? []).map((each, index) => ({
    id: index,
    label: each.register
  }))
);

/** The sidebar's sections: which circuit each part of the stage shows. */
const SECTIONS: readonly TopicSectionInfo[] = [
  { id: 'register', label: 'Register' },
  { id: 'cell', label: 'Memory cell' },
  { id: 'sequence', label: 'Flip-flops in a row' }
];
</script>

<!-- The storage topic: the flip-flops that keep what the CPU's last instruction wrote. -->
<template>
  <TopicWorkbench
    topic="storage"
    badge="ST"
    stage-label="Flip-flops"
    :commands="commands"
    :sections="SECTIONS"
    :moment="moment"
    :equation="equation"
    :edited="lens.isEdited.value"
    :from-cpu="lens.fromCpu.value !== null"
    :unavailable="unavailableText(moment.link)"
    :aside="lens.asRun.value ? (lens.fromCpu.value?.note ?? null) : null"
    @seek="emit('seek', $event)"
    @back="emit('back')"
    @restore="lens.restore()"
  >
    <template #register>
      <div class="flex flex-col gap-4">
        <ChoiceGroup
          v-if="written.length > 0"
          label="Register written"
          titled
          mono
          :choices="written"
          :chosen="lens.isEdited.value ? null : lens.chosen.value"
          @pick="lens.chooseRegister"
        />
        <WidthPicker :width="lens.request.value.width" @set="lens.setWidth" />
      </div>
    </template>
    <template #cell>
      <ChoiceGroup
        label="Memory cell"
        :choices="CELLS"
        :chosen="lens.cell.cell.value"
        @pick="pickCell"
      />
    </template>
    <template #sequence>
      <ChoiceGroup
        label="Circuit"
        :choices="SEQUENCES"
        :chosen="sequence.kind.value"
        @pick="pickSequence"
      />
    </template>

    <template #stage>
      <!-- Every circuit here has a clock of its own, beside the wires it moves. -->
      <StageSection
        ref="registerSection"
        class="outline-none focus-visible:ring-2 focus-visible:ring-ring"
        tabindex="-1"
        :title="registerTitle(lens.write.value)"
        :label="`The register ${registerTitle(lens.write.value)}`"
      >
        <template #lesson>
          A register is one flip-flop per bit, all on the same clock. A flip-flop takes its input at
          the moment the clock rises, and only if its write line is 1. Press a bit of the input or
          of the write line to flip it.
        </template>
        <StorageRegister :lens="lens" />
      </StageSection>

      <StorageCell ref="cellSection" :lens="lens" />
      <StorageFile :file="file" @show="showRegister" />
      <StorageSequence ref="sequenceSection" :sequence="sequence" @control="topic = 'control'" />

      <p class="max-w-prose px-4 py-(--pane-section-py) text-xs text-pretty text-muted-foreground">
        These are the simplest cells that behave the same. A real chip builds them from fewer
        transistors, but the idea is this one: a loop of gates holds the bit, and the clock says
        when it may change.
      </p>
    </template>
  </TopicWorkbench>
</template>
