import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main id="main" className="content">
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <p>
        <Link href="/" className="button">
          {t('error.backToSearch')}
        </Link>
      </p>
    </main>
  );
}
