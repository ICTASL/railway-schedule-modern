import { describe, expect, it } from 'vitest';
import { formatDisplayDate, isValidIsoDate, todayInSriLanka } from '@/lib/dates';
import { END_TIME_SLOTS, START_TIME_SLOTS } from '@/lib/times';
import { validateSearch } from '@/lib/validation';

const TODAY = '2026-09-22';

describe('validateSearch (rules carried over from the legacy form)', () => {
  it('accepts stations only, defaulting the date to today and the times to the whole day', () => {
    const result = validateSearch({ from: '1', to: '2' }, TODAY);
    expect(result).toEqual({
      ok: true,
      criteria: { from: '1', to: '2', date: TODAY, start: '00:00:00', end: '23:59:59' },
    });
  });

  it('treats empty strings like missing values', () => {
    const result = validateSearch({ from: '1', to: '2', date: '', start: '', end: '' }, TODAY);
    expect(result.ok).toBe(true);
  });

  it('requires both stations', () => {
    const result = validateSearch({ from: '', to: '' }, TODAY);
    expect(result).toEqual({
      ok: false,
      errors: { from: 'startStationNotSelected', to: 'endStationNotSelected' },
    });
  });

  it('rejects identical stations on both fields', () => {
    const result = validateSearch({ from: '7', to: '7' }, TODAY);
    expect(result).toEqual({ ok: false, errors: { from: 'sameStation', to: 'sameStation' } });
  });

  it('rejects a start time that is not before the end time (equal counts, as before)', () => {
    const later = validateSearch({ from: '1', to: '2', start: '10:00:00', end: '09:30:00' }, TODAY);
    const equal = validateSearch({ from: '1', to: '2', start: '10:00:00', end: '10:00:00' }, TODAY);
    for (const result of [later, equal]) {
      expect(result).toEqual({
        ok: false,
        errors: { start: 'startNotBeforeEnd', end: 'startNotBeforeEnd' },
      });
    }
  });

  it('accepts a valid time window', () => {
    const result = validateSearch({ from: '1', to: '2', start: '06:00:00', end: '12:30:00' }, TODAY);
    expect(result.ok).toBe(true);
  });
});

describe('validateSearch (hardening the legacy app lacked)', () => {
  it.each(['abc', '1 OR 1=1', '../etc/passwd', '1&startStationID=2', '12345678901', '-1'])(
    'rejects the station id %j so it never reaches a backend URL',
    (value) => {
      const result = validateSearch({ from: value, to: '2' }, TODAY);
      expect(result.ok).toBe(false);
    },
  );

  it.each(['2026-02-31', '22/09/2026', '2026-9-2', 'tomorrow', '2026-13-01'])('rejects the date %j', (date) => {
    const result = validateSearch({ from: '1', to: '2', date }, TODAY);
    expect(result).toEqual({ ok: false, errors: { date: 'invalidDate' } });
  });

  it('rejects times that are not offered in the pickers', () => {
    const result = validateSearch({ from: '1', to: '2', start: '06:15:00', end: '25:00:00' }, TODAY);
    expect(result).toEqual({ ok: false, errors: { start: 'invalidTime', end: 'invalidTime' } });
  });
});

describe('time pickers', () => {
  it('offers half-hour steps, with 23:59:59 only as an end time and 00:00:00 only as a start time', () => {
    expect(START_TIME_SLOTS[0]).toBe('00:00:00');
    expect(START_TIME_SLOTS.at(-1)).toBe('23:30:00');
    expect(START_TIME_SLOTS).toHaveLength(48);
    expect(END_TIME_SLOTS[0]).toBe('00:30:00');
    expect(END_TIME_SLOTS.at(-1)).toBe('23:59:59');
    expect(END_TIME_SLOTS).toHaveLength(48);
  });
});

describe('dates', () => {
  it('validates real calendar dates', () => {
    expect(isValidIsoDate('2028-02-29')).toBe(true);
    expect(isValidIsoDate('2027-02-29')).toBe(false);
  });

  it('formats for display the way the legacy app did', () => {
    expect(formatDisplayDate('2026-09-22')).toBe('22/09/2026');
    expect(formatDisplayDate('not a date')).toBe('not a date');
  });

  it('computes today in Sri Lanka, not in UTC', () => {
    // 20:00 UTC on 21 Sep is already 01:30 on 22 Sep in Colombo (UTC+5:30).
    expect(todayInSriLanka(new Date('2026-09-21T20:00:00Z'))).toBe('2026-09-22');
    expect(todayInSriLanka(new Date('2026-09-21T10:00:00Z'))).toBe('2026-09-21');
  });
});
