/**
 * The DBB responses the basketball data lib's specs read, recorded by
 * `record-fixtures.ts` and anonymised into
 * `libs/features/basketball-data/src/lib/dbb/fixtures/` by
 * `anonymise-fixtures.ts`. Each one is there for a case of the adapter; the
 * fixtures' README says which.
 */
import type { DbbRequest } from '../../libs/features/basketball-data/src/lib/dbb/dbb-request';
import {
  KEIN_LIGA_FILTER,
  type LigaSucheFilter,
} from '../../libs/features/basketball-data/src/lib/domain/liga-suche';

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

const BAYERN_U14: LigaSucheFilter = {
  verbandIds: [BAYERN],
  altersklasseIds: [U14],
  altersgruppeGeschlechtIds: [],
};

const SCHLESWIG_HOLSTEIN_JUGEND: LigaSucheFilter = {
  verbandIds: [SCHLESWIG_HOLSTEIN],
  altersklasseIds: [],
  altersgruppeGeschlechtIds: [JUGEND_MAENNLICH, JUGEND_WEIBLICH],
};

/** The e2e's wizard steps to Team 313036's Vorrunde (Liga 54862). */
const NIEDERSACHSEN_ONLY: LigaSucheFilter = {
  verbandIds: [NIEDERSACHSEN],
  altersklasseIds: [],
  altersgruppeGeschlechtIds: [],
};

const NIEDERSACHSEN_U12: LigaSucheFilter = {
  ...NIEDERSACHSEN_ONLY,
  altersklasseIds: [U12],
};

const NIEDERSACHSEN_U12_JUGEND_MAENNLICH: LigaSucheFilter = {
  ...NIEDERSACHSEN_U12,
  altersgruppeGeschlechtIds: [JUGEND_MAENNLICH],
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
    request: { kind: 'liga-suche', filter: BAYERN_U14 },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-liga-list-bayern-u14-10',
    request: { kind: 'liga-seite', filter: BAYERN_U14, startIndex: 10 },
  },
  {
    name: 'wam-liga-list-schleswig-holstein-jugend-30',
    request: {
      kind: 'liga-seite',
      filter: SCHLESWIG_HOLSTEIN_JUGEND,
      startIndex: 30,
    },
  },
  // the Team wizard's steps in the e2e: every Verband, Niedersachsen, its
  // U12, its male U12 youth Ligen (three pages, Liga 54862 on the second)
  // and the Spielplan of Team 313036's Vorrunde
  {
    name: 'wam-data-alle',
    request: { kind: 'liga-suche', filter: KEIN_LIGA_FILTER },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-data-niedersachsen',
    request: { kind: 'liga-suche', filter: NIEDERSACHSEN_ONLY },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-data-niedersachsen-u12',
    request: { kind: 'liga-suche', filter: NIEDERSACHSEN_U12 },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-data-niedersachsen-u12-jugend-maennlich',
    request: {
      kind: 'liga-suche',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
    },
    trims: UNREAD_FACETS,
  },
  {
    name: 'wam-liga-list-niedersachsen-u12-jugend-maennlich-10',
    request: {
      kind: 'liga-seite',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
      startIndex: 10,
    },
  },
  {
    name: 'wam-liga-list-niedersachsen-u12-jugend-maennlich-20',
    request: {
      kind: 'liga-seite',
      filter: NIEDERSACHSEN_U12_JUGEND_MAENNLICH,
      startIndex: 20,
    },
  },
  { name: 'spielplan-54862', request: { kind: 'spielplan', ligaId: 54862 } },
  { name: 'spielplan-54308', request: { kind: 'spielplan', ligaId: 54308 } },
  { name: 'spielplan-54379', request: { kind: 'spielplan', ligaId: 54379 } },
  {
    name: 'spielplan-54857',
    request: { kind: 'spielplan', ligaId: 54857 },
    trims: [{ path: ['data', 'matches'], keep: 4 }],
  },
  { name: 'table-54308', request: { kind: 'tabelle', ligaId: 54308 } },
  // the Tabellen of Team 313036's two Ligen, for the e2e's Team page
  { name: 'table-54689', request: { kind: 'tabelle', ligaId: 54689 } },
  { name: 'table-54862', request: { kind: 'tabelle', ligaId: 54862 } },
  { name: 'table-54857', request: { kind: 'tabelle', ligaId: 54857 } },
  { name: 'table-not-found', request: { kind: 'tabelle', ligaId: 1 } },
  { name: 'spielplan-not-found', request: { kind: 'spielplan', ligaId: 1 } },
  {
    name: 'team-313036-matches',
    request: { kind: 'team-spiele', teamId: 313036 },
  },
  { name: 'team-not-found', request: { kind: 'team-spiele', teamId: 1 } },
  {
    name: 'club-1476-actualmatches',
    request: { kind: 'vereins-spiele', vereinId: 1476, tage: 7 },
    trims: [{ path: ['data', 'matches'], keep: 15 }],
  },
  // Team 313036's Verein, for the e2e's Team page: its other Teams
  {
    name: 'club-1837-actualmatches',
    request: { kind: 'vereins-spiele', vereinId: 1837, tage: 28 },
  },
  {
    name: 'matchinfo-2911141',
    request: { kind: 'spiel-info', spielId: 2911141 },
  },
  {
    name: 'matchinfo-2843814',
    request: { kind: 'spiel-info', spielId: 2843814 },
  },
  {
    name: 'matchinfo-2930311',
    request: { kind: 'spiel-info', spielId: 2930311 },
  },
  {
    name: 'matchinfo-2930414',
    request: { kind: 'spiel-info', spielId: 2930414 },
  },
  {
    name: 'boxscore-2911141',
    request: { kind: 'spielbericht', spielId: 2911141 },
  },
  {
    name: 'boxscore-2843811',
    request: { kind: 'spielbericht', spielId: 2843811 },
  },
  {
    name: 'boxscore-2843814',
    request: { kind: 'spielbericht', spielId: 2843814 },
  },
  { name: 'matchinfo-not-found', request: { kind: 'spiel-info', spielId: 1 } },
  { name: 'boxscore-not-found', request: { kind: 'spielbericht', spielId: 1 } },
  // a Spiel of Team 313036 (at home against MTV Gifhorn), for the e2e's Spiel page
  {
    name: 'matchinfo-2861436',
    request: { kind: 'spiel-info', spielId: 2861436 },
  },
  {
    name: 'boxscore-2861436',
    request: { kind: 'spielbericht', spielId: 2861436 },
  },
];

/** The lib's fixtures folder, relative to the workspace root. */
export const FIXTURES_DIR =
  'libs/features/basketball-data/src/lib/dbb/fixtures';
