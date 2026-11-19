import { computed, watchEffect } from 'vue';
import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { DIRECTIONS, defaultLocale, isLocale, messagesFor, type Locale } from './locale';
import { STORAGE_KEYS } from './storageKeys';

/** The interface language, remembered, and its texts. */
export const useLocale = createGlobalState(() => {
  const fallback = defaultLocale(navigator.languages ?? [navigator.language]);
  const locale = useLocalStorage<Locale>(STORAGE_KEYS.locale, fallback, {
    serializer: { read: (raw) => (isLocale(raw) ? raw : fallback), write: (value) => value }
  });
  /** The texts of the current language: `t.value.language.switch`. */
  const t = computed(() => messagesFor(locale.value));
  /** Which way the page runs: the layout mirrors for a right-to-left language. */
  const direction = computed(() => DIRECTIONS[locale.value]);

  // Screen readers, the browser's font choice and the layout all go by these two.
  watchEffect(() => {
    document.documentElement.lang = locale.value;
    document.documentElement.dir = direction.value;
  });

  function toggleLocale(): void {
    locale.value = locale.value === 'en' ? 'he' : 'en';
  }

  return { locale, direction, t, toggleLocale };
});
