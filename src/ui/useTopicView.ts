import { ref } from 'vue';
import { createGlobalState } from '@vueuse/core';
import { useLayoutMode } from './useLayoutMode';
import { useWorkbenchView } from './useWorkbenchView';

/** The views a phone shows a topic's page in: what is set, and what is drawn. */
export const TOPIC_VIEWS = ['controls', 'stage'] as const;

type TopicView = (typeof TOPIC_VIEWS)[number];

/**
 * The part of a topic's page a phone shows. Shared by every topic, so going from one to the
 * next keeps the page where it was. A phone starts at the drawing: that is what a link from the
 * CPU came to see.
 */
export const useTopicView = createGlobalState(() => {
  const mode = useLayoutMode();
  const { drawerOpen } = useWorkbenchView();
  const view = ref<TopicView>('stage');

  /** Brings the sidebar's controls in sight, whatever the layout: a desktop already shows them. */
  function showControls(): void {
    if (mode.value === 'phone') view.value = 'controls';
    else if (mode.value === 'tablet') drawerOpen.value = true;
  }

  return { view, showControls };
});
