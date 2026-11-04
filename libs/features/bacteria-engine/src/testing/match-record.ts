import type { MatchRecord } from '../lib/state/medallions';

/**
 * A match record for specs: a plain win on the first level, changed by
 * `changes` - so a new field of the record gets its default here, not in
 * every spec.
 */
export function aMatchRecord(changes: Partial<MatchRecord> = {}): MatchRecord {
  return {
    levelId: 'petri-dish',
    difficulty: 'normal',
    won: true,
    durationSec: 60,
    boostsFired: 0,
    lost: 0,
    peakCount: 1000,
    lowestSizeRatio: 1,
    captured: 0,
    enemyCrushed: 0,
    peakShare: 0,
    pellets: 0,
    ...changes,
  };
}
