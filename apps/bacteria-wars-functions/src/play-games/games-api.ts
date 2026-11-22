/**
 * The Games API (games/v1) for one Play Games player, bound to the access
 * token of their server auth code (#3175 step 3). The token stays inside
 * the closure: nothing this module answers carries it, so nothing can
 * store or log it by mistake. Google accepts the code's default scope
 * `games_lite` for all three calls.
 */

import { isObject } from '@wolsok/feat-shared-bacteria-engine';

const API = 'https://games.googleapis.com/games/v1';
/** Each call gets this long, as the code exchange does. */
const FETCH_TIMEOUT_MS = 10_000;
/** The most results Google answers per page. */
const PAGE_SIZE = 200;
/** Pages followed at most: far more than the game has achievements. */
const MAX_PAGES = 5;

/** An achievement as Play lists it, its name in English. */
export interface AchievementDefinition {
  id: string;
  name: string;
}

export type AchievementState = 'HIDDEN' | 'REVEALED' | 'UNLOCKED';

/** What a call answers: its value, or Google's refusal. */
export type GamesAnswer<T> =
  | { ok: true; value: T }
  | {
      ok: false;
      status: number;
      /** True when Google refused the token's scope. */
      scope: boolean;
    };

export interface PlayGamesApi {
  /** Play's achievements, with their English names. */
  definitions(): Promise<GamesAnswer<AchievementDefinition[]>>;
  /** The player's state of each achievement Play has one for. */
  states(): Promise<GamesAnswer<Map<string, AchievementState>>>;
  /** Unlocks one achievement for the player (a second time is no error). */
  unlock(id: string): Promise<GamesAnswer<void>>;
}

const STATES: readonly string[] = ['HIDDEN', 'REVEALED', 'UNLOCKED'];

/** The Games API of the player `accessToken` stands for. */
export function gamesApi(
  accessToken: string,
  fetchFn: typeof fetch
): PlayGamesApi {
  const call = (url: string, method = 'GET') =>
    fetchFn(url, {
      method,
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

  async function pages(path: string, query: Record<string, string>) {
    const items: unknown[] = [];
    let pageToken: string | null = null;
    for (let page = 0; page < MAX_PAGES; page++) {
      const params = new URLSearchParams({
        ...query,
        maxResults: String(PAGE_SIZE),
      });
      if (pageToken !== null) {
        params.set('pageToken', pageToken);
      }
      const response = await call(`${API}/${path}?${params.toString()}`);
      if (!response.ok) {
        return refusal(response);
      }
      const body: unknown = await response.json();
      items.push(...listOf(body, 'items'));
      pageToken = stringOf(body, 'nextPageToken');
      if (pageToken === null) {
        break;
      }
    }
    return { ok: true as const, value: items };
  }

  return {
    async definitions() {
      const listed = await pages('achievements', { language: 'en-US' });
      if (!listed.ok) {
        return listed;
      }
      return {
        ok: true,
        value: listed.value.flatMap((item) => {
          const id = stringOf(item, 'id');
          const name = stringOf(item, 'name');
          return id === null || name === null ? [] : [{ id, name }];
        }),
      };
    },
    async states() {
      const listed = await pages('players/me/achievements', {});
      if (!listed.ok) {
        return listed;
      }
      const states = new Map<string, AchievementState>();
      for (const item of listed.value) {
        const id = stringOf(item, 'id');
        const state = stringOf(item, 'achievementState');
        if (id !== null && state !== null && STATES.includes(state)) {
          states.set(id, state as AchievementState);
        }
      }
      return { ok: true, value: states };
    },
    async unlock(id) {
      const response = await call(
        `${API}/achievements/${encodeURIComponent(id)}/unlock`,
        'POST'
      );
      if (!response.ok) {
        return refusal(response);
      }
      // Its answer says only whether it was new; free the connection.
      await response.body?.cancel();
      return { ok: true, value: undefined };
    },
  };
}

/**
 * Google's refusal, telling one for the token's scope: by the
 * `insufficient_scope` challenge, or the reason in the error body (the
 * newer `ACCESS_TOKEN_SCOPE_INSUFFICIENT`, the older
 * `insufficientPermissions`).
 */
async function refusal(
  response: Response
): Promise<{ ok: false; status: number; scope: boolean }> {
  const challenge = response.headers.get('www-authenticate') ?? '';
  const body = await response.text().catch(() => '');
  const scope =
    response.status === 403 &&
    (challenge.includes('insufficient_scope') ||
      body.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
      body.includes('insufficientPermissions'));
  return { ok: false, status: response.status, scope };
}

function listOf(body: unknown, key: string): unknown[] {
  if (!isObject(body)) {
    return [];
  }
  const value = body[key];
  return Array.isArray(value) ? value : [];
}

/** A non-empty string field of a JSON answer, null otherwise. */
export function stringOf(body: unknown, key: string): string | null {
  if (!isObject(body)) {
    return null;
  }
  const value = body[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
