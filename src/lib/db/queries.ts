import 'server-only';
import type { RowDataPacket } from 'mysql2/promise';
import type { Locale } from '@/i18n/routing';
import type {
  ConnectingJourney,
  DirectTrain,
  JunctionSuggestion,
  Price,
  SearchOutcome,
  Station,
  TrainClass,
} from '../types';
import { description, stationName, trainName } from './lang';
import {
  matchChain,
  matchDirect,
  searchDayOf,
  trimSeconds,
  type ChainLeg,
  type Stop,
  type TimeWindow,
} from './logic';
import { getEnv } from '../env';
import { query } from './pool';

/*
 * Reads the railway CMS database. Tables used (read-only): tbl_stationdetail, tbl_trainline_station,
 * tbl_train, tbl_type, tbl_frequancy, tbl_frequency_date, tbl_date, tbl_train_timetable,
 * tbl_train_timetable_detail, tbl_train_class, tbl_classtype, tbl_train_connect_header/detail,
 * tbl_connecting_train, tbl_station_distance, tbl_station_price.
 * Never touched: tbl_users, tbl_user_perms, tbl_role_*, tbl_perm_data, ci_sessions.
 */

/** Station ids are positive integers. Anything else is a bug upstream and must never reach SQL. */
function stationId(value: string): number {
  const id = /^[0-9]{1,9}$/.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) throw new RangeError('Invalid station id');
  return id;
}

const STATUS_RESULT_FOUND = '2000';
const STATUS_NO_RESULT = '2001';

// ---------------------------------------------------------------- shared SQL

/**
 * A timetable is in force on `date` when it is published and not yet expired (`0000-00-00` means
 * "no expiry"; same rule as the CMS), its train is running (`IsOperation = 1`, "RUN"), is a
 * passenger type, and its frequency includes that weekday.
 * Requires aliases: tt (timetable), tr (train), ty (type).
 */
function activeTimetable(date: string): { sql: string; params: unknown[] } {
  const trainStates = getEnv().INCLUDE_CANCELED_TRAINS ? '1, 2' : '1';
  return {
    sql: `tt.Status = 1
      AND tt.PublishDate <= ?
      AND (tt.ExpireDate = '0000-00-00 00:00:00' OR tt.ExpireDate >= ?)
      AND tr.Status = 1 AND tr.IsOperation IN (${trainStates})
      AND ty.IsPassenger = 1
      AND EXISTS (SELECT 1 FROM tbl_frequency_date fd
                  JOIN tbl_date dd ON dd.DateID = fd.DateID
                  WHERE fd.FrequencyID = tr.FrequencyID AND dd.SearchDay = ?)`,
    params: [`${date} 23:59:59`, `${date} 00:00:00`, searchDayOf(date)],
  };
}

interface StopRow extends RowDataPacket {
  TTID: number;
  TTDetailID: number;
  StationID: number;
  stationName: string | null;
  ArrivalTime: string;
  DepatureTime: string;
  IsStop: number;
}

/** Stops of the given timetables in running order. */
async function loadStops(timetableIds: number[], lang: Locale): Promise<Map<number, Stop[]>> {
  const byTimetable = new Map<number, Stop[]>();
  if (timetableIds.length === 0) return byTimetable;
  const rows = await query<StopRow>(
    `SELECT d.TTID, d.TTDetailID, ls.StationID, ${stationName('s', lang)} AS stationName,
            d.ArrivalTime, d.DepatureTime, d.IsStop
       FROM tbl_train_timetable_detail d
       JOIN tbl_trainline_station ls ON ls.TLSID = d.TLSID
       LEFT JOIN tbl_stationdetail s ON s.StationID = ls.StationID
      WHERE d.TTID IN (?)
      ORDER BY d.TTID, d.TTDetailID`,
    [timetableIds],
  );
  for (const row of rows) {
    const list = byTimetable.get(row.TTID) ?? [];
    list.push({
      detailId: row.TTDetailID,
      stationId: row.StationID,
      stationName: row.stationName ?? '',
      arrival: row.ArrivalTime,
      departure: row.DepatureTime,
      isStop: row.IsStop === 1,
    });
    byTimetable.set(row.TTID, list);
  }
  return byTimetable;
}

interface ClassRow extends RowDataPacket {
  TrainID: number;
  ClassTypeID: number;
  name: string;
}

async function loadClasses(trainIds: number[], lang: Locale): Promise<Map<number, TrainClass[]>> {
  const byTrain = new Map<number, TrainClass[]>();
  if (trainIds.length === 0) return byTrain;
  const rows = await query<ClassRow>(
    `SELECT tc.TrainID, ct.ClassTypeID, ${description('ct', lang)} AS name
       FROM tbl_train_class tc
       JOIN tbl_classtype ct ON ct.ClassTypeID = tc.ClassTypeID AND ct.Status = 1
      WHERE tc.Status = 1 AND tc.TrainID IN (?)
      ORDER BY ct.ClassTypeID`,
    [trainIds],
  );
  for (const row of rows) {
    const list = byTrain.get(row.TrainID) ?? [];
    list.push({ id: String(row.ClassTypeID), name: row.name });
    byTrain.set(row.TrainID, list);
  }
  return byTrain;
}

