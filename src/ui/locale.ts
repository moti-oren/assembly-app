import { en, type Messages } from './messages/en';
import { he } from './messages/he';

/** The languages the interface can be shown in. */
export const LOCALES = ['en', 'he'] as const;

export type Locale = (typeof LOCALES)[number];

/** Each language's name in itself, as a switch to it is labelled whatever the interface shows. */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', he: 'עברית' };

const MESSAGES: Record<Locale, Messages> = { en, he };

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

/** Hebrew when the browser prefers it to English, English otherwise. */
export function defaultLocale(preferred: readonly string[]): Locale {
  for (const tag of preferred) {
    const language = tag.toLowerCase().split('-')[0];
    // `iw` is Hebrew's old code, which some browsers still report.
    if (language === 'he' || language === 'iw') return 'he';
    if (language === 'en') return 'en';
  }
  return 'en';
}

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
