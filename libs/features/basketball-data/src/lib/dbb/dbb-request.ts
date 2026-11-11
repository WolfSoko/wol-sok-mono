import type { LeagueId, GameId, TeamId, ClubId } from '../domain/ids';
import type { ReadOptions } from '../basketball-data';
import type { LeagueSearchFilter } from '../domain/league-search';

/** The DBB's public site, which shows the data the app reads. */
export const DBB_WEBSITE_URL = 'https://www.basketball-bund.net';

/** Where the DBB's JSON API lives; `DbbHttpRequest.path` is relative to it. */
export const DBB_BASE_URL = `${DBB_WEBSITE_URL}/rest`;

/** The widest window a Verein's Spiele are asked for, in days either way. */
export const MAX_CLUB_GAMES_DAYS = 60;

/**
 * One read of the DBB this lib makes: the whole allowlist. A transport (a
 * direct `fetch` in a tool, the app's own proxy in the browser) turns it
 * into HTTP; `dbbHttpRequest` says how.
 */
export type DbbRequest =
  | { readonly kind: 'league-search'; readonly filter: LeagueSearchFilter }
  | {
      readonly kind: 'league-page';
      readonly filter: LeagueSearchFilter;
      readonly startIndex: number;
    }
  | { readonly kind: 'standings'; readonly leagueId: LeagueId }
  | { readonly kind: 'schedule'; readonly leagueId: LeagueId }
  | { readonly kind: 'team-games'; readonly teamId: TeamId }
  | {
      readonly kind: 'club-games';
      readonly clubId: ClubId;
      readonly days: number;
    }
  | { readonly kind: 'game-info'; readonly gameId: GameId }
  | { readonly kind: 'game-report'; readonly gameId: GameId };

/** The kinds of read the allowlist holds. */
export type DbbRequestKind = DbbRequest['kind'];

/** The body of the DBB's Liga search, as its own site sends it. */
export interface DbbLeagueFilterBody {
  readonly token: 0;
  readonly verbandIds: readonly number[];
  readonly gebietIds: readonly string[];
  readonly ligatypIds: readonly number[];
  readonly akgGeschlechtIds: readonly string[];
  readonly altersklasseIds: readonly number[];
  readonly spielklasseIds: readonly number[];
  readonly sortBy: 0;
}

/** One HTTP call to the DBB, relative to `DBB_BASE_URL`. */
export type DbbHttpRequest =
  | { readonly method: 'GET'; readonly path: string }
  | {
      readonly method: 'POST';
      readonly path: string;
      readonly body: DbbLeagueFilterBody;
    };

/**
 * How a transport answers one `DbbRequest`: the DBB's JSON, unread. What it
 * throws, other than a `BasketballDataError`, counts as the DBB's or the
 * network's trouble (`unavailable`). `O`: the read's options, as the read
 * was given them.
 */
export type DbbTransport<O extends ReadOptions = ReadOptions> = (
  request: DbbRequest,
  options?: O
) => Promise<unknown>;

/** The `fetch` arguments of one DBB call, without what a caller adds. */
export interface DbbFetchInput {
  readonly url: string;
  readonly method: DbbHttpRequest['method'];
  readonly headers: Readonly<Record<string, string>>;
  /** The JSON body of a POST; `undefined` for a GET. */
  readonly body: string | undefined;
}

const AGE_GROUP_GENDER_ID = /^\d+_\d+$/;
const DIGITS = /^\d+$/;

/** Whether `value` can be a DBB id at all: a positive integer. */
export function isDbbId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * The DBB id a text names (a route param, a form field): digits only, and
 * a DBB id; `undefined` for anything else.
 */
export function parseDbbId(text: string | undefined): number | undefined {
  if (text === undefined || !DIGITS.test(text)) {
    return undefined;
  }
  const id = Number(text);
  return isDbbId(id) ? id : undefined;
}

/**
 * The id of the Liga, Team, Verein or Spiel `request` reads, or
 * `undefined` for the Liga search, which reads none.
 */
export function dbbIdOf(request: DbbRequest): number | undefined {
  switch (request.kind) {
    case 'league-search':
    case 'league-page':
      return undefined;
    case 'standings':
    case 'schedule':
      return request.leagueId;
    case 'team-games':
      return request.teamId;
    case 'club-games':
      return request.clubId;
    case 'game-info':
    case 'game-report':
      return request.gameId;
  }
}