// ------------------------------------------------------------------ stations

interface StationRow extends RowDataPacket {
  StationID: number;
  StationCode: string | null;
  name: string | null;
}

const STATION_TTL_MS = 60 * 60 * 1000;
const stationCache = new Map<Locale, { at: number; stations: Station[] }>();

/** Active stations, alphabetical in the chosen language. Cached for an hour (they rarely change). */
export async function getStations(lang: Locale): Promise<Station[]> {
  const hit = stationCache.get(lang);
  if (hit && Date.now() - hit.at < STATION_TTL_MS) return hit.stations;

  const rows = await query<StationRow>(
    `SELECT s.StationID, s.StationCode, ${stationName('s', lang)} AS name
       FROM tbl_stationdetail s
      WHERE s.Status = 1
      ORDER BY name`,
  );
  const stations = rows
    .filter((row) => (row.name ?? '').trim() !== '')
    .map((row) => ({ id: String(row.StationID), code: row.StationCode ?? '', name: row.name!.trim() }));
  stationCache.set(lang, { at: Date.now(), stations });
  return stations;
}

interface JunctionRow extends RowDataPacket {
  fromName: string;
  junctionName: string;
  toName: string;
}

/** Curated "change here" hint for a station pair (tbl_connecting_train). */
export async function getConnectingSuggestion(
  fromId: string,
  toId: string,
  lang: Locale,
): Promise<JunctionSuggestion | null> {
  const [row] = await query<JunctionRow>(
    `SELECT ${stationName('f', lang)} AS fromName, ${stationName('j', lang)} AS junctionName,
            ${stationName('t', lang)} AS toName
       FROM tbl_connecting_train ct
       JOIN tbl_stationdetail f ON f.StationID = ct.FromStID
       JOIN tbl_stationdetail j ON j.StationID = ct.JunctionID
       JOIN tbl_stationdetail t ON t.StationID = ct.ToStID
      WHERE ct.FromStID = ? AND ct.ToStID = ? AND ct.Status = 1
      LIMIT 1`,
    [stationId(fromId), stationId(toId)],
  );
  return row
    ? { fromStation: row.fromName, junctionStation: row.junctionName, toStation: row.toName }
    : null;
}

// -------------------------------------------------------------------- prices

interface PriceRow extends RowDataPacket {
  StDisID: number;
  ClassTypeID: number;
  TPrice: number | null;
  className: string;
}

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const distance = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false });

interface DistanceRow extends RowDataPacket {
  StDisID: number;
  FromStID: number;
  TDistance: number | null;
}

const PRICE_TTL_MS = 10 * 60 * 1000;
const PRICE_CACHE_MAX = 500;
const priceCache = new Map<string, { at: number; prices: Price[] }>();

/** Fares per class and the distance between two stations. Like the CMS, the pair is matched in either direction. */
export async function getPrices(fromId: string, toId: string, lang: Locale): Promise<Price[]> {
  const key = `${fromId}:${toId}:${lang}`;
  const hit = priceCache.get(key);
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.prices;

  const from = stationId(fromId);
  const to = stationId(toId);
  // Two plain lookups: the price table has no index on the distance id, so joining it to
  // every distance row would be far slower than filtering it once.
  const distances = await query<DistanceRow>(
    `SELECT StDisID, FromStID, TDistance FROM tbl_station_distance
      WHERE (FromStID = ? AND ToStID = ?) OR (FromStID = ? AND ToStID = ?)`,
    [from, to, to, from],
  );
  if (distances.length === 0) return [];
  // Prefer the from -> to record when both directions exist.
  distances.sort((a, b) => Number(b.FromStID === from) - Number(a.FromStID === from));

  const rows = await query<PriceRow>(
    `SELECT p.StDisID, p.ClassTypeID, p.TPrice, ${description('ct', lang)} AS className
       FROM tbl_station_price p
       JOIN tbl_classtype ct ON ct.ClassTypeID = p.ClassTypeID AND ct.Status = 1
      WHERE p.StDisID IN (?)
      ORDER BY p.ClassTypeID`,
    [distances.map((d) => d.StDisID)],
  );

  const seen = new Set<number>();
  const prices: Price[] = [];
  for (const distanceRow of distances) {
    for (const row of rows.filter((r) => r.StDisID === distanceRow.StDisID)) {
      if (seen.has(row.ClassTypeID) || row.TPrice === null) continue;
      seen.add(row.ClassTypeID);
      prices.push({
        className: row.className,
        distanceKm: distanceRow.TDistance === null ? '' : distance.format(distanceRow.TDistance),
        priceLkr: money.format(row.TPrice),
      });
    }
  }
  if (priceCache.size >= PRICE_CACHE_MAX) priceCache.clear();
  priceCache.set(key, { at: Date.now(), prices });
  return prices;
}

