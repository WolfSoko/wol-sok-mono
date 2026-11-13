import type { GameDetails, League } from '@wolsok/feat-shared-basketball-data';
import { checkedChildStep, childStep } from './child-step';
import { PLAYED, seasonOf, gameOn } from '../../testing/team-season';

describe('childStep', () => {
  it('leads to the last played Spiel', () => {
    const step = childStep(
      seasonOf(
        gameOn(1, '2026-09-20', PLAYED),
        gameOn(2, '2026-10-04', PLAYED),
        gameOn(3, '2026-11-15', { kind: 'scheduled' })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', gameId: 2 });
  });

  it('passes over cancelled and forfeited Spiele, which have no Kader', () => {
    const step = childStep(
      seasonOf(
        gameOn(1, '2026-09-20', PLAYED),
        gameOn(2, '2026-10-04', { kind: 'cancelled' }),
        gameOn(3, '2026-10-11', { kind: 'forfeited', forfeitedBy: ['away'] })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', gameId: 1 });
  });

  it('waits for the first Spiel where none was played', () => {
    const step = childStep(
      seasonOf(gameOn(1, '2026-11-15', { kind: 'scheduled' })),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'after-first-game' });
  });

  it('waits for the first Spiel of a Saison without Spiele', () => {
    expect(childStep(seasonOf(), '2026-11-08')).toEqual({
      kind: 'after-first-game',
    });
  });
});

describe('checkedChildStep', () => {
  const LEAGUE: League = {
    id: 54862,
    name: 'Regionsvorrunde Nord',
    association: { id: 7, name: 'Niedersachsen' },
    ageGroup: 'U12',
    gender: 'mixed',
    division: 'Kreisliga',
  };

  function detailsOf(gameId: number, league: League): GameDetails {
    return {
      game: gameOn(gameId, '2026-10-04'),
      league,
      quarters: [],
      overtimes: [],
    };
  }

  it("offers no link where the Spiel's Liga keeps no Spielberichte", () => {
    expect(
      checkedChildStep(
        { kind: 'mark', gameId: 2 },
        detailsOf(2, { ...LEAGUE, withoutGameReports: true })
      )
    ).toEqual({ kind: 'no-game-reports' });
  });

  it('keeps the link where the Liga keeps them', () => {
    expect(
      checkedChildStep({ kind: 'mark', gameId: 2 }, detailsOf(2, LEAGUE))
    ).toEqual({ kind: 'mark', gameId: 2 });
  });

  it('keeps the link while the details are not read, or are of another Spiel', () => {
    const without = detailsOf(1, { ...LEAGUE, withoutGameReports: true });

    expect(checkedChildStep({ kind: 'mark', gameId: 2 }, undefined)).toEqual({
      kind: 'mark',
      gameId: 2,
    });
    expect(checkedChildStep({ kind: 'mark', gameId: 2 }, without)).toEqual({
      kind: 'mark',
      gameId: 2,
    });
  });

  it('leaves waiting for the first Spiel as it is', () => {
    expect(checkedChildStep({ kind: 'after-first-game' }, undefined)).toEqual({
      kind: 'after-first-game',
    });
  });
});
