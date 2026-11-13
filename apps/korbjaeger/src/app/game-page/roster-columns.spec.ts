import type { PlayerStats, Roster } from '@wolsok/feat-shared-basketball-data';
import { playerStatsOf } from '@wolsok/feat-shared-basketball-data/testing';
import { statsColumns } from './roster-columns';

function rosterOf(...players: Partial<PlayerStats>[]): Roster {
  return {
    playerStatsRecorded: true,
    entries: players.map((player) => ({
      kind: 'anonymous',
      playerStats: playerStatsOf(player),
    })),
  };
}

/** A starter of the 1. Regionalliga: every value recorded. */
const EVERY_VALUE = rosterOf({
  playingTimeSeconds: 1724,
  points: 16,
  twoPointers: { made: 8, attempted: 12 },
  threePointers: { made: 0, attempted: 2 },
  rebounds: 7,
  assists: 1,
  steals: 2,
  turnovers: 1,
  blocks: 1,
  fouls: 2,
  efficiency: 18,
  startingFive: true,
});

describe('statsColumns', () => {
  it('gives a Kader without Spielerwerte none', () => {
    expect(statsColumns({ playerStatsRecorded: false, entries: [] })).toEqual(
      []
    );
  });

  it('gives a youth Kader the columns it always had', () => {
    expect(
      statsColumns(
        rosterOf({ points: 2, twoPointers: { made: 1, attempted: 0 } })
      )
    ).toEqual([
      { id: 'points', abbreviation: 'Pkt.', label: 'Punkte' },
      { id: 'fieldGoals', abbreviation: 'FK', label: 'Feldkörbe' },
      {
        id: 'freeThrows',
        abbreviation: 'FW',
        label: 'Freiwürfe getroffen von versucht',
      },
      { id: 'fouls', abbreviation: 'F', label: 'Fouls' },
    ]);
  });

  it('adds every recorded value, in the DBB order, shots made of attempted', () => {
    expect(
      statsColumns(EVERY_VALUE).map(
        ({ abbreviation, label }) => `${abbreviation} ${label}`
      )
    ).toEqual([
      'Min. Spielzeit in Minuten',
      'Pkt. Punkte',
      'FK Feldkörbe getroffen von versucht',
      '3P Dreier getroffen von versucht',
      'FW Freiwürfe getroffen von versucht',
      'Reb. Rebounds',
      'Ass. Assists',
      'BG Ballgewinne',
      'BV Ballverluste',
      'Bl. Blocks',
      'F Fouls',
      'Eff. Effizienz',
    ]);
  });

  it('adds only what is recorded', () => {
    expect(
      statsColumns(
        rosterOf({ points: 3 }, { threePointers: { made: 1, attempted: 0 } })
      ).map(({ id, label }) => `${id} ${label}`)
    ).toEqual([
      'points Punkte',
      'fieldGoals Feldkörbe',
      'threePointers Dreier',
      'freeThrows Freiwürfe getroffen von versucht',
      'fouls Fouls',
    ]);
  });
});
