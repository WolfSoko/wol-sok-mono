import {
  arenaSize,
  ONLINE_SIM_RESOLUTION,
  SimResolution,
} from '../lib/state/arena-size';
import { DEFAULT_COLORS } from '../lib/state/colony-colors';
import { getLevel, levelSize } from '../lib/state/levels';
import type { MatchPlan } from '../lib/state/match-setup';
import {
  playReplay,
  Replay,
  replayOf,
  replayOutcome,
} from '../lib/state/replay';

const NO_INPUTS = { steers: [], drags: [], boosts: [], weapons: [] };

/**
 * A replay as a device stores it, for specs: `ticks` of a match against
 * the computer in which the human stands still, on the CPU at the online
 * grid, with the outcome and checksum it played to - so the stored parse
 * takes it. On another `grid` it is one only kept to watch again.
 */
export function recordedReplay(
  levelId = 'petri-dish',
  ticks = 90,
  seed = 7,
  grid: SimResolution = ONLINE_SIM_RESOLUTION
): Replay {
  const plan: MatchPlan = {
    levelId,
    mode: 'vs-computer',
    difficulty: 'normal',
    colors: [DEFAULT_COLORS[0], DEFAULT_COLORS[1]],
    headStart: 0,
    ...arenaSize(grid, levelSize(getLevel(levelId))),
    seed,
  };
  const played = playReplay(replayOf(plan, 'cpu', ticks, NO_INPUTS));
  if (played === null) {
    throw new Error('The draft replay did not play');
  }
  return replayOf(plan, 'cpu', played.ticks, NO_INPUTS, {
    // Not over yet: the player gave up, as a device records it.
    outcome: replayOutcome(played.outcome) ?? {
      endedBy: 'forfeit',
      winnerSeat: 1,
    },
    checksum: played.checksum,
  });
}
