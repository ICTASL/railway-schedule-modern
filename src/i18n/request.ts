import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import english from '../../messages/en.json';
import { routing } from './routing';

type Messages = typeof english;

/** Fill any key missing from a translation with its English text (the legacy app did the same). */
function withEnglishFallback(base: Messages, override: Record<string, unknown>): Messages {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = merged[key];
    merged[key] =
      value && typeof value === 'object' && !Array.isArray(value) && existing && typeof existing === 'object'
        ? withEnglishFallback(existing as Messages, value as Record<string, unknown>)
        : value;
  }
  return merged as Messages;
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const translated = (await import(`../../messages/${locale}.json`)).default as Record<string, unknown>;
  return { locale, messages: locale === 'en' ? english : withEnglishFallback(english, translated) };
});
