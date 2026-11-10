/**
 * The DBB responses the basketball data lib's specs read, recorded by
 * `record-fixtures.ts` and anonymised into
 * `libs/features/basketball-data/src/lib/dbb/fixtures/` by
 * `anonymise-fixtures.ts`. Each one is there for a case of the adapter; the
 * fixtures' README says which.
 */
import {
  type DbbRequest,
  NO_LEAGUE_FILTER,
  type LeagueSearchFilter,
} from '@wolsok/feat-shared-basketball-data';

/** A list in a response cut down to its first `keep` items. */
export interface FixtureTrim {
  readonly path: readonly string[];
  readonly keep: number;
}

export interface FixtureRequest {
  /** The file name, without `.json`. */
  readonly name: string;
  readonly request: DbbRequest;
  readonly trims?: readonly FixtureTrim[];
}

const BAYERN = 2;
const NIEDERSACHSEN = 7;
const SCHLESWIG_HOLSTEIN = 10;
const U12 = 12;
const U14 = 14;
const JUGEND_MAENNLICH = '2_1';
const JUGEND_WEIBLICH = '2_2';

const BAYERN_U14: LeagueSearchFilter = {
  associationIds: [BAYERN],
  ageGroupIds: [U14],
  ageGroupGenderIds: [],
};

const SCHLESWIG_HOLSTEIN_JUGEND: LeagueSearchFilter = {
  associationIds: [SCHLESWIG_HOLSTEIN],
  ageGroupIds: [],
  ageGroupGenderIds: [JUGEND_MAENNLICH, JUGEND_WEIBLICH],
};

/** The e2e's wizard steps to Team 313036's Vorrunde (Liga 54862). */
const NIEDERSACHSEN_ONLY: LeagueSearchFilter = {
  associationIds: [NIEDERSACHSEN],
  ageGroupIds: [],
  ageGroupGenderIds: [],
};

const NIEDERSACHSEN_U12: LeagueSearchFilter = {
  ...NIEDERSACHSEN_ONLY,
  ageGroupIds: [U12],
};

const NIEDERSACHSEN_U12_JUGEND_MAENNLICH: LeagueSearchFilter = {
  ...NIEDERSACHSEN_U12,
  ageGroupGenderIds: [JUGEND_MAENNLICH],
};

/** Facets the lib doesn't read, cut short to keep the file small. */
const UNREAD_FACETS: readonly FixtureTrim[] = [
  { path: ['data', 'gebiete'], keep: 3 },
  { path: ['data', 'ligatypen'], keep: 3 },
  { path: ['data', 'spielklassen'], keep: 3 },
];

export const FIXTURE_REQUESTS: readonly FixtureRequest[] = [
  {
    name: 'wam-data-bayern-u14',
    request: { kind: 'league-search', filter: BAYERN_U14 },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-liga-list-bayern-u14-10',
    request: { kind: 'league-page', filter: BAYERN_U14, startIndex: 10 },
  },
  {
    name: 'wam-liga-list-schleswig-holstein-jugend-30',
    request: {
      kind: 'league-page',
      filter: SCHLESWIG_HOLSTEIN_JUGEND,
      startIndex: 30,
    },
  },
  // the Team wizard's steps in the e2e: every Verband, Niedersachsen, its
  // U12, its male U12 youth Ligen (three pages, Liga 54862 on the second)
  // and the Spielplan of Team 313036's Vorrunde
  {
    name: 'wam-data-alle',
    request: { kind: 'league-search', filter: NO_LEAGUE_FILTER },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-data-niedersachsen',
    request: { kind: 'league-search', filter: NIEDERSACHSEN_ONLY },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-data-niedersachsen-u12',
    request: { kind: 'league-search', filter: NIEDERSACHSEN_U12 },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-data-niedersachsen-u12-jugend-maennlich',
    request: {
      kind: 'league-search',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
    },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-liga-list-niedersachsen-u12-jugend-maennlich-10',
    request: {
      kind: 'league-page',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
      startIndex: 10,
    },
  },
  {
    name: 'wam-liga-list-niedersachsen-u12-jugend-maennlich-20',
    request: {
      kind: 'league-page',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
      startIndex: 20,
    },
  },
  { name: 'spielplan-54862', request: { kind: 'schedule', leagueId: 54862 } },
  { name: 'spielplan-54308', request: { kind: 'schedule', leagueId: 54308 } },
  { name: 'spielplan-54379', request: { kind: 'schedule', leagueId: 54379 } },
  {
    name: 'spielplan-54857',
    request: { kind: 'schedule', leagueId: 54857 },
    trims: [{ path: ['data', 'matches'], keep: 4 }],
  },
  { name: 'table-54308', request: { kind: 'standings', leagueId: 54308 } },
  // the Tabellen of Team 313036's two Ligen, for the e2e's Team page
  { name: 'table-54689', request: { kind: 'standings', leagueId: 54689 } },
  { name: 'table-54862', request: { kind: 'standings', leagueId: 54862 } },
  { name: 'table-54857', request: { kind: 'standings', leagueId: 54857 } },
  { name: 'table-not-found', request: { kind: 'standings', leagueId: 1 } },
  { name: 'spielplan-not-found', request: { kind: 'schedule', leagueId: 1 } },
  {
    name: 'team-313036-matches',
    request: { kind: 'team-games', teamId: 313036 },
  },
  { name: 'team-not-found', request: { kind: 'team-games', teamId: 1 } },
  {
    name: 'club-1476-actualmatches',
    request: { kind: 'club-games', clubId: 1476, days: 7 },
    trims: [{ path: ['data', 'matches'], keep: 15 }],
  },
  // Team 313036's Verein, for the e2e's Team page: its other Teams
  {
    name: 'club-1837-actualmatches',
    request: { kind: 'club-games', clubId: 1837, days: 28 },
  },
  {
    name: 'club-not-found',
    request: { kind: 'club-games', clubId: 1, days: 28 },
  },
  {
    name: 'matchinfo-2911141',
    request: { kind: 'game-info', gameId: 2911141 },
  },
  {
    name: 'matchinfo-2843814',
    request: { kind: 'game-info', gameId: 2843814 },
  },
  {
    name: 'matchinfo-2930311',
    request: { kind: 'game-info', gameId: 2930311 },
  },
  {
    name: 'matchinfo-2930414',
    request: { kind: 'game-info', gameId: 2930414 },
  },
  {
    name: 'boxscore-2911141',
    request: { kind: 'game-report', gameId: 2911141 },
  },
  {
    name: 'boxscore-2843811',
    request: { kind: 'game-report', gameId: 2843811 },
  },
  {
    name: 'boxscore-2843814',
    request: { kind: 'game-report', gameId: 2843814 },
  },
  { name: 'matchinfo-not-found', request: { kind: 'game-info', gameId: 1 } },
  { name: 'boxscore-not-found', request: { kind: 'game-report', gameId: 1 } },
  // a Spiel of Team 313036 (at home against MTV Gifhorn), for the e2e's Spiel page
  {
    name: 'matchinfo-2861436',
    request: { kind: 'game-info', gameId: 2861436 },
  },
  {
    name: 'boxscore-2861436',
    request: { kind: 'game-report', gameId: 2861436 },
  },
];

/** The lib's fixtures folder, relative to the workspace root. */
export const FIXTURES_DIR =
  'libs/features/basketball-data/src/lib/dbb/fixtures';
