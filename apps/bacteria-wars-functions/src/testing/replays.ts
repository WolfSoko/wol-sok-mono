import type {
  MatchPlan,
  Replay,
  ReplayExtras,
  ReplayInputs,
} from '@wolsok/feat-lazy-bac-game/engine';
import { loadEngine } from '../engine';

/**
 * Replays for the specs, recorded with the engine the functions load -
 * through `loadEngine()` like the functions themselves, so the engine stays
 * a lazily loaded library everywhere.
 */

/** No input at all: the human stands still. */
export const NO_INPUTS: ReplayInputs = {
  steers: [],
  drags: [],
  boosts: [],
  weapons: [],
};

/** A plan against the computer on a ladder level, on its online grid. */
export async function ladderPlan(
  levelId = 'quarantine',
  seed = 7
): Promise<MatchPlan> {
  const engine = await loadEngine();
  return { ...engine.rankedPlan(levelId, seed), difficulty: 'hard' };
}

/**
 * A plan against the ladder's computer (ADR 0016), as the menus pass it on
 * the ladder and on generated levels: loadouts and the curve's version,
 * which make its replay version 4 (`LADDER_REPLAY_VERSION`).
 */
export async function ladderComputerPlan(
  levelId = 'quarantine',
  seed = 7
): Promise<MatchPlan> {
  const engine = await loadEngine();
  return {
    ...(await ladderPlan(levelId, seed)),
    loadouts: [engine.PLAIN_LOADOUT, engine.PLAIN_LOADOUT],
    ladder: engine.LADDER_VERSION,
  };
}

/** The plan of an online match: two players, no head start. */
export async function onlinePlan(seed = 11): Promise<MatchPlan> {
  const engine = await loadEngine();
  return { ...engine.rankedPlan('quarantine', seed), mode: 'two-players' };
}

/** Playing is slow under Jest: each recording is played once per run. */
const recorded = new Map<string, Replay>();

/**
 * A replay as a device records it: played on the CPU engine for `ticks`
 * with the checksum it came to and - when the simulation did not end it -
 * a forfeit of the left seat, as when the player gives up.
 */
export async function recordedReplay(
  plan: MatchPlan,
  ticks = 120,
  extras: ReplayExtras = {},
  inputs: ReplayInputs = NO_INPUTS
): Promise<Replay> {
  const key = JSON.stringify([plan, ticks, extras, inputs]);
  const cached = recorded.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const engine = await loadEngine();
  const draft = engine.replayOf(plan, 'cpu', ticks, inputs, extras);
  const played = engine.playReplay(draft);
  if (played === null) {
    throw new Error('The replay does not play');
  }
  const replay: Replay = {
    ...draft,
    header: {
      ...draft.header,
      ticks: played.ticks,
      checksum: played.checksum,
      outcome: engine.replayOutcome(played.outcome) ?? {
        endedBy: 'forfeit',
        winnerSeat: 1,
      },
    },
  };
  recorded.set(key, replay);
  return replay;
}

/** The replay as a client uploads it. */
export async function bytesOf(replay: Replay): Promise<Uint8Array> {
  return (await loadEngine()).replayToBytes(replay);
}
