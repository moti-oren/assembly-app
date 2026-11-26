<script setup lang="ts">
import { computed, nextTick, onActivated, onMounted, ref, useTemplateRef } from 'vue';
import type { CpuMoment } from '@/ui/cpuMoment';
import type { PaletteCommand } from '@/ui/paletteCommand';
import { sectionKey, SOURCE_SECTION, type TopicSectionInfo } from '@/ui/topicSections';
import { TOPIC_PAGES, type LinkedTopic } from '@/ui/topics';
import { TOPIC_WAYS } from '@/ui/topicWays';
import { useTopicViewCommands } from '@/ui/useTopicViewCommands';
import CommandPalette from './CommandPalette.vue';
import PaneFrame from './PaneFrame.vue';
import ShellParts from './ShellParts.vue';
import TopicBar from './TopicBar.vue';
import TopicSection from './TopicSection.vue';
import TopicSource from './TopicSource.vue';
import TopicStrip from './TopicStrip.vue';

const props = defineProps<{
  topic: LinkedTopic;
  /** The topic's own palette commands; the page adds those of its views and its sidebar. */
  commands: PaletteCommand[];
  /** The sections of the sidebar under the first, each filled through the slot of its id. */
  sections: readonly TopicSectionInfo[];
  /** The moment of the CPU the topic follows. */
  moment: CpuMoment<unknown>;
  /** The operation on show, on one line. */
  equation: string;
  /** Whether the learner changed what the CPU gave. */
  edited: boolean;
  /** Whether the CPU's last instruction gave the topic something to show. */
  fromCpu: boolean;
  /** Why the CPU's last instruction has nothing to show here, when it has nothing. */
  unavailable: string | null;
  /** A quiet remark on what is shown, such as a result the CPU threw away. */
  aside: string | null;
}>();
defineEmits<{ seek: [position: number]; back: []; restore: [] }>();

const paletteOpen = ref(false);
/** What the stage shows, for a screen reader and on a phone's tab: `Circuit`. */
const stageLabel = computed(() => TOPIC_PAGES[props.topic].stage);

const viewCommands = useTopicViewCommands(
  props.topic,
  () => [SOURCE_SECTION, ...props.sections],
  () => stageLabel.value
);
const allCommands = computed(() => [...props.commands, ...viewCommands.value]);

// A page opened from a control that is gone (a link in the last page's bar) starts at its stage;
// a control of the shell, such as a topic in the activity bar, keeps the focus it has. The last
// page's bar leaves the shell only once this page has filled it, a flush later.
const stage = useTemplateRef<HTMLElement>('stage');
async function focusStage(): Promise<void> {
  await nextTick();
  const held = document.activeElement;
  if (held && held !== document.body && held.isConnected) return;
  stage.value?.focus({ preventScroll: true });
}
onMounted(() => void focusStage());
onActivated(() => void focusStage());
</script>

<!--
  What every topic's page puts in the shell, the same three zones as a CPU's workbench: what is
  set in a sidebar, what is drawn on the stage, and a bar under both; below a desktop also the
  strip that keeps the operation in sight.
-->
<template>
  <ShellParts @commands="paletteOpen = true">
    <template #strip>
      <TopicStrip
        :moment="moment"
        :equation="equation"
        :edited="edited"
        :unavailable="!edited && unavailable !== null"
        @back="$emit('back')"
      />
    </template>
    <template #bar>
      <TopicBar
        :moment="moment"
        :edited="edited"
        :from-cpu="fromCpu"
        :ways="TOPIC_WAYS[topic]"
        @seek="$emit('seek', $event)"
        @restore="$emit('restore')"
      >
        <slot name="bar" />
        <template v-if="$slots.above" #above><slot name="above" /></template>
        <template v-if="$slots.more" #more="more"><slot name="more" v-bind="more" /></template>
      </TopicBar>
    </template>
  </ShellParts>
  <CommandPalette v-model:open="paletteOpen" :commands="allCommands" />

  <PaneFrame>
    <div class="workbench-pane" data-pane="sidebar">
      <TopicSection
        :storage-key="sectionKey(topic, SOURCE_SECTION.id)"
        :label="SOURCE_SECTION.label"
      >
        <TopicSource
          :moment="moment"
          :equation="equation"
          :edited="edited"
          :unavailable="edited ? null : unavailable"
          :aside="aside"
        />
      </TopicSection>
      <TopicSection
        v-for="section in sections"
        :key="section.id"
        :storage-key="sectionKey(topic, section.id)"
        :label="section.label"
      >
        <slot :name="section.id" />
      </TopicSection>
    </div>
    <!-- Sections query the stage's width, not the window's: the sidebar takes a share of that. -->
    <div
      ref="stage"
      class="@container workbench-pane outline-none"
      data-pane="stage"
      role="region"
      tabindex="-1"
      :aria-label="stageLabel"
    >
      <slot name="stage" />
    </div>
  </PaneFrame>
</template>
