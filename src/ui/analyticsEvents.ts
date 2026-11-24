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
  /** The link from a CPU's operation to what it means as numbers was followed. */
  | { name: 'numbers-opened'; architecture: ArchitectureId }
  /** The link from a register a CPU wrote to the flip-flops that keep it was followed. */
  | { name: 'storage-opened'; architecture: ArchitectureId }
  /** The link from an instruction a CPU ran to the control lines it was decoded into was followed. */
  | { name: 'control-opened'; architecture: ArchitectureId }
  /** The first instruction a CPU ran in this visit. */
  | { name: 'first-step'; architecture: string }
  | { name: 'program-run'; architecture: string }
  | { name: 'example-loaded'; architecture: string; example: string }
  | { name: 'compare-opened' }
  | { name: 'solution-loaded'; architecture: ArchitectureId; task: string }
  /** The link to a program was copied; the program itself is never part of an event. */
  | { name: 'link-copied'; architecture: ArchitectureId }
  /** A program arrived through a link and was opened. */
  | { name: 'link-opened'; architecture: ArchitectureId }
  | { name: 'cpu-error'; architecture: string }
  /** A challenge was started, or its program first met every goal; only its id is sent. */
  | { name: 'challenge-started'; architecture: string; challenge: string }
  | { name: 'challenge-solved'; architecture: string; challenge: string }
  /** A gate of the logic topic's circuit was broken by hand; nothing says which. */
  | { name: 'gate-broken' }
  /** A control line of the control topic was broken by hand; nothing says which. */
  | { name: 'line-broken' }
  | { name: 'prediction-answered'; architecture: string; result: 'right' | 'wrong' }
  | { name: 'feedback-sent'; kind: string };
