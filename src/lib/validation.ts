import { isValidIsoDate, todayInSriLanka } from './dates';
import {
  DEFAULT_END_TIME,
  DEFAULT_START_TIME,
  END_TIME_SLOTS,
  START_TIME_SLOTS,
} from './times';

/** Shared by the browser form and the server, so both enforce the same rules. */

export type ValidationCode =
  | 'startStationNotSelected'
  | 'endStationNotSelected'
  | 'sameStation'
  | 'startNotBeforeEnd'
  | 'invalidDate'
  | 'invalidTime';

export interface SearchInput {
  from?: string | null;
  to?: string | null;
  date?: string | null;
  start?: string | null;
  end?: string | null;
}

export interface SearchCriteria {
  from: string;
  to: string;
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm:ss */
  start: string;
  /** HH:mm:ss */
  end: string;
}

export type ValidationErrors = Partial<Record<'from' | 'to' | 'date' | 'start' | 'end', ValidationCode>>;

export type ValidationResult =
  | { ok: true; criteria: SearchCriteria }
  | { ok: false; errors: ValidationErrors };

/** Station IDs are numeric in the backend; anything else never reaches a URL. */
const STATION_ID = /^\d{1,9}$/;

const blank = (value: string | null | undefined): value is null | undefined | '' =>
  value === null || value === undefined || value.trim() === '';

export function validateSearch(input: SearchInput, today: string = todayInSriLanka()): ValidationResult {
  const errors: ValidationErrors = {};

  const from = input.from?.trim() ?? '';
  const to = input.to?.trim() ?? '';
  if (!STATION_ID.test(from)) errors.from = 'startStationNotSelected';
  if (!STATION_ID.test(to)) errors.to = 'endStationNotSelected';
  if (!errors.from && !errors.to && from === to) {
    errors.from = 'sameStation';
    errors.to = 'sameStation';
  }

  const date = blank(input.date) ? today : input.date.trim();
  if (!isValidIsoDate(date)) errors.date = 'invalidDate';

  const start = blank(input.start) ? DEFAULT_START_TIME : input.start.trim();
  const end = blank(input.end) ? DEFAULT_END_TIME : input.end.trim();
  if (!START_TIME_SLOTS.includes(start)) errors.start = 'invalidTime';
  if (!END_TIME_SLOTS.includes(end)) errors.end = 'invalidTime';
  // HH:mm:ss strings sort chronologically.
  if (!errors.start && !errors.end && start >= end) {
    errors.start = 'startNotBeforeEnd';
    errors.end = 'startNotBeforeEnd';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, criteria: { from, to, date, start, end } };
}
