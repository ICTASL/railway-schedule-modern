import type { Locale } from '@/i18n/routing';

/**
 * The schema keeps one column per language. These names are spliced into SQL, so they come only
 * from this fixed table, never from request data.
 */
const COLUMNS = {
  en: { station: 'StationNameEng', description: 'DescriptionEng', train: 'TrainNameEnglish' },
  si: { station: 'StationNameSin', description: 'DescriptionSin', train: 'TrainNameSinhala' },
  ta: { station: 'StationNameTam', description: 'DescriptionTam', train: 'TrainNameTamil' },
} as const satisfies Record<Locale, { station: string; description: string; train: string }>;

const ENGLISH = COLUMNS.en;

/** `alias.column` in the requested language, falling back to English when the translation is blank. */
function localized(alias: string, kind: keyof typeof ENGLISH, lang: Locale): string {
  const table = COLUMNS[lang];
  if (!table) throw new Error(`Unsupported language: ${String(lang)}`);
  const wanted = `${alias}.${table[kind]}`;
  const fallback = `${alias}.${ENGLISH[kind]}`;
  return lang === 'en' ? fallback : `COALESCE(NULLIF(TRIM(${wanted}), ''), ${fallback})`;
}

export const stationName = (alias: string, lang: Locale) => localized(alias, 'station', lang);
export const description = (alias: string, lang: Locale) => localized(alias, 'description', lang);
export const trainName = (alias: string, lang: Locale) => localized(alias, 'train', lang);
