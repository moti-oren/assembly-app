import { computed, watchEffect } from 'vue';
import { createGlobalState, useLocalStorage } from '@vueuse/core';
import { defaultLocale, isLocale, messagesFor, type Locale } from './locale';
import { STORAGE_KEYS } from './storageKeys';

/** The interface language, remembered, and its texts. */
export const useLocale = createGlobalState(() => {
  const fallback = defaultLocale(navigator.languages ?? [navigator.language]);
  const locale = useLocalStorage<Locale>(STORAGE_KEYS.locale, fallback, {
    serializer: { read: (raw) => (isLocale(raw) ? raw : fallback), write: (value) => value }
  });
  const otherLocale = computed<Locale>(() => (locale.value === 'en' ? 'he' : 'en'));
  /** The texts of the current language: `t.value.language.switch`. */
  const t = computed(() => messagesFor(locale.value));

  // Screen readers and the browser's font choice go by the page's language.
  watchEffect(() => {
    document.documentElement.lang = locale.value;
  });

  function toggleLocale(): void {
    locale.value = otherLocale.value;
  }

  return { locale, otherLocale, t, toggleLocale };
});
