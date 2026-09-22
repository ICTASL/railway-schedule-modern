import type { routing } from './i18n/routing';
import type messages from '../messages/en.json';

// Makes translation keys and their placeholders type-checked.
declare module 'next-intl' {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
