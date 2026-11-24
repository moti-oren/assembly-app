<script setup lang="ts">
import { computed } from 'vue';
import type { NumberLink } from '@/core/numberLink';
import type { CpuMoment } from '@/ui/cpuMoment';
import { isComparison } from '@/ui/numbersCompare';
import { CONDITION_SETS } from '@/ui/numbersConditions';
import { equationText, lensLesson, lensTitle, unavailableText } from '@/ui/numbersView';
import type { TopicSectionInfo } from '@/ui/topicSections';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useNumberLens } from '@/ui/useNumberLens';
import { useNumbersCommands } from '@/ui/useNumbersCommands';
import { usePreferences } from '@/ui/usePreferences';
import NumbersArithmetic from './NumbersArithmetic.vue';
import NumbersBcd from './NumbersBcd.vue';
import NumbersCompare from './NumbersCompare.vue';
import NumbersExtension from './NumbersExtension.vue';
import NumbersFlags from './NumbersFlags.vue';
import NumbersOperation from './NumbersOperation.vue';
import NumbersShift from './NumbersShift.vue';
import NumbersValue from './NumbersValue.vue';
import StageSection from './StageSection.vue';
import TopicWorkbench from './TopicWorkbench.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<NumberLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useNumberLens(() => props.moment.link);
const mode = useLayoutMode();
const { architecture } = usePreferences();
const commands = useNumbersCommands(lens, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back')
});

const request = computed(() => lens.request.value);
const solution = computed(() => lens.solution.value);
const equation = computed(() => equationText(request.value, solution.value));

/** The sidebar's sections. A value by itself, or one made wider, sets no flag: no section. */
const sections = computed<TopicSectionInfo[]>(() => [
  { id: 'numbers', label: 'Numbers' },
  ...(lens.view.value.flags.length > 0 || lens.view.value.note
    ? [
        {
          id: 'flags',
          label: lens.followsCpu.value ? 'What each flag says' : 'What a CPU would note'
        }
      ]
    : [])
]);
</script>

<!-- The number topic: what the CPU's last operation means as numbers, to read and to change. -->
<template>
  <TopicWorkbench
    topic="numbers"
    badge="NM"
    stage-label="Numbers"
    :commands="commands"
    :sections="sections"
    :moment="moment"
    :equation="equation"
    :edited="lens.isEdited.value"
    :from-cpu="lens.fromCpu.value !== null"
    :unavailable="unavailableText(moment.link)"
    :aside="
      lens.discarded.value
        ? 'The CPU throws this result away and keeps only what it says about the two numbers.'
        : null
    "
    @seek="emit('seek', $event)"
    @back="emit('back')"
    @restore="lens.restore()"
  >
    <!-- A phone shows the sidebar as a view of its own: there one more stays under the sum. -->
    <template #numbers>
      <NumbersOperation :lens="lens" :with-extra="mode !== 'phone'" />
    </template>
    <template #flags>
      <NumbersFlags :lens="lens" />
    </template>

    <template #stage>
      <StageSection :title="lensTitle(request)" label="The numbers">
        <template #lesson>
          {{ lensLesson(request) }}
          Press a bit of an input to flip it.
        </template>
        <div>
          <NumbersArithmetic
            v-if="(request.kind === 'add' || request.kind === 'subtract') && 'unsigned' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
            :with-extra="mode === 'phone'"
          />
          <NumbersExtension
            v-else-if="request.kind === 'extend' && 'fill' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
          <NumbersBcd
            v-else-if="request.kind === 'bcd' && 'digits' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
          <NumbersShift
            v-else-if="request.kind === 'shift' && 'scales' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
          <NumbersValue
            v-else-if="request.kind === 'value' && 'readings' in solution"
            :lens="lens"
            :request="request"
            :solution="solution"
          />
        </div>
      </StageSection>

      <!-- Two numbers with one taken from the other are two numbers compared. -->
      <NumbersCompare
        v-if="isComparison(lens.view.value) && 'unsigned' in solution"
        :conditions="CONDITION_SETS[architecture]"
        :solution="solution"
      />

      <p class="max-w-prose px-4 py-(--pane-section-py) text-xs text-pretty text-muted-foreground">
        The CPU does one thing to the bits, whatever they stand for. The flags are how it leaves
        both answers for the program to pick from.
      </p>
    </template>
  </TopicWorkbench>
</template>
