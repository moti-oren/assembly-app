<script setup lang="ts">
import { computed, ref } from 'vue';
import { ChevronLeft, ChevronRight, Undo2 } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CpuMoment } from '@/ui/cpuMoment';
import type { LinkedTopic } from '@/ui/topics';
import type { TopicWay } from '@/ui/topicWays';
import { useLayoutMode } from '@/ui/useLayoutMode';
import { useTopic } from '@/ui/useTopic';
import TopicIcon from './TopicIcon.vue';
import TransportMore from './TransportMore.vue';

defineProps<{
  /** The moment of the CPU the topic follows. */
  moment: CpuMoment<unknown>;
  /** Whether the learner changed what the CPU gave. */
  edited: boolean;
  /** Whether the CPU's last instruction gave the topic something to show. */
  fromCpu: boolean;
  /** The ways on into the other topics. */
  ways: readonly TopicWay[];
}>();
defineEmits<{ seek: [position: number]; restore: [] }>();
defineSlots<{
  /** The topic's own controls, in the middle of the bar. */
  default?: () => unknown;
  /** A row of them above the bar, where a phone's bar has no room. */
  above?: () => unknown;
  /** Those a narrow bar keeps behind its More button, over the ways on; `close` shuts it. */
  more?: (props: { close: () => void }) => unknown;
}>();

const mode = useLayoutMode();
const { topic } = useTopic();
const moreOpen = ref(false);
/** A phone's bar frames every button, as the CPU's does there. */
const framed = computed(() => (mode.value === 'phone' ? 'outline' : 'ghost'));

/*
 * A button stays in place, and keeps the focus, at the end it leads to: one that disabled itself
 * as it was pressed would leave the keyboard on a dead control.
 */
const OFF_CLASS =
  'aria-disabled:cursor-default aria-disabled:text-tertiary-foreground aria-disabled:hover:bg-transparent';

function closeMore(): void {
  moreOpen.value = false;
}

function goFromMore(to: LinkedTopic): void {
  moreOpen.value = false;
  topic.value = to;
}
</script>

<!--
  The bottom of a topic's shell, where the CPU's page has its transport bar. Three zones: the
  CPU's steps this topic follows, the topic's own controls, and the ways on into other topics.
-->
<template>
  <footer class="transport">
    <div v-if="$slots.above" class="px-4 pt-2 empty:hidden"><slot name="above" /></div>
    <div
      class="flex items-center gap-x-5 px-4 py-2 max-md:gap-x-1.5 lg:grid lg:grid-cols-[auto_minmax(0,1fr)_auto]"
      role="toolbar"
      aria-label="Steps, this topic’s controls and other topics"
    >
      <div class="flex shrink-0 items-center gap-1" role="group" aria-label="The CPU’s steps">
        <Button
          :variant="framed"
          size="icon-sm"
          class="pointer-coarse:size-11"
          :class="OFF_CLASS"
          aria-label="The operation before this one"
          title="The operation before this one"
          :aria-disabled="moment.previous === null"
          @click="moment.previous !== null && $emit('seek', moment.previous)"
        >
          <ChevronLeft />
        </Button>
        <span
          class="font-mono text-xs whitespace-nowrap text-muted-foreground tabular-nums max-md:hidden"
        >
          <template v-if="moment.total > 0">
            <span class="sr-only">Step </span>{{ moment.position }} <span aria-hidden="true">/</span
            ><span class="sr-only">of</span> {{ moment.total }}
          </template>
          <template v-else>no steps</template>
        </span>
        <Button
          :variant="framed"
          size="icon-sm"
          class="pointer-coarse:size-11"
          :class="OFF_CLASS"
          aria-label="The operation after this one"
          title="The operation after this one"
          :aria-disabled="moment.next === null"
          @click="moment.next !== null && $emit('seek', moment.next)"
        >
          <ChevronRight />
        </Button>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              :variant="framed"
              size="sm"
              class="text-muted-foreground pointer-coarse:h-11 pointer-coarse:min-w-11"
              :class="OFF_CLASS"
              :aria-label="fromCpu ? 'Put back the CPU’s values' : 'Put back the starting values'"
              :aria-disabled="!edited"
              @click="edited && $emit('restore')"
            >
              <Undo2 />
              <span class="hidden xl:inline">Put back</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ fromCpu ? 'Puts back the CPU’s values' : 'Puts back the starting values' }}
          </TooltipContent>
        </Tooltip>
      </div>

      <div class="flex min-w-0 flex-1 items-center gap-x-3 lg:border-x lg:px-4">
        <slot />
      </div>

      <nav v-if="mode === 'desktop'" class="toggle-group" aria-label="Other topics">
        <!-- Icons only where there is no room; what is found there is always in the tooltip. -->
        <Tooltip v-for="way in ways" :key="way.to">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="sm"
              class="px-2.5 pointer-coarse:h-11 pointer-coarse:min-w-11"
              :aria-label="`${way.name}: ${way.label}`"
              @click="topic = way.to"
            >
              <TopicIcon :topic="way.to" />
              <span class="hidden xl:inline">{{ way.name }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ way.label }}</TooltipContent>
        </Tooltip>
      </nav>
      <TransportMore
        v-else
        v-model:open="moreOpen"
        :sheet="mode === 'phone'"
        label="Other topics"
        description="The ways on from here into the other topics."
      >
        <slot name="more" :close="closeMore" />
        <Button
          v-for="way in ways"
          :key="way.to"
          variant="outline"
          size="sm"
          class="justify-start pointer-coarse:h-11"
          @click="goFromMore(way.to)"
        >
          <TopicIcon :topic="way.to" />
          {{ way.name }}
          <span class="truncate font-normal text-muted-foreground">· {{ way.label }}</span>
        </Button>
      </TransportMore>
    </div>
  </footer>
</template>
