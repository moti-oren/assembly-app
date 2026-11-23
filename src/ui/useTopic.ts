import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { analytics } from './analyticsClient';
import { STORAGE_KEYS } from './storageKeys';
import { isTopicId, type TopicId } from './topics';
import { usePreferences } from './usePreferences';

/** Which topic is on show. The header, the palette and the links between topics all change it. */
export const useTopic = createGlobalState(() => {
  const topic = useLocalStorage<TopicId>(STORAGE_KEYS.topic, 'cpu', {
    serializer: { read: (raw) => (isTopicId(raw) ? raw : 'cpu'), write: (id) => id }
  });

  /** Opens the circuit behind the last instruction of the CPU on show. */
  function showCircuit(): void {
    analytics.track({ name: 'circuit-opened', architecture: usePreferences().architecture.value });
    topic.value = 'logic';
  }

  /** Opens the last instruction of the CPU on show as arithmetic on numbers. */
  function showNumbers(): void {
    analytics.track({ name: 'numbers-opened', architecture: usePreferences().architecture.value });
    topic.value = 'numbers';
  }

  return { topic, showCircuit, showNumbers };
});
