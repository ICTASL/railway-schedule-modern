import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Help } from '@/components/HelpContent';
import { PageShell } from '@/components/PageShell';
import { ResultsView } from '@/components/ResultsView';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { embedQuery, firstParam, isEmbedded } from '@/lib/site';
import { runSearch, type SearchReport } from '@/lib/search';
import { validateSearch, type ValidationCode } from '@/lib/validation';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ResultsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const query = await searchParams;
  const embedded = isEmbedded(query);
  const tSearch = await getTranslations('search');
  const tResult = await getTranslations('result');
  const tError = await getTranslations('error');

  const input = {
    from: firstParam(query, 'from'),
    to: firstParam(query, 'to'),
    date: firstParam(query, 'date'),
    start: firstParam(query, 'start'),
    end: firstParam(query, 'end'),
  };
  const validation = validateSearch(input);

  // Back to the form, keeping what was typed and the embedded layout.
  const backHref = {
    pathname: '/' as const,
    query: {
      ...embedQuery(embedded),
      ...Object.fromEntries(Object.entries(input).filter(([, value]) => value)),
    },
  };

  let body: React.ReactNode;
  if (!validation.ok) {
    // Reached without JavaScript, or through a hand-edited link.
    const codes = [...new Set(Object.values(validation.errors))] as ValidationCode[];
    body = (
      <div className="notice notice--error" role="alert">
        <ul>
          {codes.map((code) => (
            <li key={code}>{tSearch(`errors.${code}`)}</li>
          ))}
        </ul>
      </div>
    );
  } else {
    let report: SearchReport | null = null;
    try {
      report = await runSearch(validation.criteria, locale);
    } catch (error) {
      console.error('[results] search failed', error);
    }
    body = report ? (
      <ResultsView report={report} criteria={validation.criteria} />
    ) : (
      <div className="notice notice--error" role="alert">
        <p>{tError('system')}</p>
      </div>
    );
  }

  return (
    <PageShell embedded={embedded}>
      <div className="title-row">
        <h1>{tSearch('title')}</h1>
        <Help />
      </div>
      <p>
        <Link href={backHref} className="button">
          {tResult('back')}
        </Link>
      </p>
      {body}
    </PageShell>
  );
}
