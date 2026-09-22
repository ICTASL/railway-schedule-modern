import { describe, expect, it } from 'vitest';
import { matchChain, matchDirect, searchDayOf, trimSeconds, type ChainLeg, type Stop } from '@/lib/db/logic';

let nextId = 1;
const stop = (stationId: number, arrival: string, departure: string, isStop = true): Stop => ({
  detailId: nextId++,
  stationId,
  stationName: `S${stationId}`,
  arrival,
  departure,
  isStop,
});
const ALL_DAY = { start: '00:00:00', end: '23:59:59' };

describe('matchDirect', () => {
  const run = [stop(1, '06:00:00', '06:05:00'), stop(2, '07:00:00', '07:02:00'), stop(3, '08:00:00', '08:00:00')];

  it('boards at the first station and alights later, reporting where the train ends', () => {
    const m = matchDirect(run, 1, 2, ALL_DAY)!;
    expect(m.board.stationName).toBe('S1');
    expect(m.alight.arrival).toBe('07:00:00');
    expect(m.last.stationName).toBe('S3');
  });

  it('does not run backwards: a train from 1 to 3 cannot take you from 3 to 1', () => {
    expect(matchDirect(run, 3, 1, ALL_DAY)).toBeNull();
  });

  it('cannot board or alight where the train does not stop', () => {
    const passesThrough = [
      stop(1, '06:00:00', '06:00:00'),
      stop(2, '07:00:00', '07:00:00', false),
      stop(3, '08:00:00', '08:00:00'),
    ];
    expect(matchDirect(passesThrough, 1, 2, ALL_DAY)).toBeNull();
    expect(matchDirect(passesThrough, 2, 3, ALL_DAY)).toBeNull();
    expect(matchDirect(passesThrough, 1, 3, ALL_DAY)).not.toBeNull();
  });

  it('applies the time window to the departure from the boarding station, inclusive', () => {
    expect(matchDirect(run, 1, 3, { start: '06:05:00', end: '06:05:00' })).not.toBeNull();
    expect(matchDirect(run, 1, 3, { start: '06:06:00', end: '12:00:00' })).toBeNull();
    expect(matchDirect(run, 1, 3, { start: '00:00:00', end: '06:04:59' })).toBeNull();
  });

  it('handles a station listed twice (junction on two lines) by taking a later stop', () => {
    const twice = [
      stop(1, '06:00:00', '06:00:00'),
      stop(9, '06:30:00', '06:35:00'),
      stop(9, '06:35:00', '06:40:00'),
      stop(4, '07:00:00', '07:00:00'),
    ];
    expect(matchDirect(twice, 9, 4, ALL_DAY)!.board.departure).toBe('06:35:00');
  });

  it('copes with empty timetables and trains running past midnight', () => {
    expect(matchDirect([], 1, 2, ALL_DAY)).toBeNull();
    const night = [stop(1, '23:00:00', '23:10:00'), stop(2, '24:20:00', '24:25:00')];
    expect(matchDirect(night, 1, 2, ALL_DAY)!.alight.arrival).toBe('24:20:00');
  });
});

describe('matchChain', () => {
  const leg = (id: number, stops: Stop[], isTransit = false): ChainLeg => ({
    timetableId: id,
    trainId: id * 10,
    trainNo: String(1000 + id),
    trainName: `T${id}`,
    isTransit,
    stops,
  });
  // Train A: 1 -> 2 -> 5 (junction).  Train B: 5 -> 6 -> 7.
  const a = leg(1, [stop(1, '06:00:00', '06:00:00'), stop(2, '06:30:00', '06:31:00'), stop(5, '07:00:00', '07:00:00')], true);
  const b = leg(2, [stop(5, '07:20:00', '07:30:00'), stop(6, '08:00:00', '08:01:00'), stop(7, '08:30:00', '08:30:00')]);

  it('rides the first train to the transfer station and the second one on to the destination', () => {
    const m = matchChain([a, b], 1, 6, ALL_DAY)!;
    expect(m.board.stationName).toBe('S1');
    expect(m.alight.stationName).toBe('S6');
    expect(m.legs.map((l) => [l.startStation, l.startTime, l.endStation, l.endTime, l.isTransit])).toEqual([
      ['S1', '06:00:00', 'S5', '07:00:00', true],
      ['S5', '07:30:00', 'S6', '08:00:00', false],
    ]);
  });

  it('can board part-way along the first train', () => {
    const m = matchChain([a, b], 2, 7, ALL_DAY)!;
    expect(m.legs[0]).toMatchObject({ startStation: 'S2', startTime: '06:31:00', endStation: 'S5' });
  });

  it('is not a connection when one train already goes all the way (that is a direct train)', () => {
    expect(matchChain([a, b], 1, 5, ALL_DAY)).toBeNull();
  });

  it('never runs the chain backwards and respects the time window', () => {
    expect(matchChain([a, b], 6, 1, ALL_DAY)).toBeNull();
    expect(matchChain([a, b], 1, 6, { start: '06:30:00', end: '23:00:00' })).toBeNull();
  });

  it('does not board at the last stop of a leg', () => {
    // Station 5 is where train A ends; boarding there means using train B alone (a direct trip).
    expect(matchChain([a, b], 5, 7, ALL_DAY)).toBeNull();
  });

  it('lists every leg of a three-train chain', () => {
    const b2 = leg(2, b.stops as Stop[], true);
    const c = leg(3, [stop(7, '08:45:00', '08:50:00'), stop(8, '09:30:00', '09:30:00')]);
    const m = matchChain([a, b2, c], 1, 8, ALL_DAY)!;
    expect(m.legs.map((l) => l.trainNo)).toEqual(['1001', '1002', '1003']);
    expect(m.legs[1]).toMatchObject({ startStation: 'S5', endStation: 'S7' });
  });
});

describe('helpers', () => {
  it('trims seconds only from real times', () => {
    expect(trimSeconds('06:15:00')).toBe('06:15');
    expect(trimSeconds('24:20:00')).toBe('24:20');
    expect(trimSeconds('n/a')).toBe('n/a');
  });

  it('numbers weekdays like the CMS (1 = Sunday ... 7 = Saturday)', () => {
    expect(searchDayOf('2026-09-20')).toBe(1); // Sunday
    expect(searchDayOf('2026-09-21')).toBe(2); // Monday
    expect(searchDayOf('2026-09-26')).toBe(7); // Saturday
  });
});
