import { getTranslations } from 'next-intl/server';
import { HelpDialog } from './HelpDialog';

/** The help text (in the active language) inside its dialog. */
export async function Help() {
  const t = await getTranslations('help');
  const tCommon = await getTranslations('common');

  // Lists are stored as arrays of plain strings; `raw` returns them untouched.
  const lines = (key: 'intro' | 'steps' | 'direct.items' | 'prices.items') => t.raw(key) as string[];
  const [welcome, ...intro] = lines('intro');

  return (
    <HelpDialog title={t('title')} openLabel={t('open')} closeLabel={tCommon('close')}>
      <p>
        <strong>{welcome}</strong>
      </p>
      {intro.map((text) => (
        <p key={text}>{text}</p>
      ))}
      <p>
        <strong>{t('procedureTitle')}</strong>
      </p>
      <ul>
        {lines('steps').map((step) => (
          <li key={step}>{step}</li>
        ))}
        <li>
          {t('outputsIntro')}
          <ul>
            <li>
              {t('direct.title')}
              <ul>
                {lines('direct.items').map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
            <li>{t('connecting.title')}</li>
            <li>
              {t('prices.title')}
              <ul>
                {lines('prices.items').map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </li>
          </ul>
        </li>
      </ul>
      <p>{t('footer')}</p>
    </HelpDialog>
  );
}
