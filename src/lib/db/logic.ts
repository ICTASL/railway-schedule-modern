/**
 * Pure timetable rules (no database access), so they can be tested on their own.
 *
 * Model, as maintained by the railway CMS:
 *  - A timetable lists the stops of one train in running order (ordered by `detailId`).
 *  - A passenger can board or alight only at stops with `isStop`.
 *  - A "connection" is an ordered chain of timetables of different trains; each leg ends at the
 *    station where the next one starts.
 */

export interface Stop {
  /** Row id in `tbl_train_timetable_detail`; increases in running order. */
  detailId: number;
  stationId: number;
  stationName: string;
  /** `HH:MM:SS` (hours may reach 24 or more for services running past midnight). */
  arrival: string;
  departure: string;
  isStop: boolean;
}

export interface TimeWindow {
  /** `HH:MM:SS`, inclusive. Applies to the departure from the boarding station. */
  start: string;
  end: string;
}

export interface DirectMatch {
  board: Stop;
  alight: Stop;
  /** Where the train terminates. */
  last: Stop;
}

const inWindow = (time: string, window: TimeWindow) => time >= window.start && time <= window.end;

/** `06:15:00` -> `06:15`. Values that do not look like a time are returned unchanged. */
export function trimSeconds(time: string): string {
  return /^\d{2,}:\d{2}:\d{2}$/.test(time) ? time.slice(0, -3) : time;
}

/** Find where a passenger boards `fromId` and gets off at `toId` on this timetable, if it can. */
export function matchDirect(
  stops: readonly Stop[],
  fromId: number,
  toId: number,
  window: TimeWindow,
): DirectMatch | null {
  const last = stops[stops.length - 1];
  if (!last) return null;
  for (let i = 0; i < stops.length; i++) {
    const board = stops[i]!;
    if (board.stationId !== fromId || !board.isStop || !inWindow(board.departure, window)) continue;
    // A station can be listed twice (a junction on two lines): take the first later stop at `toId`.
    const alight = stops.slice(i + 1).find((s) => s.stationId === toId && s.isStop);
    if (alight) return { board, alight, last };
  }
  return null;
}

export interface ChainLeg {
  timetableId: number;
  trainId: number;
  trainNo: string;
  trainName: string;
  /** True when the passenger changes trains at the end of this leg. */
  isTransit: boolean;
  stops: readonly Stop[];
}

export interface JourneyLeg {
  trainId: number;
  trainNo: string;
  trainName: string;
  isTransit: boolean;
  startStation: string;
  startTime: string;
  endStation: string;
  endTime: string;
  timetableId: number;
}

export interface JourneyMatch {
  board: Stop;
  alight: Stop;
  legs: JourneyLeg[];
}

/**
 * Find a way from `fromId` to `toId` along a chain of connected timetables:
 * board on an earlier leg, ride each leg to its end, and get off on a later leg.
 * Chains where one train already covers the whole trip are skipped (that is a direct train).
 */
export function matchChain(
  chain: readonly ChainLeg[],
  fromId: number,
  toId: number,
  window: TimeWindow,
): JourneyMatch | null {
  for (let i = 0; i < chain.length; i++) {
    const first = chain[i]!;
    const boardIndex = first.stops.findIndex(
      (s, idx) =>
        idx < first.stops.length - 1 && // boarding at a leg's last stop would be pointless
        s.stationId === fromId &&
        s.isStop &&
        inWindow(s.departure, window),
    );
    if (boardIndex < 0) continue;
    const board = first.stops[boardIndex]!;
    if (matchDirect(first.stops, fromId, toId, { start: board.departure, end: board.departure })) continue;

    for (let j = i + 1; j < chain.length; j++) {
      const lastLeg = chain[j]!;
      const alightIndex = lastLeg.stops.findIndex((s, idx) => idx > 0 && s.stationId === toId && s.isStop);
      if (alightIndex < 0) continue;
      const alight = lastLeg.stops[alightIndex]!;

      const legs: JourneyLeg[] = [];
      for (let k = i; k <= j; k++) {
        const leg = chain[k]!;
        const startStop = k === i ? board : leg.stops[0]!;
        const endStop = k === j ? alight : leg.stops[leg.stops.length - 1]!;
        legs.push({
          timetableId: leg.timetableId,
          trainId: leg.trainId,
          trainNo: leg.trainNo,
          trainName: leg.trainName,
          isTransit: leg.isTransit,
          startStation: startStop.stationName,
          startTime: startStop.departure,
          endStation: endStop.stationName,
          endTime: endStop.arrival,
        });
      }
      return { board, alight, legs };
    }
  }
  return null;
}

/** ISO date (`yyyy-MM-dd`) -> weekday number as stored in `tbl_date.SearchDay`: 1 = Sunday ... 7 = Saturday. */
export function searchDayOf(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1;
}
