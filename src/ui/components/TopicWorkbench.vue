<script setup lang="ts">
import { computed, onActivated, onMounted, ref, useTemplateRef } from 'vue';
import { PanelLeft } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import type { CpuMoment } from '@/ui/cpuMoment';
import type { PaletteCommand } from '@/ui/paletteCommand';
import { sectionKey, SOURCE_SECTION, type TopicSectionInfo } from '@/ui/topicSections';
import type { LinkedTopic } from '@/ui/topics';
import { TOPIC_WAYS } from '@/ui/topicWays';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useTopicTabFocus } from '@/ui/useTopicTabFocus';
import { TOPIC_VIEWS, useTopicView } from '@/ui/useTopicView';
import { useTopicViewCommands } from '@/ui/useTopicViewCommands';
import { useWorkbenchView } from '@/ui/useWorkbenchView';
import AppErrorNotice from './AppErrorNotice.vue';
import ArchitectureSwitch from './ArchitectureSwitch.vue';
import CommandPalette from './CommandPalette.vue';
import HeaderShell from './HeaderShell.vue';
import PaneFrame from './PaneFrame.vue';
import TopicBar from './TopicBar.vue';
import TopicSection from './TopicSection.vue';
import TopicSource from './TopicSource.vue';
import TopicStrip from './TopicStrip.vue';

const props = defineProps<{
  topic: LinkedTopic;
  /** Two letters on the header's chip. */
  badge: string;
  /** What the stage shows, for a screen reader and on a phone's tab: `Circuit`. */
  stageLabel: string;
  /** The topic's own palette commands; the shell adds those of its views and its sidebar. */
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

const mode = useLayoutMode();
const { view } = useTopicView();
const { drawerOpen } = useWorkbenchView();
const paletteOpen = ref(false);
const tabFocus = useTopicTabFocus();

const viewLabels = computed(() => ({ controls: 'Controls', stage: props.stageLabel }));
const viewCommands = useTopicViewCommands(
  props.topic,
  () => [SOURCE_SECTION, ...props.sections],
  () => props.stageLabel
);
const allCommands = computed(() => [...props.commands, ...viewCommands.value]);

// The control that opened this page is gone with the page it was on: focus starts here instead.
const stage = useTemplateRef<HTMLElement>('stage');
function focusStage(): void {
  // A control that outlived the change of page, such as a topic tab, keeps the focus it has.
  const held = document.activeElement;
  if (held && held !== document.body) return;
  // The activity bar's button of this topic is about to take it.
  if (tabFocus.pending()) return;
  stage.value?.focus({ preventScroll: true });
}
onMounted(focusStage);
onActivated(focusStage);
</script>

<!--
  The shell every topic's page is laid out in, the same three zones as a CPU's workbench: what
  is set in a sidebar, what is drawn on the stage, and a bar under both.
-->
<template>
  <HeaderShell :badge="badge" menu-label="Topics and settings" @commands="paletteOpen = true">
    <template #lead>
      <!-- On a tablet the sidebar is a drawer over the stage; this opens and closes it. -->
      <Button
        v-if="mode === 'tablet'"
        variant="outline"
        size="sm"
        class="pointer-coarse:h-11"
        :class="drawerOpen ? 'border-foreground/60 bg-muted text-foreground' : ''"
        :aria-pressed="drawerOpen"
        data-drawer-toggle
        aria-label="Controls: what this page shows, and where it came from"
        @click="drawerOpen = !drawerOpen"
      >
        <PanelLeft />
        Controls
      </Button>
    </template>
    <template #context>
      <ArchitectureSwitch />
    </template>
  </HeaderShell>
  <CommandPalette v-model:open="paletteOpen" :commands="allCommands" />
  <AppErrorNotice />
  <TopicStrip
    v-if="mode !== 'desktop'"
    :moment="moment"
    :equation="equation"
    :edited="edited"
    :unavailable="!edited && unavailable !== null"
    @back="$emit('back')"
  />

  <PaneFrame v-model:view="view" :views="TOPIC_VIEWS" :labels="viewLabels" sidebar-view="controls">
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
