import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from './storageKeys';
import { readCollapsed } from './topicSections';

/** Which sections of the topics' sidebars are collapsed to their headers, remembered. */
export const useTopicSections = createGlobalState(() => {
  const collapsed = useLocalStorage<string[]>(STORAGE_KEYS.topicSections, [], {
    serializer: { read: readCollapsed, write: (value) => JSON.stringify(value) }
  });

  function isCollapsed(key: string): boolean {
    return collapsed.value.includes(key);
  }

  function toggle(key: string): void {
    collapsed.value = isCollapsed(key)
      ? collapsed.value.filter((each) => each !== key)
      : [...collapsed.value, key];
  }

  return { isCollapsed, toggle };
});
