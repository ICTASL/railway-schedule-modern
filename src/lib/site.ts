/**
 * The legacy app was shown inside the Lanka Gate country portal, which passed
 * `selectedTheme=countryportal` to hide this app's own header and footer.
 */
export const EMBED_PARAM = 'selectedTheme';
const EMBED_VALUE = 'countryportal';

type SearchParams = Record<string, string | string[] | undefined>;

export function firstParam(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export function isEmbedded(params: SearchParams): boolean {
  return firstParam(params, EMBED_PARAM) === EMBED_VALUE;
}

/** Query fragment that keeps the embedded layout when navigating. */
export function embedQuery(embedded: boolean): Record<string, string> {
  return embedded ? { [EMBED_PARAM]: EMBED_VALUE } : {};
}

/** Page shared by the social buttons (the portal entry for this service). */
export const SHARE_URL = 'https://cp.lankagate.gov.lk/services/slr/schedule';
export const RAILWAY_HOME_URL = 'https://www.railway.gov.lk/';
