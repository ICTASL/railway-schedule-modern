'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Link, usePathname } from '@/i18n/navigation';
import { LOCALE_LABELS, routing, type Locale } from '@/i18n/routing';

/** Switches language while staying on the same page with the same search. */
export function LanguageSwitcher() {
  const t = useTranslations('common');
  const current = useLocale();
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const href = query ? `${pathname}?${query}` : pathname;

  return (
    <nav aria-label={t('language')} className="lang-switch">
      <ul>
        {routing.locales.map((locale: Locale) => (
          <li key={locale}>
            <Link
              href={href}
              locale={locale}
              lang={locale}
              hrefLang={locale}
              aria-current={locale === current ? 'true' : undefined}
            >
              {LOCALE_LABELS[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
