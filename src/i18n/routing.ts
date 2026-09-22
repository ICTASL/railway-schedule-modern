import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'si', 'ta'],
  defaultLocale: 'en',
  // Same as the legacy app: English unless the URL says otherwise. No language cookie is set.
  localeDetection: false,
  localeCookie: false,
});

export type Locale = (typeof routing.locales)[number];

/** Names shown in the language switcher, written in their own language. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  si: 'සිංහල',
  ta: 'தமிழ்',
};
