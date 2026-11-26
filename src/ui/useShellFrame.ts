import { computed } from 'vue';
import { shellFrame } from './shellFrame';
import { usePreferences } from './usePreferences';
import { useTopic } from './useTopic';
import { useTopicView } from './useTopicView';
import { useWorkbenchView } from './useWorkbenchView';

/**
 * The shell's wording for the page on show, and the phone view of that page: the CPU's (Code,
 * CPU, Memory & I/O) or a topic's (Controls, the stage), each kept where it was left.
 */
export function useShellFrame() {
  const { topic } = useTopic();
  const { architecture } = usePreferences();
  const cpuView = useWorkbenchView().view;
  const topicView = useTopicView().view;

  const frame = computed(() => shellFrame(topic.value, architecture.value));

  const view = computed<string>({
    get: () => (topic.value === 'cpu' ? cpuView.value : topicView.value),
    set: (wanted) => {
      // Only a view the page on show has: a tab of another page never lands here.
      if (!frame.value.views.includes(wanted)) return;
      if (topic.value === 'cpu') cpuView.value = wanted as typeof cpuView.value;
      else topicView.value = wanted as typeof topicView.value;
    }
  });

  return { frame, view };
}
