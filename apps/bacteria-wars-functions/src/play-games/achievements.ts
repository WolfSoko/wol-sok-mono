/**
 * The game's achievements on Play Games (#3175 step 3): at every start of
 * the Android app, the sign-in trigger unlocks on Play what the account
 * has earned and Play still shows locked, through the player's Games API
 * handle. Nothing is stored; the logs carry names and status codes only.
 */

import {
  ACHIEVEMENTS,
  type AchievementId,
  parseProgress,
} from '@wolsok/feat-shared-bacteria-engine';
import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { PROGRESS_KEY } from '../boards/rank-progress';
import { isBanned } from '../limits';
import type {
  AchievementDefinition,
  AchievementState,
  PlayGamesApi,
} from './games-api';

/** What to unlock, and the earned names Play could not be matched on. */
export interface UnlockPlan {
  unlock: AchievementDefinition[];
  /** Earned, but Play lists no achievement of the name. */
  missing: string[];
  /** Earned, but Play lists two of the name. */
  ambiguous: string[];
}

/**
 * The earned achievements Play lists once under their English name (the
 * game's `ACHIEVEMENTS` name, which `play-games-achievements.spec.ts`
 * keeps equal to the file the deploy's sync sends) and does not show
 * unlocked for the player.
 */
export function achievementsToUnlock(
  earned: readonly AchievementId[],
  definitions: readonly AchievementDefinition[],
  states: ReadonlyMap<string, AchievementState>
): UnlockPlan {
  const plan: UnlockPlan = { unlock: [], missing: [], ambiguous: [] };
  for (const { id, name } of ACHIEVEMENTS) {
    if (!earned.includes(id)) {
      continue;
    }
    const matches = definitions.filter((each) => each.name === name);
    if (matches.length === 0) {
      plan.missing.push(name);
    } else if (matches.length > 1) {
      plan.ambiguous.push(name);
    } else if (states.get(matches[0].id) !== 'UNLOCKED') {
      plan.unlock.push(matches[0]);
    }
  }
  return plan;
}

/** What became of a sync - for the specs; the log says the same. */
export type SyncOutcome =
  | 'banned'
  | 'nothing-earned'
  | { refused: 'definitions' | 'states'; status: number; scope: boolean }
  | (Omit<UnlockPlan, 'unlock'> & { unlocked: string[]; failed: string[] });

/**
 * Unlocks on Play what `uid` has earned (its stored progress) - never for
 * a banned account, whose progress a ban keeps off Play. A failed unlock
 * is logged and the next one still goes; a refusal for the token's scope
 * is logged as its own case.
 */
export async function syncPlayGamesAchievements(
  db: Firestore,
  uid: string,
  games: PlayGamesApi,
  now: number
): Promise<SyncOutcome> {
  if (await isBanned(db, uid, now)) {
    logger.info('Play Games achievements not synced: the account is banned');
    return 'banned';
  }
  const earned = await earnedAchievements(db, uid);
  if (earned.length === 0) {
    return 'nothing-earned';
  }
  const definitions = await games.definitions();
  if (!definitions.ok) {
    return refusedListing('definitions', definitions);
  }
  const states = await games.states();
  if (!states.ok) {
    return refusedListing('states', states);
  }
  const { unlock, missing, ambiguous } = achievementsToUnlock(
    earned,
    definitions.value,
    states.value
  );
  const unlocked: string[] = [];
  const failed: string[] = [];
  for (const { id, name } of unlock) {
    const answer = await games.unlock(id).catch(() => null);
    if (answer?.ok === true) {
      unlocked.push(name);
    } else {
      failed.push(name);
      if (answer?.scope === true) {
        logScopeRefusal('unlock', answer.status);
      } else {
        logger.warn('Play Games refused to unlock an achievement', {
          name,
          status: answer?.status ?? null,
        });
      }
    }
  }
  if (unlocked.length + failed.length + missing.length + ambiguous.length > 0) {
    logger.info('Play Games achievements synced', {
      unlocked,
      failed,
      missing,
      ambiguous,
    });
  }
  return { unlocked, failed, missing, ambiguous };
}

/** The achievements `uid`'s stored progress holds - none when unreadable. */
async function earnedAchievements(
  db: Firestore,
  uid: string
): Promise<AchievementId[]> {
  const json: unknown = (
    await db.doc(`players/${uid}/storage/${PROGRESS_KEY}`).get()
  ).get('json');
  if (typeof json !== 'string') {
    return [];
  }
  try {
    return Object.keys(
      parseProgress(JSON.parse(json)).achievements
    ) as AchievementId[];
  } catch {
    return [];
  }
}

function refusedListing(
  call: 'definitions' | 'states',
  { status, scope }: { status: number; scope: boolean }
): SyncOutcome {
  if (scope) {
    logScopeRefusal(call, status);
  } else {
    logger.warn('Play Games refused to list achievements', { call, status });
  }
  return { refused: call, status, scope };
}

function logScopeRefusal(call: string, status: number): void {
  logger.warn('Play Games refused the token’s scope for achievements', {
    call,
    status,
  });
}
