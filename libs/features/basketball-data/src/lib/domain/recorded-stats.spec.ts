import { readEnvelope } from '../dbb/envelope';
import rosterOnly from '../dbb/fixtures/boxscore-2843811.json';
import everyStat from '../dbb/fixtures/boxscore-2861555.json';
import youth from '../dbb/fixtures/boxscore-2911141.json';
import { mapGameReport } from '../dbb/map-game-report';
import { playerStatsOf } from '../../testing/player-stats';
import type { GameReport, PlayerStats, Roster } from './game-report';
import { NONE_RECORDED, recordedStats } from './recorded-stats';

function reportOf(fixture: unknown): GameReport {
  const report = mapGameReport(readEnvelope(fixture));
  if (report === undefined) {
    throw new Error('no Spielbericht');
  }
  return report;
}

function rosterOf(...stats: Partial<PlayerStats>[]): Roster {
  return {
    playerStatsRecorded: true,
    entries: stats.map((player) => ({
      kind: 'anonymous',
      playerStats: playerStatsOf(player),
    })),
  };
}

describe('recordedStats', () => {
  it('finds every value recorded where the Verband records them all', () => {
    const report = reportOf(everyStat);

    for (const roster of [report.home, report.away]) {
      expect(Object.values(recordedStats(roster))).not.toContain(false);
    }
  });

  it('finds the threes of a youth Liga and nothing else, efficiency neither', () => {
    const report = reportOf(youth);

    expect(recordedStats(report.home)).toEqual({
      ...NONE_RECORDED,
      threePointers: true,
    });
    expect(
      report.home.entries.some((entry) => entry.playerStats?.efficiency)
    ).toBe(true);
  });

  it('finds nothing on a Kader without Spielerwerte', () => {
    expect(recordedStats(reportOf(rosterOnly).home)).toEqual(NONE_RECORDED);
  });

  it('counts a value recorded where one player has it', () => {
    expect(recordedStats(rosterOf({}, { assists: 1 }, { steals: 0 }))).toEqual({
      ...NONE_RECORDED,
      assists: true,
    });
  });

  it('counts the efficiency only with shot attempts', () => {
    expect(recordedStats(rosterOf({ efficiency: 4 })).efficiency).toBe(false);
    expect(
      recordedStats(
        rosterOf({
          efficiency: 4,
          threePointers: { made: 0, attempted: 1 },
        })
      )
    ).toEqual({
      ...NONE_RECORDED,
      shotAttempts: true,
      threePointers: true,
      efficiency: true,
    });
  });
});