// -------------------------------------------------------------------- search

interface TimetableIdRow extends RowDataPacket {
  TTID: number;
}

interface CandidateRow extends RowDataPacket {
  TTID: number;
  TrainID: number;
  TrainNo: number | null;
  trainName: string | null;
  typeName: string | null;
  frequencyName: string | null;
  frequencyShort: string | null;
}

async function findDirectTrains(
  fromId: number,
  toId: number,
  date: string,
  window: TimeWindow,
  lang: Locale,
): Promise<DirectTrain[]> {
  const active = activeTimetable(date);
  // Step 1: everything that runs on this date. Step 2: timetables that stop at the boarding station.
  // Joining the two in SQL made MySQL pick a very slow plan, so they are intersected here instead.
  const [running, atStation] = await Promise.all([
    query<CandidateRow>(
      `SELECT tt.TTID, tr.TrainID, tr.TrainNo, ${trainName('tr', lang)} AS trainName,
              ${description('ty', lang)} AS typeName,
              ${description('fq', lang)} AS frequencyName, fq.ShortName AS frequencyShort
         FROM tbl_train_timetable tt
         JOIN tbl_train tr ON tr.TrainID = tt.TrainID
         JOIN tbl_type ty ON ty.TypeID = tr.TypeID
         LEFT JOIN tbl_frequancy fq ON fq.FrequencyID = tr.FrequencyID
        WHERE ${active.sql}`,
      active.params,
    ),
    query<TimetableIdRow>(
      `SELECT DISTINCT d.TTID
         FROM tbl_trainline_station ls
         JOIN tbl_train_timetable_detail d ON d.TLSID = ls.TLSID AND d.IsStop = 1
        WHERE ls.StationID = ?`,
      [fromId],
    ),
  ]);
  const stopsHere = new Set(atStation.map((row) => row.TTID));
  const candidates = running.filter((row) => stopsHere.has(row.TTID));

  const stops = await loadStops(
    candidates.map((c) => c.TTID),
    lang,
  );
  const matched = candidates.flatMap((candidate) => {
    const match = matchDirect(stops.get(candidate.TTID) ?? [], fromId, toId, window);
    return match ? [{ candidate, match }] : [];
  });
  const classes = await loadClasses([...new Set(matched.map((m) => m.candidate.TrainID))], lang);

  return matched
    .sort((a, b) => a.match.board.departure.localeCompare(b.match.board.departure))
    .map(({ candidate, match }) => ({
      id: String(candidate.TrainID),
      number: candidate.TrainNo === null ? '' : String(candidate.TrainNo),
      name: (candidate.trainName ?? '').trim(),
      type: candidate.typeName ?? '',
      frequency: (candidate.frequencyName ?? '').trim() || (candidate.frequencyShort ?? ''),
      startStation: match.board.stationName,
      arrivalTime: trimSeconds(match.board.arrival),
      departureTime: trimSeconds(match.board.departure),
      finalStation: match.last.stationName,
      arrivalTimeAtFinalStation: trimSeconds(match.last.arrival),
      endStation: match.alight.stationName,
      arrivalTimeAtEndStation: trimSeconds(match.alight.arrival),
      classes: classes.get(candidate.TrainID) ?? [],
    }));
}

interface ConTidRow extends RowDataPacket {
  ConTID: number;
}

interface ChainRow extends RowDataPacket {
  ConTID: number;
  TTID: number;
  IsTransit: number | null;
  TrainID: number | null;
  TrainNo: number | null;
  trainName: string | null;
  isActive: number;
}

/** Connection chains (tbl_train_connect_*) that mention `stationId` as a stopping point. */
async function chainsThrough(stationId: number): Promise<Set<number>> {
  const rows = await query<ConTidRow>(
    `SELECT DISTINCT cd.ConTID
       FROM tbl_trainline_station ls
       JOIN tbl_train_timetable_detail d ON d.TLSID = ls.TLSID AND d.IsStop = 1
       JOIN tbl_train_connect_detail cd ON cd.TTID = d.TTID
      WHERE ls.StationID = ?`,
    [stationId],
  );
  return new Set(rows.map((r) => r.ConTID));
}

