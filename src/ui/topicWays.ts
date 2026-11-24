import type { LinkedTopic } from './topics';

/** A way on from one topic into another: where it leads, and what is found there. */
export interface TopicWay {
  to: LinkedTopic;
  /** The topic's name on a narrow button. */
  name: string;
  /** What the learner goes there to see, as this topic would say it. */
  label: string;
}

/** The ways on from each topic, in the order its bar lists them. */
export const TOPIC_WAYS: Record<LinkedTopic, readonly TopicWay[]> = {
  logic: [
    { to: 'numbers', name: 'Numbers', label: 'What it means as numbers' },
    { to: 'storage', name: 'Storage', label: 'How the result is kept' },
    { to: 'control', name: 'Control', label: 'What picks the operation' }
  ],
  numbers: [{ to: 'logic', name: 'Logic', label: 'The gates behind it' }],
  storage: [
    { to: 'logic', name: 'Logic', label: 'The gates that work a value out' },
    { to: 'control', name: 'Control', label: 'What turns the write line on' }
  ],
  control: [
    { to: 'logic', name: 'Logic', label: 'The gates of the ALU' },
    { to: 'storage', name: 'Storage', label: 'The flip-flops of a register' }
  ]
};