/**
 * Throws a `RangeError` for anything in `request` the DBB cannot take: an
 * id that is no positive integer, a negative start index, a day range out
 * of bounds, a malformed age group and gender id. Checks without building
 * the call, so a caller can refuse a bad request before any transport.
 */
export function assertValidDbbRequest(request: DbbRequest): void {
  switch (request.kind) {
    case 'league-search':
      return assertValidFilter(request.filter);
    case 'league-page':
      assertValidFilter(request.filter);
      return assertIndex(request.startIndex);
    case 'club-games':
      assertId(request.clubId);
      return assertDays(request.days);
    default: {
      const id = dbbIdOf(request);
      if (id !== undefined) {
        assertId(id);
      }
    }
  }
}

/**
 * The DBB call that answers `request`. Throws a `RangeError` where
 * `assertValidDbbRequest` does, so nothing but the allowlisted paths is
 * built.
 */
export function dbbHttpRequest(request: DbbRequest): DbbHttpRequest {
  assertValidDbbRequest(request);
  switch (request.kind) {
    case 'league-search':
      return {
        method: 'POST',
        path: 'wam/data',
        body: filterBody(request.filter),
      };
    case 'league-page':
      return {
        method: 'POST',
        path: `wam/liga/list?startAtIndex=${request.startIndex}`,
        body: filterBody(request.filter),
      };
    case 'standings':
      return get(`competition/table/id/${request.leagueId}`);
    case 'schedule':
      return get(`competition/spielplan/id/${request.leagueId}`);
    case 'team-games':
      return get(`team/id/${request.teamId}/matches`);
    case 'club-games':
      return get(
        `club/id/${request.clubId}/actualmatches?rangeDays=${request.days}`
      );
    case 'game-info':
      return get(`match/id/${request.gameId}/matchInfo`);
    case 'game-report':
      return get(`match/id/${request.gameId}/boxscore`);
  }
}

/**
 * How to `fetch` `request` from the DBB's API at `baseUrl`: its URL,
 * method, `headers` and, for a POST, the JSON body with its content type.
 * The proxy and the fixture tools call the DBB with it.
 */
export function dbbFetchInput(
  baseUrl: string,
  request: DbbHttpRequest,
  headers: Readonly<Record<string, string>>
): DbbFetchInput {
  const url = `${withoutTrailingSlashes(baseUrl)}/${request.path}`;
  return request.method === 'POST'
    ? {
        url,
        method: 'POST',
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify(request.body),
      }
    : { url, method: 'GET', headers, body: undefined };
}

/** Linear in the length, unlike a `/\/+$/` regex, which backtracks. */
function withoutTrailingSlashes(url: string): string {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') {
    end--;
  }
  return url.slice(0, end);
}

function get(path: string): DbbHttpRequest {
  return { method: 'GET', path };
}

function filterBody(filter: LeagueSearchFilter): DbbLeagueFilterBody {
  return {
    token: 0,
    verbandIds: filter.associationIds,
    gebietIds: [],
    ligatypIds: [],
    akgGeschlechtIds: filter.ageGroupGenderIds,
    altersklasseIds: filter.ageGroupIds,
    spielklasseIds: [],
    sortBy: 0,
  };
}

function assertValidFilter(filter: LeagueSearchFilter): void {
  filter.associationIds.forEach(assertId);
  filter.ageGroupIds.forEach(assertId);
  filter.ageGroupGenderIds.forEach(assertAgeGroupGenderId);
}

function assertId(value: number): void {
  if (!isDbbId(value)) {
    throw new RangeError(`not a DBB id: ${value}`);
  }
}

function assertIndex(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`not a list index: ${value}`);
  }
}

function assertDays(value: number): void {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_CLUB_GAMES_DAYS
  ) {
    throw new RangeError(
      `not a day range of 1 to ${MAX_CLUB_GAMES_DAYS}: ${value}`
    );
  }
}

function assertAgeGroupGenderId(value: string): void {
  if (!AGE_GROUP_GENDER_ID.test(value)) {
    throw new RangeError(`not an age group and gender id: ${value}`);
  }
}