async function findConnectingJourneys(
  fromId: number,
  toId: number,
  date: string,
  window: TimeWindow,
  lang: Locale,
): Promise<ConnectingJourney[]> {
  const [throughFrom, throughTo] = await Promise.all([chainsThrough(fromId), chainsThrough(toId)]);
  const conTids = [...throughFrom].filter((id) => throughTo.has(id));
  if (conTids.length === 0) return [];

  const active = activeTimetable(date);
  const legRows = await query<ChainRow>(
    `SELECT cd.ConTID, cd.TTID, cd.IsTransit, tr.TrainID, tr.TrainNo, ${trainName('tr', lang)} AS trainName,
            CASE WHEN ${active.sql} THEN 1 ELSE 0 END AS isActive
       FROM tbl_train_connect_detail cd
       LEFT JOIN tbl_train_timetable tt ON tt.TTID = cd.TTID
       LEFT JOIN tbl_train tr ON tr.TrainID = tt.TrainID
       LEFT JOIN tbl_type ty ON ty.TypeID = tr.TypeID
      WHERE cd.ConTID IN (?)
      ORDER BY cd.ConTID, cd.ConTDID`,
    [...active.params, conTids],
  );

  // A chain only works on days when every one of its legs runs.
  const legsByChain = new Map<number, ChainRow[]>();
  for (const row of legRows) legsByChain.set(row.ConTID, [...(legsByChain.get(row.ConTID) ?? []), row]);
  const runnable = [...legsByChain.values()].filter(
    (legs) => legs.length >= 2 && legs.every((leg) => leg.isActive === 1 && leg.TrainID !== null),
  );

  const stops = await loadStops(
    [...new Set(runnable.flatMap((legs) => legs.map((leg) => leg.TTID)))],
    lang,
  );
  const journeys: { board: Stop; journey: ReturnType<typeof matchChain> }[] = [];
  const seen = new Set<string>();
  for (const legs of runnable) {
    const chain: ChainLeg[] = legs.map((leg) => ({
      timetableId: leg.TTID,
      trainId: leg.TrainID!,
      trainNo: leg.TrainNo === null ? '' : String(leg.TrainNo),
      trainName: (leg.trainName ?? '').trim(),
      isTransit: leg.IsTransit === 1,
      stops: stops.get(leg.TTID) ?? [],
    }));
    const match = matchChain(chain, fromId, toId, window);
    if (!match) continue;
    const key = match.legs.map((leg) => `${leg.timetableId}@${leg.startTime}`).join('>');
    if (seen.has(key)) continue; // the same ride can be defined by more than one chain
    seen.add(key);
    journeys.push({ board: match.board, journey: match });
  }

  const classes = await loadClasses(
    [...new Set(journeys.flatMap((j) => j.journey!.legs.map((leg) => leg.trainId)))],
    lang,
  );
  return journeys
    .sort((a, b) => a.board.departure.localeCompare(b.board.departure))
    .map(({ journey }) => ({
      startStation: journey!.board.stationName,
      startArrivalTime: trimSeconds(journey!.board.arrival),
      startDepartureTime: trimSeconds(journey!.board.departure),
      endStation: journey!.alight.stationName,
      endArrivalTime: trimSeconds(journey!.alight.arrival),
      legs: journey!.legs.map((leg) => ({
        trainNumber: leg.trainNo,
        trainName: leg.trainName,
        startStation: leg.startStation,
        startTime: trimSeconds(leg.startTime),
        endStation: leg.endStation,
        endTime: trimSeconds(leg.endTime),
        isTransit: leg.isTransit,
        classes: classes.get(leg.trainId) ?? [],
      })),
    }));
}

interface NameRow extends RowDataPacket {
  StationID: number;
  name: string | null;
}

export async function searchTrains(
  criteria: { from: string; to: string; date: string; start: string; end: string },
  lang: Locale,
): Promise<SearchOutcome> {
  const fromId = stationId(criteria.from);
  const toId = stationId(criteria.to);
  const window: TimeWindow = { start: criteria.start, end: criteria.end };

  const [directTrains, connectingJourneys, names] = await Promise.all([
    findDirectTrains(fromId, toId, criteria.date, window, lang),
    findConnectingJourneys(fromId, toId, criteria.date, window, lang),
    query<NameRow>(
      `SELECT s.StationID, ${stationName('s', lang)} AS name FROM tbl_stationdetail s WHERE s.StationID IN (?)`,
      [[fromId, toId]],
    ),
  ]);
  const nameOf = (id: number) => names.find((n) => n.StationID === id)?.name?.trim() ?? '';

  const total = directTrains.length + connectingJourneys.length;
  return {
    query: {
      startStation: nameOf(fromId),
      endStation: nameOf(toId),
      date: criteria.date,
      startTime: criteria.start,
      endTime: criteria.end,
    },
    statusCode: total > 0 ? STATUS_RESULT_FOUND : STATUS_NO_RESULT,
    resultCount: String(total),
    directTrains,
    connectingJourneys,
  };
}
