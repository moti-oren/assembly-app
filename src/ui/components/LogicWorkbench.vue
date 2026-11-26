<script setup lang="ts">
import { computed } from 'vue';
import { Timer } from '@lucide/vue';
import type { AluLink } from '@/core/aluLink';
import { Button } from '@/components/ui/button';
import type { CpuMoment } from '@/ui/cpuMoment';
import {
  circuitLesson,
  circuitTitle,
  equationText,
  logicSections,
  unavailableText
} from '@/ui/logicView';
import { useHexStyle } from '@/ui/useHexStyle';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useLogicCommands } from '@/ui/useLogicCommands';
import { useLogicLens } from '@/ui/useLogicLens';
import LogicAdder from './LogicAdder.vue';
import LogicBitwise from './LogicBitwise.vue';
import LogicFaultNote from './LogicFaultNote.vue';
import LogicFlags from './LogicFlags.vue';
import LogicGatePanel from './LogicGatePanel.vue';
import LogicOperation from './LogicOperation.vue';
import LogicShifter from './LogicShifter.vue';
import LogicSlice from './LogicSlice.vue';
import LogicTimeSteps from './LogicTimeSteps.vue';
import LogicTimeSwitch from './LogicTimeSwitch.vue';
import StageSection from './StageSection.vue';
import TopicWorkbench from './TopicWorkbench.vue';

const props = defineProps<{
  /** The CPU on show in the CPU topic, at the instruction it ran last. */
  moment: CpuMoment<AluLink>;
}>();
const emit = defineEmits<{
  /** Move the CPU through its history, to the instruction to show. */
  seek: [position: number];
  back: [];
}>();

const lens = useLogicLens(() => props.moment.link);
const mode = useLayoutMode();
const commands = useLogicCommands(lens, () => props.moment, {
  seek: (position) => emit('seek', position),
  back: () => emit('back')
});

// The operation is what a working circuit makes of it: a broken gate is the circuit's own affair.
const hexStyle = useHexStyle();
const equation = computed(() =>
  equationText(lens.request.value, lens.healthy.value.result, hexStyle.value)
);
const sections = computed(() => logicSections(mode.value === 'phone', lens.followsCpu.value));
</script>

<!-- The logic topic: the gates behind the CPU's last operation, to read and to change. -->
<template>
  <TopicWorkbench
    topic="logic"
    :commands="commands"
    :sections="sections"
    :moment="moment"
    :equation="equation"
    :edited="lens.isEdited.value"
    :from-cpu="lens.fromCpu.value !== null"
    :unavailable="unavailableText(moment.link)"
    :aside="
      lens.discarded.value
        ? 'The CPU throws this result away and keeps only what the circuit’s wires say about it.'
        : null
    "
    @seek="emit('seek', $event)"
    @back="emit('back')"
    @restore="lens.restore()"
  >
    <template #circuit>
      <LogicOperation :lens="lens" />
    </template>
    <template #gate>
      <LogicGatePanel :lens="lens" />
    </template>
    <template #flags>
      <LogicFlags :lens="lens" />
    </template>

    <template #stage>
      <StageSection :title="circuitTitle(lens.request.value)" label="The circuit">
        <template #lesson>
          {{ circuitLesson(lens.request.value) }}
          Press a bit of an input to flip it.
        </template>
        <LogicFaultNote :lens="lens" />
        <LogicShifter v-if="lens.request.value.kind === 'shift'" :lens="lens" />
        <LogicAdder
          v-else-if="lens.request.value.kind === 'add' || lens.request.value.kind === 'subtract'"
          :lens="lens"
        />
        <LogicBitwise v-else :lens="lens" />
      </StageSection>

      <LogicSlice :lens="lens" :with-gate-switches="mode === 'phone'" />

      <p class="max-w-prose px-4 py-(--pane-section-py) text-xs text-pretty text-muted-foreground">
        These are the simplest circuits that work out the same bits. A real chip uses faster ones,
        such as an adder that does not wait for its carry to ripple<template v-if="lens.asRun.value"
          >, but every wire you see here carries the value the CPU computed</template
        >.
      </p>
    </template>

    <template #bar>
      <LogicTimeSwitch :lens="lens" :compact="mode === 'phone'" />
      <LogicTimeSteps v-if="mode !== 'phone' && lens.time.on.value" :lens="lens" />
    </template>
    <template v-if="mode === 'phone' && lens.time.on.value" #above>
      <LogicTimeSteps :lens="lens" compact />
    </template>
    <!-- A phone's row of gate delays has no room for it. -->
    <template v-if="mode === 'phone' && lens.time.available.value" #more="{ close }">
      <Button
        variant="outline"
        size="sm"
        class="justify-start pointer-coarse:h-11"
        @click="(lens.tryLongestCarry(), close())"
      >
        <Timer />
        Longest carry
      </Button>
    </template>
  </TopicWorkbench>
</template>
