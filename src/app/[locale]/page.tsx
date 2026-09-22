import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Help } from '@/components/HelpContent';
import { PageShell } from '@/components/PageShell';
import { SearchForm } from '@/components/SearchForm';
import { ShareLinks } from '@/components/ShareLinks';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { todayInSriLanka } from '@/lib/dates';
import { getStations } from '@/lib/db/queries';
import type { Station } from '@/lib/types';
import { embedQuery, firstParam, isEmbedded } from '@/lib/site';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HomePage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = await searchParams;
  const embedded = isEmbedded(query);
  const t = await getTranslations('search');

  let stations: Station[] | null = null;
  try {
    stations = await getStations(locale);
  } catch (error) {
    console.error('[home] could not load stations', error);
  }

  return (
    <PageShell embedded={embedded}>
      <div className="title-row">
        <h1>{t('title')}</h1>
        <Help />
      </div>
      {stations ? (
        <SearchForm
          locale={locale}
          stations={stations}
          today={todayInSriLanka()}
          embedded={embedded}
          // Coming back from a result keeps what the person searched for.
          defaults={{
            from: firstParam(query, 'from') ?? '',
            to: firstParam(query, 'to') ?? '',
            date: firstParam(query, 'date') ?? '',
            start: firstParam(query, 'start') ?? '',
            end: firstParam(query, 'end') ?? '',
          }}
        />
      ) : (
        <ErrorNotice retryHref={{ pathname: '/', query: embedQuery(embedded) }} />
      )}
      <ShareLinks />
    </PageShell>
  );
}

async function ErrorNotice({ retryHref }: { retryHref: React.ComponentProps<typeof Link>['href'] }) {
  const t = await getTranslations('error');
  return (
    <div className="notice notice--error" role="alert">
      <p>{t('system')}</p>
      <Link href={retryHref}>{t('retry')}</Link>
    </div>
  );
}
