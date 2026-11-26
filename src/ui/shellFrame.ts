import { ARCHITECTURE_CHOICES, type ArchitectureId } from './architectures';
import { PHONE_VIEW_LABELS, PHONE_VIEWS } from './layoutMode';
import { TOPIC_PAGES, TOPIC_VIEWS, type TopicId } from './topics';

/** What the shell around a page says of it: the same shell, worded for the page on show. */
export interface ShellFrame {
  /** Two letters on the header's chip. */
  badge: string;
  /** What the header's one menu below a desktop holds, for a screen reader. */
  menuLabel: string;
  /** The word on a tablet's drawer button, and what the button opens, for a screen reader. */
  drawer: { word: string; label: string };
  /** The views a phone switches between, in the order of their tabs. */
  views: readonly string[];
  viewLabels: Record<string, string>;
  /** The view that shows the sidebar; every other one shows the stage. */
  sidebarView: string;
}

const CPU_FRAME = {
  menuLabel: 'Topics, share, compare, examples and settings',
  drawer: { word: 'Code', label: 'Code: the instruction and the program' },
  views: PHONE_VIEWS,
  viewLabels: PHONE_VIEW_LABELS,
  sidebarView: 'code'
};

export function shellFrame(topic: TopicId, architecture: ArchitectureId): ShellFrame {
  if (topic === 'cpu') {
    const badge = ARCHITECTURE_CHOICES.find((choice) => choice.id === architecture)!.badge;
    return { ...CPU_FRAME, badge };
  }
  const page = TOPIC_PAGES[topic];
  return {
    badge: page.badge,
    menuLabel: 'Topics and settings',
    drawer: { word: 'Controls', label: 'Controls: what this page shows, and where it came from' },
    views: TOPIC_VIEWS,
    viewLabels: { controls: 'Controls', stage: page.stage },
    sidebarView: 'controls'
  };
}
