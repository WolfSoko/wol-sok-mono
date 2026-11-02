/** The balance lab's arithmetic, shared by its matches and its report. */

/** A value rounded to three places, as the report keeps it. */
export function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** The mean of the values, 0 for none. */
export function mean(values: readonly number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}
