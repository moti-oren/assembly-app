import { ref, watch } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { useLayoutMode } from './useLayoutMode';
import type { TopicView } from './topics';
import { useTopic } from './useTopic';
import { useWorkbenchView } from './useWorkbenchView';

/**
 * The part of a topic's page a phone shows. Shared by every topic, so going from one to the
 * next keeps the page where it was. A phone starts at the drawing, and comes back to it from the
 * CPU: that is what a link from the CPU came to see.
 */
export const useTopicView = createGlobalState(() => {
  const mode = useLayoutMode();
  const { drawerOpen } = useWorkbenchView();
  const view = ref<TopicView>('stage');
  // Coming from the CPU is coming to see the drawing, whatever view a topic was left on.
  watch(useTopic().topic, (now, was) => {
    if (was === 'cpu' && now !== 'cpu') view.value = 'stage';
  });

  /** Brings the sidebar's controls in sight, whatever the layout: a desktop already shows them. */
  function showControls(): void {
    if (mode.value === 'phone') view.value = 'controls';
    else if (mode.value === 'tablet') drawerOpen.value = true;
  }

  /** Brings the drawing in sight: a phone's stage view, or the stage behind a tablet's drawer. */
  function showStage(): void {
    if (mode.value === 'phone') view.value = 'stage';
    else if (mode.value === 'tablet') drawerOpen.value = false;
  }

  return { view, showControls, showStage };
});
