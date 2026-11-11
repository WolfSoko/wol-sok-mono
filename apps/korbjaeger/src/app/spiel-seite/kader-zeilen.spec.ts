import type { Roster } from '@wolsok/feat-shared-basketball-data';
import { playerStatsOf } from '@wolsok/feat-shared-basketball-data/testing';
import { kaderZeilen, playingTime } from './kader-zeilen';

/** What a youth Liga records: hits, free throws, fouls. */
const WERTE = playerStatsOf({
  points: 29,
  twoPointers: { made: 9, attempted: 0 },
  threePointers: { made: 3, attempted: 0 },
  freeThrows: { made: 2, attempted: 7 },
  fouls: 3,
  efficiency: 36,
});

/** What the 1. Regionalliga records: every value. */
const ALLE_WERTE = playerStatsOf({
  playingTimeSeconds: 1724,
  points: 16,
  twoPointers: { made: 8, attempted: 12 },
  threePointers: { made: 0, attempted: 2 },
  freeThrows: { made: 0, attempted: 2 },
  rebounds: 7,
  assists: 1,
  steals: 2,
  turnovers: 1,
  blocks: 1,
  fouls: 2,
  efficiency: 18,
  startingFive: true,
});

describe('kaderZeilen', () => {
  it('names a player as the DBB shows them, with their shirt number', () => {
    const kader: Roster = {
      playerStatsRecorded: false,
      entries: [
        {
          kind: 'named',
          personId: 7,
          firstName: 'Orvin',
          lastName: 'Nesselbach',
          shirtNumber: '7',
        },
      ],
    };

    expect(kaderZeilen(kader)).toEqual([
      { nummer: '7', name: 'Orvin Nesselbach', anonym: false, starter: false },
    ]);
  });

  it('shows an Anonymer Spieler as such, without number or person id', () => {
    const kader: Roster = {
      playerStatsRecorded: true,
      entries: [{ kind: 'anonymous', playerStats: WERTE }],
    };

    expect(kaderZeilen(kader)).toEqual([
      {
        name: 'Anonymer Spieler',
        anonym: true,
        werte: {
          playingTime: '0:00',
          points: 29,
          fieldGoals: '12',
          threePointers: '3',
          freeThrows: '2/7',
          rebounds: 0,
          assists: 0,
          steals: 0,
          turnovers: 0,
          blocks: 0,
          fouls: 3,
          efficiency: 36,
        },
        starter: false,
      },
    ]);
  });

  it('shows shots made of attempted and the starting five where the DBB records them', () => {
    const kader: Roster = {
      playerStatsRecorded: true,
      entries: [{ kind: 'anonymous', playerStats: ALLE_WERTE }],
    };

    expect(kaderZeilen(kader)[0]).toEqual({
      name: 'Anonymer Spieler',
      anonym: true,
      werte: {
        playingTime: '28:44',
        points: 16,
        fieldGoals: '8/14',
        threePointers: '0/2',
        freeThrows: '0/2',
        rebounds: 7,
        assists: 1,
        steals: 2,
        turnovers: 1,
        blocks: 1,
        fouls: 2,
        efficiency: 18,
      },
      starter: true,
    });
  });

  it('gives no Spielerwerte for a Kader without, never zeros', () => {
    const kader: Roster = {
      playerStatsRecorded: false,
      entries: [{ kind: 'anonymous' }],
    };

    expect(kaderZeilen(kader)[0].werte).toBeUndefined();
  });
});

describe('playingTime', () => {
  it.each([
    [0, '0:00'],
    [61, '1:01'],
    [1724, '28:44'],
    [2400, '40:00'],
    [1724.6, '28:45'],
    [-3, '0:00'],
  ])('shows %i seconds as %s', (seconds, shown) => {
    expect(playingTime(seconds)).toBe(shown);
  });
});

describe('kaderZeilen of a followed Team', () => {
  const kader: Roster = {
    playerStatsRecorded: false,
    entries: [
      {
        kind: 'named',
        personId: 7,
        firstName: 'Orvin',
        lastName: 'Nesselbach',
      },
      { kind: 'named', personId: 8, firstName: 'Lumi', lastName: 'Ahornwiese' },
      { kind: 'anonymous' },
    ],
  };

  it('offers to mark each named player, never an Anonymer Spieler', () => {
    const zeilen = kaderZeilen(kader, []);

    expect(zeilen.map((zeile) => zeile.spieler)).toEqual([
      { kind: 'named', personId: 7 },
      { kind: 'named', personId: 8 },
      undefined,
    ]);
  });

  it('gives a marked Kind its mark, with its Spitzname', () => {
    const zeilen = kaderZeilen(kader, [
      { personId: 8, nickname: 'Lu' },
      { personId: 99 },
    ]);

    expect(zeilen.map((zeile) => zeile.kind)).toEqual([
      undefined,
      { personId: 8, nickname: 'Lu' },
      undefined,
    ]);
  });

  it("offers no mark in a Team's Kader nobody follows", () => {
    const zeilen = kaderZeilen(kader);

    expect(zeilen.every((zeile) => !zeile.spieler && !zeile.kind)).toBe(true);
  });
});
