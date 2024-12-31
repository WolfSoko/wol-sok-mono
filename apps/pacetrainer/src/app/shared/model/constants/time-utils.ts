export const SECOND_IN_MS = 1000 as Milliseconds;
export const SECONDS_IN_MINUTE = 60 as Seconds;
export const MINUTES_IN_HOUR = 60 as Minutes;
export const HOURS_IN_DAY = 24 as Hours;

// Types
const timeUnitSymbol = Symbol('__unit');

export type Milliseconds = { [timeUnitSymbol]: 'ms' } & number;
export type Seconds = { [timeUnitSymbol]: 's' } & number;
export type Minutes = { [timeUnitSymbol]: 'm' } & number;
export type Hours = { [timeUnitSymbol]: 'h' } & number;
export type Days = { [timeUnitSymbol]: 'd' } & number;

export type TimeUnit = Milliseconds | Seconds | Minutes | Hours | Days;

export const ZERO_MS = milliseconds(0);

// factories
export function milliseconds(ms: number): Milliseconds {
  return ms as Milliseconds;
}
export function seconds(seconds: number): Seconds {
  return seconds as Seconds;
}

export function minutes(minutes: number): Minutes {
  return minutes as Minutes;
}
export function hours(hours: number): Hours {
  return hours as Hours;
}
export function days(days: number): Days {
  return days as Days;
}

// Conversions
export function sToMs(seconds: Seconds): Milliseconds {
  return milliseconds(seconds * SECOND_IN_MS);
}
export function mToMs(minutes: Minutes): Milliseconds {
  return sToMs(seconds(minutes * SECONDS_IN_MINUTE));
}
export function hToMs(hours: Hours): Milliseconds {
  return mToMs(minutes(hours * MINUTES_IN_HOUR));
}

export function dToMs(days: Days): Milliseconds {
  return hToMs(hours(days * HOURS_IN_DAY));
}

export function msToS(milliseconds: Milliseconds): Seconds {
  return seconds(milliseconds / SECOND_IN_MS);
}
export function msToM(milliseconds: Milliseconds): Minutes {
  return minutes(msToS(milliseconds) / SECONDS_IN_MINUTE);
}
export function msToH(milliseconds: Milliseconds): Hours {
  return hours(msToM(milliseconds) / MINUTES_IN_HOUR);
}
export function msToD(milliseconds: Milliseconds): Days {
  return days(msToH(milliseconds) / HOURS_IN_DAY);
}

// Math
export function add<T extends TimeUnit>(...adds: T[]): T {
  return adds.reduce((acc, cur) => (acc + cur) as T, 0 as T);
}

export function subtract<T extends TimeUnit>(term: T, ...subtrahends: T[]): T {
  return (term - add(...subtrahends)) as T;
}

export function mul<T extends TimeUnit>(ms1: T, ms2: number) {
  return (ms1 * ms2) as T;
}

export function div<T extends TimeUnit, T2 extends number | T>(
  ms1: T,
  ms2: T2
): T2 extends TimeUnit ? number : T {
  return (ms1 / ms2) as T2 extends TimeUnit ? number : T;
}

// compare
export function compare<T extends TimeUnit>(cmp1: T, cmp2: T): number {
  const result = subtract(cmp1, cmp2);
  return result > 0 ? 1 : result < 0 ? -1 : 0;
}

export function gt<T extends TimeUnit>(cmp1: T, cmp2: T): boolean {
  return compare(cmp1, cmp2) > 0;
}
export function lt<T extends TimeUnit>(cmp1: T, cmp2: T): boolean {
  return compare(cmp1, cmp2) < 0;
}
export function ge<T extends TimeUnit>(cmp1: T, cmp2: T): boolean {
  return compare(cmp1, cmp2) >= 0;
}
export function le<T extends TimeUnit>(cmp1: T, cmp2: T): boolean {
  return compare(cmp1, cmp2) <= 0;
}
