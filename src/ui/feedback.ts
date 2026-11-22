import type { ArchitectureId } from './architectures';
import type { LayoutMode } from './layoutMode';
import type { TopicId } from './topics';

/** What a piece of feedback is about, in the order the dialog lists them. */
export const FEEDBACK_KINDS = [
  { id: 'idea', label: 'Idea' },
  { id: 'problem', label: 'Problem' },
  { id: 'other', label: 'Other' }
] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]['id'];

export interface FeedbackDraft {
  kind: FeedbackKind;
  message: string;
  /** Optional: only so the developer can answer. */
  email: string;
  /** A field no person sees or fills; a script that fills every field gives itself away. */
  trap: string;
}

/** Where the app was when the feedback was written, sent along so a report can be understood. */
export interface FeedbackContext {
  topic: TopicId;
  architecture: ArchitectureId;
  layout: LayoutMode;
  dark: boolean;
  version: string;
}

export const MESSAGE_LIMIT = 4000;

export function emptyDraft(): FeedbackDraft {
  return { kind: 'idea', message: '', email: '', trap: '' };
}

/** Why the address cannot be used, or null when it is empty or looks like one. */
export function emailProblem(draft: FeedbackDraft): string | null {
  const email = draft.email.trim();
  if (email === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return 'This does not look like an email address.';
}

export function isSendable(draft: FeedbackDraft): boolean {
  const length = draft.message.trim().length;
  return length > 0 && length <= MESSAGE_LIMIT && emailProblem(draft) === null;
}

/** The fields sent to the form service. The address is left out unless one was given. */
export function feedbackPayload(
  draft: FeedbackDraft,
  context: FeedbackContext
): Record<string, string> {
  const kind = FEEDBACK_KINDS.find((each) => each.id === draft.kind)!.label;
  const email = draft.email.trim();
  return {
    _subject: `CPU Playground feedback: ${kind}`,
    kind,
    message: draft.message.trim(),
    ...(email && { email }),
    topic: context.topic,
    architecture: context.architecture,
    layout: context.layout,
    theme: context.dark ? 'dark' : 'light',
    version: context.version
  };
}
