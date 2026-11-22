import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { STORAGE_KEYS } from './storageKeys';
import { isTopicId, type TopicId } from './topics';

/** Which topic is on show. The header, the palette and the links between topics all change it. */
export const useTopic = createGlobalState(() => {
  const topic = useLocalStorage<TopicId>(STORAGE_KEYS.topic, 'cpu', {
    serializer: { read: (raw) => (isTopicId(raw) ? raw : 'cpu'), write: (id) => id }
  });

  /** Opens the circuit behind the last instruction of the CPU on show. */
  function showCircuit(): void {
    topic.value = 'logic';
  }

  return { topic, showCircuit };
});
