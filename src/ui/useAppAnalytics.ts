import { watch } from 'vue';
import { analytics } from './analyticsClient';
import { useComparison } from './useComparison';
import { usePreferences } from './usePreferences';
import { useTopic } from './useTopic';

/** Counts what is on show: the topic and the CPU, at the start and at every change. */
export function useAppAnalytics(): void {
  const { architecture } = usePreferences();
  const { topic } = useTopic();
  const { open: comparisonOpen } = useComparison();

  watch(
    [topic, architecture],
    () => analytics.track({ name: 'view', topic: topic.value, architecture: architecture.value }),
    { immediate: true }
  );
  watch(comparisonOpen, (isOpen) => {
    if (isOpen) analytics.track({ name: 'compare-opened' });
  });
}
