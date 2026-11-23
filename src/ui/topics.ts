/** The topics the app teaches, in the order the header lists them. */
export const TOPIC_CHOICES = [
  { id: 'cpu', label: 'CPU', name: 'the CPU' },
  { id: 'logic', label: 'Logic', name: 'digital logic' },
  { id: 'numbers', label: 'Numbers', name: 'number representation' },
  { id: 'storage', label: 'Storage', name: 'how a value is kept' },
  { id: 'control', label: 'Control', name: 'the control unit' }
] as const;

export type TopicId = (typeof TOPIC_CHOICES)[number]['id'];

/** A topic an operation of the CPU can be opened in. */
export type LinkedTopic = Exclude<TopicId, 'cpu'>;

export function isTopicId(value: unknown): value is TopicId {
  return TOPIC_CHOICES.some((choice) => choice.id === value);
}
