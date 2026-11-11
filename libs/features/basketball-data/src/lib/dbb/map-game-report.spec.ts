import {
  isNamed,
  playerStatsRecorded,
  type Roster,
  type RosterEntry,
} from '../domain/game-report';
import { caughtError } from '../../testing/caught-error';
import { playerStatsOf } from '../../testing/player-stats';
import { readEnvelope } from './envelope';
import noReport from './fixtures/boxscore-2843814.json';
import rosterOnly from './fixtures/boxscore-2843811.json';
import rosterOnlyWithAnonymous from './fixtures/boxscore-2861436.json';
import withStats from './fixtures/boxscore-2911141.json';
import everyStat from './fixtures/boxscore-2861555.json';
import { mapGameReport } from './map-game-report';

describe('mapGameReport', () => {
  describe('where the Verband records every Spielerwert (1. Regionalliga Herren)', () => {
    const report = mapGameReport(readEnvelope(everyStat));

    it('reads every value of a player', () => {
      expect(report?.home.entries[0]).toEqual({
        kind: 'named',
        personId: 96606327,
        firstName: 'Rilla',
        lastName: 'Schlehenau',
        shirtNumber: '1',
        playerStats: {
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
          startingFive: false,
        },
      });
    });

    it('reads the starting five, five a side', () => {
      const starters = (roster: Roster | undefined): number =>
        (roster?.entries ?? []).filter(
          (entry) => entry.playerStats?.startingFive
        ).length;

      expect(starters(report?.home)).toBe(5);
      expect(starters(report?.away)).toBe(5);
    });

    it('reads the playing time in seconds: five players for 40 minutes a side', () => {
      const seconds = (report?.home.entries ?? []).reduce(
        (sum, entry) => sum + (entry.playerStats?.playingTimeSeconds ?? 0),
        0
      );

      expect(seconds).toBe(5 * 40 * 60);
    });

    it('keeps a negative efficiency', () => {
      expect(report?.home.entries[1]?.playerStats?.efficiency).toBe(-1);
    });
  });

  describe('where the Verband records Spielerwerte (Bayern)', () => {
    const report = mapGameReport(readEnvelope(withStats));

    it('says so for both Kader', () => {
      expect(report?.gameId).toBe(2911141);
      expect(report?.home.playerStatsRecorded).toBe(true);
      expect(report?.away.playerStatsRecorded).toBe(true);
      expect(report && playerStatsRecorded(report)).toBe(true);
    });

    it('reads a named player with their Spielerwerte', () => {
      expect(report?.away.entries[1]).toEqual({
        kind: 'named',
        personId: 91692638,
        firstName: 'Ilvio',
        lastName: 'Mistelgrund',
        playerStats: playerStatsOf({
          points: 29,
          twoPointers: { made: 9, attempted: 0 },
          threePointers: { made: 3, attempted: 0 },
          freeThrows: { made: 2, attempted: 7 },
          fouls: 3,
          efficiency: 36,
        }),
      });
    });

    it('reads an Anonymer Spieler without person id or name, with their Spielerwerte', () => {
      expect(report?.home.entries[0]).toEqual({
        kind: 'anonymous',
        playerStats: playerStatsOf({
          points: 10,
          twoPointers: { made: 4, attempted: 0 },
          threePointers: { made: 0, attempted: 0 },
          freeThrows: { made: 2, attempted: 4 },
          fouls: 3,
          efficiency: 12,
        }),
      });
      expect(
        report?.away.entries.filter((entry) => !isNamed(entry))
      ).toHaveLength(2);
    });

    it('leaves out shirt numbers where the Kader lists 0 for everyone', () => {
      const namedPlayers = (report?.home.entries ?? []).filter(isNamed);

      expect(namedPlayers.map((player) => player.shirtNumber)).toEqual(
        namedPlayers.map(() => undefined)
      );
    });

    it('reads every number of a Kader, adding up to the result', () => {
      const points = (report?.home.entries ?? []).reduce(
        (sum, entry) => sum + (entry.playerStats?.points ?? 0),
        0
      );

      expect(points).toBe(99);
    });
  });

  describe('where the Verband records the Kader only (Schleswig-Holstein)', () => {
    const report = mapGameReport(readEnvelope(rosterOnly));

    it('says no Spielerwerte were recorded and gives no zeros', () => {
      expect(report?.home.playerStatsRecorded).toBe(false);
      expect(report?.away.playerStatsRecorded).toBe(false);
      expect(report && playerStatsRecorded(report)).toBe(false);
      expect(
        [
          ...(report?.home.entries ?? []),
          ...(report?.away.entries ?? []),
        ].every((e) => e.playerStats === undefined)
      ).toBe(true);
    });

    it('reads both Kader with names and shirt numbers', () => {
      expect(report?.home.entries).toHaveLength(11);
      expect(report?.away.entries).toHaveLength(11);
      expect(report?.home.entries[0]).toEqual({
        kind: 'named',
        personId: 92256481,
        firstName: 'Delon',
        lastName: 'Nesselbach',
        shirtNumber: '30',
      });
    });
  });

  describe('where the Verband records the Kader only, with Anonyme Spieler (Niedersachsen)', () => {
    const report = mapGameReport(readEnvelope(rosterOnlyWithAnonymous));

    it('lists the Anonyme Spieler without number, name or person id', () => {
      const anonymousPlayers = (
        roster: Roster | undefined
      ): readonly RosterEntry[] =>
        (roster?.entries ?? []).filter((entry) => !isNamed(entry));

      expect(anonymousPlayers(report?.home)).toEqual([{ kind: 'anonymous' }]);
      expect(anonymousPlayers(report?.away)).toEqual([
        { kind: 'anonymous' },
        { kind: 'anonymous' },
        { kind: 'anonymous' },
      ]);
    });

    it('reads the named players with their shirt numbers, no Spielerwerte', () => {
      expect(report?.home.playerStatsRecorded).toBe(false);
      expect(report?.away.playerStatsRecorded).toBe(false);
      expect(report?.away.entries[0]).toEqual({
        kind: 'named',
        personId: expect.any(Number),
        firstName: 'Orvin',
        lastName: 'Nesselbach',
        shirtNumber: '7',
      });
    });
  });

  describe('where only one Kader has numbers', () => {
    const data = readEnvelope(withStats) as {
      matchBoxscore: { guestPlayerStats: Record<string, unknown>[] };
    };
    const withoutAwayStats = {
      ...data,
      matchBoxscore: {
        ...data.matchBoxscore,
        guestPlayerStats: data.matchBoxscore.guestPlayerStats.map((stats) => ({
          ...stats,
          pts: 0,
          fouls: 0,
          eff: 0,
          twoPoints: { made: 0, attempted: 0, quota: null },
          threePoints: { made: 0, attempted: 0, quota: null },
          onePoints: { made: 0, attempted: 0, quota: null },
        })),
      },
    };
    const report = mapGameReport(withoutAwayStats);

    it('decides per Kader', () => {
      expect(report?.home.playerStatsRecorded).toBe(true);
      expect(report?.away.playerStatsRecorded).toBe(false);
      expect(report && playerStatsRecorded(report)).toBe(true);
    });

    it('gives the unrecorded Kader no zeros', () => {
      expect(
        report?.away.entries.every((e) => e.playerStats === undefined)
      ).toBe(true);
      expect(
        report?.home.entries.every((e) => e.playerStats !== undefined)
      ).toBe(true);
    });
  });

  describe('an Anonymer Spieler', () => {
    const data = readEnvelope(rosterOnly) as {
      matchBoxscore: {
        homePlayerStats: {
          player: { anonym: boolean; person: Record<string, unknown> };
        }[];
      };
    };
    const [first] = data.matchBoxscore.homePlayerStats;

    it.each<[string, object, object]>([
      ['the player', { anonym: true }, {}],
      ['the person', {}, { anonym: true }],
      ['person id 0', {}, { id: 0 }],
    ])(
      'is one when %s says so, even with a name and id',
      (_case, player, person) => {
        const marked = {
          ...data,
          matchBoxscore: {
            ...data.matchBoxscore,
            homePlayerStats: [
              {
                ...first,
                player: {
                  ...first.player,
                  anonym: false,
                  ...player,
                  person: { ...first.player.person, anonym: false, ...person },
                },
              },
            ],
          },
        };

        expect(mapGameReport(marked)?.home.entries[0]).toEqual({
          kind: 'anonymous',
        });
      }
    );
  });

  it('refuses a status-0 envelope with no boxscore fields at all', () => {
    expect(caughtError(() => mapGameReport({})).message).toBe(
      'boxscore.matchId: expected a number, got nothing'
    );
  });

  it('reads a Spiel without a Kader yet as without Spielbericht', () => {
    expect(mapGameReport(readEnvelope(noReport))).toBeUndefined();
    expect(mapGameReport({ matchId: 1, matchBoxscore: null })).toBeUndefined();
  });

  it('refuses a named player without a person id', () => {
    const data = readEnvelope(rosterOnly) as {
      matchBoxscore: { homePlayerStats: { player: { person: object } }[] };
    };
    const [first] = data.matchBoxscore.homePlayerStats;
    const broken = {
      ...data,
      matchBoxscore: {
        ...data.matchBoxscore,
        homePlayerStats: [
          {
            ...first,
            player: {
              ...first.player,
              person: { vorname: 'A', nachname: 'B' },
            },
          },
        ],
      },
    };

    expect(caughtError(() => mapGameReport(broken)).message).toBe(
      'boxscore.matchBoxscore.homePlayerStats[0].player.person.id: expected a number, got nothing'
    );
  });
});
