import type { LinkedTopic } from './topics';

/** One section of a topic's sidebar: what the learner sets, under a name of its own. */
export interface TopicSectionInfo {
  /** Its slot in the topic's workbench, and with the topic its name in storage. */
  id: string;
  label: string;
}

/** The section every topic's sidebar starts with: where what is on show came from. */
export const SOURCE_SECTION: TopicSectionInfo = { id: 'source', label: 'From the CPU' };

/** A section's name in storage: the sections of two topics may share an id. */
export function sectionKey(topic: LinkedTopic, id: string): string {
  return `${topic}.${id}`;
}

/** The collapsed sections as stored; anything unreadable in storage is no section. */
export function readCollapsed(raw: string): string[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.filter((key): key is string => typeof key === 'string'))];
}
