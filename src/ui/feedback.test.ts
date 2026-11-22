import { describe, expect, it } from 'vitest';
import {
  MESSAGE_LIMIT,
  emailProblem,
  emptyDraft,
  feedbackPayload,
  isSendable,
  type FeedbackContext
} from './feedback';

const context: FeedbackContext = {
  topic: 'logic',
  architecture: 'rv32',
  layout: 'phone',
  dark: true,
  version: '0.2.0+abc1234'
};

describe('emailProblem', () => {
  it('accepts no address and a plausible one', () => {
    expect(emailProblem(emptyDraft())).toBeNull();
    expect(emailProblem({ ...emptyDraft(), email: '  student@example.edu ' })).toBeNull();
  });

  it('rejects what is not an address', () => {
    expect(emailProblem({ ...emptyDraft(), email: 'student@' })).not.toBeNull();
    expect(emailProblem({ ...emptyDraft(), email: 'a b@example.com' })).not.toBeNull();
  });
});

describe('isSendable', () => {
  it('needs a message', () => {
    expect(isSendable(emptyDraft())).toBe(false);
    expect(isSendable({ ...emptyDraft(), message: '   \n' })).toBe(false);
    expect(isSendable({ ...emptyDraft(), message: 'More examples, please' })).toBe(true);
  });

  it('refuses a message past the limit', () => {
    expect(isSendable({ ...emptyDraft(), message: 'x'.repeat(MESSAGE_LIMIT) })).toBe(true);
    expect(isSendable({ ...emptyDraft(), message: 'x'.repeat(MESSAGE_LIMIT + 1) })).toBe(false);
  });

  it('refuses a bad address', () => {
    expect(isSendable({ ...emptyDraft(), message: 'Hi', email: 'nope' })).toBe(false);
  });
});

describe('feedbackPayload', () => {
  it('sends the message with where the app was', () => {
    const draft = { ...emptyDraft(), kind: 'problem' as const, message: ' The flags are wrong ' };
    expect(feedbackPayload(draft, context)).toEqual({
      _subject: 'CPU Playground feedback: Problem',
      kind: 'Problem',
      message: 'The flags are wrong',
      topic: 'logic',
      architecture: 'rv32',
      layout: 'phone',
      theme: 'dark',
      version: '0.2.0+abc1234'
    });
  });

  it('includes the address only when one was given', () => {
    const draft = { ...emptyDraft(), message: 'Hi', email: ' me@example.com ' };
    expect(feedbackPayload(draft, context).email).toBe('me@example.com');
    expect('email' in feedbackPayload({ ...draft, email: ' ' }, context)).toBe(false);
  });

  it('never sends the trap field', () => {
    const draft = { ...emptyDraft(), message: 'Hi', trap: 'filled by a script' };
    expect(Object.values(feedbackPayload(draft, context))).not.toContain('filled by a script');
  });
});
