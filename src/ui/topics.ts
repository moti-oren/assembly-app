/** The topics the app teaches, in the order the header lists them. */
export const TOPIC_CHOICES = [
  { id: 'cpu', label: 'CPU', name: 'the CPU' },
  { id: 'logic', label: 'Logic', name: 'digital logic' }
] as const;

export type TopicId = (typeof TOPIC_CHOICES)[number]['id'];

export function isTopicId(value: unknown): value is TopicId {
  return TOPIC_CHOICES.some((choice) => choice.id === value);
}
