import { describe, expect, it } from 'vitest';
import { stationName } from '@/lib/db/lang';
import { getConnectingSuggestion, getPrices, getStations, searchTrains } from '@/lib/db/queries';

/**
 * Runs against the real railway database (DATABASE_URL in .env.local) and is skipped without one.
 * Assertions are about rules and invariants rather than exact timetable contents, because the
 * data is edited through the CMS. A few use well-known trains and will need updating if those
 * services change.
 */
describe.skipIf(!process.env.DATABASE_URL)('railway database', () => {
  const MONDAY = '2026-09-21';
  const TUESDAY = '2026-09-22';
  const WHOLE_DAY = { start: '00:00:00', end: '23:59:59' };

  async function ids() {
    const stations = await getStations('en');
    const id = (name: string) => stations.find((s) => s.name === name)!.id;
    return { fort: id('COLOMBO FORT'), galle: id('GALLE'), jaffna: id('JAFFNA'), kandy: id('KANDY') };
  }

  it('lists only active stations, in each language', async () => {
    const en = await getStations('en');
    expect(en.length).toBeGreaterThan(300);
    expect(new Set(en.map((s) => s.id)).size).toBe(en.length);
    for (const lang of ['si', 'ta'] as const) {
      const local = await getStations(lang);
      expect(local.length).toBe(en.length);
      expect(local.every((s) => s.name.trim() !== '')).toBe(true);
    }
    // The database also holds inactive duplicates of this station; only the active one is offered.
    expect(en.filter((s) => s.name === 'COLOMBO FORT').map((s) => s.id)).toEqual(['61']);
  });

  it('finds direct trains that respect the date, window and stop rules', async () => {
    const { fort, galle } = await ids();
    const result = await searchTrains({ from: fort, to: galle, date: MONDAY, ...WHOLE_DAY }, 'en');

    expect(result.statusCode).toBe('2000');
    expect(result.query).toMatchObject({ startStation: 'COLOMBO FORT', endStation: 'GALLE', date: MONDAY });
    expect(result.directTrains.length).toBeGreaterThan(0);
    for (const train of result.directTrains) {
      expect(train.startStation).toBe('COLOMBO FORT');
      expect(train.endStation).toBe('GALLE');
      expect(train.departureTime).toMatch(/^\d{2}:\d{2}$/);
      expect(train.number).not.toBe('');
      expect(train.classes.length).toBeGreaterThan(0);
    }
    const departures = result.directTrains.map((t) => t.departureTime);
    expect(departures).toEqual([...departures].sort());
  });

  it('applies the time window to the departure time', async () => {
    const { fort, galle } = await ids();
    const morning = await searchTrains({ from: fort, to: galle, date: MONDAY, start: '06:00:00', end: '09:00:00' }, 'en');
    expect(morning.directTrains.length).toBeGreaterThan(0);
    for (const t of morning.directTrains) {
      expect(t.departureTime >= '06:00' && t.departureTime <= '09:00').toBe(true);
    }
    const none = await searchTrains({ from: fort, to: galle, date: MONDAY, start: '03:31:00', end: '03:32:00' }, 'en');
    expect(none.statusCode).toBe('2001');
  });

  it('does not offer a train that only runs on other weekdays (Yal Devi 4077: Mon/Wed/Fri)', async () => {
    const { fort, jaffna } = await ids();
    const monday = await searchTrains({ from: fort, to: jaffna, date: MONDAY, ...WHOLE_DAY }, 'en');
    const tuesday = await searchTrains({ from: fort, to: jaffna, date: TUESDAY, ...WHOLE_DAY }, 'en');
    const has4077 = (r: typeof monday) => r.directTrains.some((t) => t.number === '4077');
    expect(has4077(monday)).toBe(true);
    expect(has4077(tuesday)).toBe(false);
  });

  it('answers in Sinhala and Tamil', async () => {
    const { fort, galle } = await ids();
    for (const lang of ['si', 'ta'] as const) {
      const r = await searchTrains({ from: fort, to: galle, date: MONDAY, ...WHOLE_DAY }, lang);
      expect(r.query.startStation).toMatch(lang === 'si' ? /[඀-෿]/ : /[஀-௿]/);
      expect(r.directTrains.length).toBeGreaterThan(0);
    }
  });

  it('never returns a train in the wrong direction, and handles unknown stations', async () => {
    const { galle, jaffna } = await ids();
    const r = await searchTrains({ from: galle, to: jaffna, date: MONDAY, ...WHOLE_DAY }, 'en');
    for (const t of r.directTrains) expect([t.startStation, t.endStation]).toEqual(['GALLE', 'JAFFNA']);
    const bogus = await searchTrains({ from: '999999', to: '1', date: MONDAY, ...WHOLE_DAY }, 'en');
    expect(bogus).toMatchObject({ statusCode: '2001', directTrains: [], connectingJourneys: [] });
  });

  it('returns fares for either direction of a pair, once per class, with the distance', async () => {
    const { fort, kandy } = await ids();
    const forward = await getPrices(fort, kandy, 'en');
    const reverse = await getPrices(kandy, fort, 'en');
    expect(forward.length).toBeGreaterThan(0);
    expect(new Set(forward.map((p) => p.className)).size).toBe(forward.length);
    expect(forward).toEqual(reverse);
    expect(Number(forward[0]!.distanceKm)).toBeGreaterThan(50);
    expect(forward[0]!.priceLkr).toMatch(/^\d{1,3}(,\d{3})*\.\d{2}$/);
    expect(await getPrices(fort, '999999', 'en')).toEqual([]);
  });

  it('suggests a junction from the curated list', async () => {
    const { kandy, jaffna } = await ids();
    expect(await getConnectingSuggestion(kandy, jaffna, 'en')).toEqual({
      fromStation: 'KANDY',
      junctionStation: 'POLGAHAWELA',
      toStation: 'JAFFNA',
    });
    // The curated list has the opposite direction too.
    expect(await getConnectingSuggestion(jaffna, kandy, 'en')).toEqual({
      fromStation: 'JAFFNA',
      junctionStation: 'POLGAHAWELA',
      toStation: 'KANDY',
    });
    expect(await getConnectingSuggestion(kandy, kandy, 'en')).toBeNull();
  });

  it('refuses anything but a plain station id, and a language outside the allow-list', async () => {
    const { fort } = await ids();
    for (const bad of ['1 OR 1=1', '1; DROP TABLE tbl_train', '', '-5', '0', '1.5', '99999999999']) {
      await expect(searchTrains({ from: fort, to: bad, date: MONDAY, ...WHOLE_DAY }, 'en')).rejects.toThrow(
        'Invalid station id',
      );
      await expect(getPrices(bad, fort, 'en')).rejects.toThrow('Invalid station id');
      await expect(getConnectingSuggestion(fort, bad, 'en')).rejects.toThrow('Invalid station id');
    }
    expect(() => stationName('s', "en'; DROP TABLE tbl_train;--" as never)).toThrow(/Unsupported language/);
  });
});
