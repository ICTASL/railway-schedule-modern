/** Timetables are read in Sri Lanka, so "today" must not depend on the server's or browser's zone. */
export const SRI_LANKA_TIME_ZONE = 'Asia/Colombo';

/** Today's date in Sri Lanka as `yyyy-MM-dd`. */
export function todayInSriLanka(now: Date = new Date()): string {
  // The `en-CA` locale formats dates as yyyy-MM-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SRI_LANKA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** True for a real calendar date written as `yyyy-MM-dd` (rejects `2026-02-31`). */
export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** `2026-09-22` -> `22/09/2026`, the format the legacy app showed users. Returns the input if it is not an ISO date. */
export function formatDisplayDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : isoDate;
}
