import type { ArchitectureId } from './architectures';
import type { TopicId } from './topics';

/**
 * Everything the app counts, and all it says about each. No event carries what the user wrote:
 * no program text, no error message, only names from the app's own lists.
 */
export type AnalyticsEvent =
  | { name: 'view'; topic: TopicId; architecture: ArchitectureId }
  /** The link from a CPU's operation to its gates was followed. */
  | { name: 'circuit-opened'; architecture: ArchitectureId }
  /** The first instruction a CPU ran in this visit. */
  | { name: 'first-step'; architecture: string }
  | { name: 'program-run'; architecture: string }
  | { name: 'example-loaded'; architecture: string; example: string }
  | { name: 'compare-opened' }
  | { name: 'solution-loaded'; architecture: ArchitectureId; task: string }
  | { name: 'cpu-error'; architecture: string }
  | { name: 'feedback-sent'; kind: string };
