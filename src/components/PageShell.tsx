import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Suspense, type ReactNode } from 'react';
import { RAILWAY_HOME_URL } from '@/lib/site';
import { FontSizeControls } from './FontSizeControls';
import { LanguageSwitcher } from './LanguageSwitcher';

interface Props {
  /** Shown inside the country portal: no header or footer of its own. */
  embedded: boolean;
  children: ReactNode;
}

export async function PageShell({ embedded, children }: Props) {
  const t = await getTranslations();

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      {!embedded && (
        <header className="site-header">
          <div className="site-header__banner">
            <Image
              src="/images/railway-banner.jpg"
              alt={t('common.railwayBannerAlt')}
              fill
              priority
              sizes="100vw"
              style={{ objectFit: 'cover', objectPosition: 'left center' }}
            />
          </div>
          <div className="site-header__top">
            <a href="https://www.gov.lk/" target="_blank" rel="noopener noreferrer">
              <Image src="/images/gov.png" width={45} height={15} alt={t('common.govAlt')} />
            </a>
            <Suspense fallback={null}>
              <LanguageSwitcher />
            </Suspense>
            <FontSizeControls />
          </div>
          <div className="site-header__nav">
            <a href={RAILWAY_HOME_URL} target="_blank" rel="noopener noreferrer">
              {t('nav.slrHome')}
            </a>
          </div>
        </header>
      )}
      <main id="main" className="content">
        {children}
        <p className="powered-by">{t('common.copyright')}</p>
      </main>
      {!embedded && (
        <footer className="site-footer">
          <a href="http://gic.gov.lk/" target="_blank" rel="noopener noreferrer">
            <Image src="/images/gic_2.gif" width={129} height={46} alt={t('common.gicAlt')} />
          </a>
          <p>{t('common.copyrightNotice')}</p>
          <p>
            {t('common.developedWith')}{' '}
            <a href="https://www.icta.lk/" target="_blank" rel="noopener noreferrer">
              <Image src="/images/icta_logo.jpg" width={66} height={23} alt={t('common.ictaAlt')} />
            </a>
          </p>
        </footer>
      )}
    </div>
  );
}
