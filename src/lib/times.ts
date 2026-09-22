/** First and last moment of the day, sent to the backend when no time is chosen. */
export const DEFAULT_START_TIME = '00:00:00';
export const DEFAULT_END_TIME = '23:59:59';

const HALF_HOUR_SLOTS: string[] = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0');
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours}:${minutes}:00`;
});

/** Every selectable time: each half hour, plus the end of the day. */
export const ALL_TIME_SLOTS: readonly string[] = [...HALF_HOUR_SLOTS, DEFAULT_END_TIME];

/** A journey cannot start at the very end of the day. */
export const START_TIME_SLOTS: readonly string[] = ALL_TIME_SLOTS.filter(
  (slot) => slot !== DEFAULT_END_TIME,
);

/** A journey cannot end at the very start of the day. */
export const END_TIME_SLOTS: readonly string[] = ALL_TIME_SLOTS.filter(
  (slot) => slot !== DEFAULT_START_TIME,
);

/** Show `06:30:00` as `06:30`. */
export function formatSlot(slot: string): string {
  return slot.slice(0, 5);
}
