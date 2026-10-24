/**
 * Whole-number percentages for the counts that always add up to 100 (or are all
 * 0 without votes): floor each share, then hand the points lost to rounding to
 * the largest remainders, ties going to the earlier option.
 */
export function percentages(counts: readonly number[]): number[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return counts.map(() => 0);
  }
  const shares = counts.map((count) => (count / total) * 100);
  const result = shares.map(Math.floor);
  const missing = 100 - result.reduce((sum, value) => sum + value, 0);
  shares
    .map((share, index) => ({ index, remainder: share - result[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .slice(0, missing)
    .forEach(({ index }) => result[index]++);
  return result;
}
