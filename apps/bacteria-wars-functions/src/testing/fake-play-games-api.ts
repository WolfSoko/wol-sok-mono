import type {
  AchievementDefinition,
  AchievementState,
  GamesAnswer,
  PlayGamesApi,
} from '../play-games/games-api';

/** What the fake answers: Play's list, the player's states, and refusals. */
export interface FakeGamesSetup {
  definitions?: AchievementDefinition[];
  states?: Record<string, AchievementState>;
  /** A refusal of the listing named, for every call of it. */
  refuse?: { call: 'definitions' | 'states'; status: number; scope: boolean };
  /** Play ids whose unlock Google refuses, or (`'throw'`) never answers. */
  failUnlock?: Record<string, { status: number; scope: boolean } | 'throw'>;
}

/**
 * The Games API of a Play Games player, for the sign-in's and the sync's
 * specs: answers what `setup` names and logs the calls.
 */
export function fakeGamesApi(setup: FakeGamesSetup = {}) {
  const calls: string[] = [];
  const refusal = (call: 'definitions' | 'states') =>
    setup.refuse?.call === call
      ? {
          ok: false as const,
          status: setup.refuse.status,
          scope: setup.refuse.scope,
        }
      : null;
  const games: PlayGamesApi = {
    definitions: async () => {
      calls.push('definitions');
      return (
        refusal('definitions') ?? { ok: true, value: setup.definitions ?? [] }
      );
    },
    states: async () => {
      calls.push('states');
      return (
        refusal('states') ?? {
          ok: true,
          value: new Map(Object.entries(setup.states ?? {})),
        }
      );
    },
    unlock: async (id): Promise<GamesAnswer<void>> => {
      calls.push(`unlock ${id}`);
      const failure = setup.failUnlock?.[id];
      if (failure === 'throw') {
        throw new TypeError('fetch failed');
      }
      return failure === undefined
        ? { ok: true, value: undefined }
        : { ok: false, ...failure };
    },
  };
  return { games, calls };
}
