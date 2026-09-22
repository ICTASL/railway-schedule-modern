'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { Link } from '@/i18n/navigation';

/** Last-resort boundary for anything unexpected. Details stay in the server log, never on screen. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('error');
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="content">
      <h1>{t('title')}</h1>
      <div className="notice notice--error" role="alert">
        <p>{t('system')}</p>
      </div>
      <p className="actions">
        <button type="button" className="button button--primary" onClick={reset}>
          {t('retry')}
        </button>
        <Link href="/" className="button">
          {t('backToSearch')}
        </Link>
      </p>
    </main>
  );
}
