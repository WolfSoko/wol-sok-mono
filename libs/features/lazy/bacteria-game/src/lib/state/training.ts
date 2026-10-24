import type { GameText } from '../i18n/game-text';
import type { BotDifficulty } from './bot-controller';
import type { MatchRecord } from './medallions';
import type { Progress } from './progress';
import {
  MISSION_IDS,
  MissionId,
  missionOfLevel,
  trainingLevelId,
} from './training-levels';

export { isMissionId, MISSION_IDS, missionOfLevel } from './training-levels';
export type { MissionId } from './training-levels';

/**
 * The training: five short missions for new players, each teaching one
 * thing - steering, the food, the boost, attacking, a first fight. A
 * mission is a level of its own (`training-levels.ts`) played against a
 * training dummy or the easy computer, won by the level's rule like any
 * other - holding the zone, eating pellets, the bigger colony when the
 * clock runs out - and, where the mission asks for more, with what the
 * match measured: the boosts fired.
 *
 * A mission is done once, on the day it was done, and stays done; it may
 * be played again. Missions keep no medallion and count for no totals or
 * achievements - what a done mission is worth is its XP (`xp.ts`).
 */
export interface Mission {
  id: MissionId;
  /** The level it is played on. */
  levelId: string;
  /** The icon of its card. */
  icon: string;
  /** Boosts it asks to fire on the way, none when absent. */
  boosts?: number;
}

/** The icon of each mission's card. */
const MISSION_ICONS: Readonly<Record<MissionId, string>> = {
  steer: 'open_with',
  feed: 'restaurant',
  boost: 'bolt',
  attack: 'sports_mma',
  fight: 'smart_toy',
};

export const MISSIONS: readonly Mission[] = MISSION_IDS.map((id) => ({
  id,
  levelId: trainingLevelId(id),
  icon: MISSION_ICONS[id],
  ...(id === 'boost' ? { boosts: 2 } : {}),
}));

/** The computer the missions are played against, where one plays. */
export const TRAINING_DIFFICULTY: BotDifficulty = 'easy';

/** The mission a level is played for, null for any other level. */
export function missionOf(levelId: string): Mission | null {
  const id = missionOfLevel(levelId);
  return MISSIONS.find((mission) => mission.id === id) ?? null;
}

/** The mission after this one, null after the last. */
export function nextMission(id: MissionId): Mission | null {
  return MISSIONS[MISSION_IDS.indexOf(id) + 1] ?? null;
}

/** True once the mission has been done. */
export function isMissionDone(progress: Progress, id: MissionId): boolean {
  return progress.training[id] != null;
}

/** The missions done so far. */
export function missionsDone(progress: Progress): number {
  return MISSION_IDS.filter((id) => isMissionDone(progress, id)).length;
}

/** The first mission still to do - the first one again once all are done. */
export function firstOpenMission(progress: Progress): MissionId {
  return MISSION_IDS.find((id) => !isMissionDone(progress, id)) ?? 'steer';
}

/**
 * What a match left the mission short of - null once it did the mission:
 * a win, and the boosts it asks for.
 */
export function missionShortfall(
  mission: Mission,
  record: MatchRecord
): GameText | null {
  if (!record.won) {
    return { key: `training.missions.${mission.id}.goal` };
  }
  if (mission.boosts !== undefined && record.boostsFired < mission.boosts) {
    return {
      key: 'training.result.boosts',
      params: { count: mission.boosts, fired: record.boostsFired },
    };
  }
  return null;
}

/**
 * The progress with a mission done on `day` - the earlier day kept, so
 * tabs and devices converge. Without a change it is the progress given.
 */
export function addMission(
  progress: Progress,
  id: MissionId,
  day: string
): Progress {
  const held = progress.training[id];
  return held != null && held <= day
    ? progress
    : { ...progress, training: { ...progress.training, [id]: day } };
}

/** What a mission's match came to, for the result screen. */
export interface MissionResult {
  mission: MissionId;
  /** True when the match did the mission. */
  done: boolean;
  /** True when it was done for the first time. */
  first: boolean;
  /** What the match left the mission short of, null once done. */
  shortfall: GameText | null;
}
