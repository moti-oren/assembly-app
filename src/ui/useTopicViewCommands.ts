import { computed, type ComputedRef } from 'vue';
import type { PaletteCommand } from './paletteCommand';
import { sectionKey, type TopicSectionInfo } from './topicSections';
import type { LinkedTopic } from './topics';
import { useLayoutMode } from './useLayoutMode';
import { useTopicSections } from './useTopicSections';
import { useTopicView } from './useTopicView';
import { useWorkbenchView } from './useWorkbenchView';

/**
 * The palette commands of a topic's shell: which view a phone shows, a tablet's drawer, and
 * the sections of the sidebar to fold away.
 */
export function useTopicViewCommands(
  topic: LinkedTopic,
  sections: () => readonly TopicSectionInfo[],
  stageLabel: () => string
): ComputedRef<PaletteCommand[]> {
  const mode = useLayoutMode();
  const { view } = useTopicView();
  const { drawerOpen } = useWorkbenchView();
  const folded = useTopicSections();

  return computed<PaletteCommand[]>(() => [
    ...(mode.value === 'phone'
      ? [
          {
            group: 'View',
            label:
              view.value === 'stage' ? 'Show the Controls view' : `Show the ${stageLabel()} view`,
            run: () => {
              view.value = view.value === 'stage' ? 'controls' : 'stage';
            }
          }
        ]
      : []),
    ...(mode.value === 'tablet'
      ? [
          {
            group: 'View',
            label: drawerOpen.value ? 'Hide the controls drawer' : 'Show the controls drawer',
            run: () => {
              drawerOpen.value = !drawerOpen.value;
            }
          }
        ]
      : []),
    ...sections().map((section) => {
      const key = sectionKey(topic, section.id);
      return {
        group: 'Sidebar',
        label: `${folded.isCollapsed(key) ? 'Expand' : 'Collapse'} the ${section.label} panel`,
        run: () => folded.toggle(key)
      };
    })
  ]);
}
