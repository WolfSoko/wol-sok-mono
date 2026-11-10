import type { Roster, PlayerStats } from '@wolsok/feat-shared-basketball-data';
import { kaderZeilen } from './kader-zeilen';

const WERTE: PlayerStats = {
  points: 29,
  twoPointers: 9,
  threePointers: 3,
  freeThrows: { made: 2, attempted: 7 },
  fouls: 3,
};

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
      { nummer: '7', name: 'Orvin Nesselbach', anonym: false },
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
        werte: { punkte: 29, feldkoerbe: 12, freiwuerfe: '2/7', fouls: 3 },
      },
    ]);
  });

  it('gives no Spielerwerte for a Kader without, never zeros', () => {
    const kader: Roster = {
      playerStatsRecorded: false,
      entries: [{ kind: 'anonymous' }],
    };

    expect(kaderZeilen(kader)[0].werte).toBeUndefined();
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
      { personId: 8, spitzname: 'Lu' },
      { personId: 99 },
    ]);

    expect(zeilen.map((zeile) => zeile.kind)).toEqual([
      undefined,
      { personId: 8, spitzname: 'Lu' },
      undefined,
    ]);
  });

  it("offers no mark in a Team's Kader nobody follows", () => {
    const zeilen = kaderZeilen(kader);

    expect(zeilen.every((zeile) => !zeile.spieler && !zeile.kind)).toBe(true);
  });
});
