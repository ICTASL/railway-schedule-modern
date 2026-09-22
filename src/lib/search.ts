import 'server-only';
import type { Locale } from '@/i18n/routing';
import { getConnectingSuggestion, getPrices, searchTrains } from './db/queries';
import type { JunctionSuggestion, Price, SearchOutcome } from './types';
import type { SearchCriteria } from './validation';

/** Backend status codes carried on a search reply. */
const STATUS_NO_RESULT = '2001';

export interface SearchReport {
  outcome: SearchOutcome;
  /** When nothing runs directly, a junction the traveller could change at. */
  suggestion: JunctionSuggestion | null;
  prices: Price[];
  /** e.g. `123 km`, taken from the first price row. */
  totalDistance: string | null;
}

/**
 * Runs a full enquiry, following the legacy flow:
 *   1. search direct and connecting trains;
 *   2. if the backend found nothing, look for a junction to change at;
 *   3. if there is any train, fetch ticket prices and the total distance.
 */
export async function runSearch(criteria: SearchCriteria, lang: Locale): Promise<SearchReport> {
  const outcome = await searchTrains(criteria, lang);

  let suggestion: JunctionSuggestion | null = null;
  if (outcome.statusCode === STATUS_NO_RESULT) {
    suggestion = await getConnectingSuggestion(criteria.from, criteria.to, lang).catch((error) => {
      // The hint is a nicety; its failure must not hide the "no trains" answer.
      console.error('[search] connecting-train hint failed', error);
      return null;
    });
  }

  let prices: Price[] = [];
  if (outcome.directTrains.length > 0 || outcome.connectingJourneys.length > 0) {
    prices = await getPrices(criteria.from, criteria.to, lang).catch((error) => {
      // Timetable still useful without fares.
      console.error('[search] price lookup failed', error);
      return [];
    });
  }

  const distance = prices[0]?.distanceKm;
  return { outcome, suggestion, prices, totalDistance: distance ? `${distance} km` : null };
}
