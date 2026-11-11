import { childStep } from './child-step';
import {
  inLigaWithoutGameReports,
  PLAYED,
  saisonOf,
  spielOn,
} from '../../testing/team-saison';

describe('childStep', () => {
  it('leads to the last played Spiel', () => {
    const step = childStep(
      saisonOf(
        spielOn(1, '2026-09-20', PLAYED),
        spielOn(2, '2026-10-04', PLAYED),
        spielOn(3, '2026-11-15', { kind: 'scheduled' })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 2 });
  });

  it('passes over cancelled and forfeited Spiele, which have no Kader', () => {
    const step = childStep(
      saisonOf(
        spielOn(1, '2026-09-20', PLAYED),
        spielOn(2, '2026-10-04', { kind: 'cancelled' }),
        spielOn(3, '2026-10-11', { kind: 'forfeited', forfeitedBy: ['away'] })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 1 });
  });

  it('waits for the first Spiel where none was played', () => {
    const step = childStep(
      saisonOf(spielOn(1, '2026-11-15', { kind: 'scheduled' })),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'after-first-game' });
  });

  it('waits for the first Spiel of a Saison without Spiele', () => {
    expect(childStep(saisonOf(), '2026-11-08')).toEqual({
      kind: 'after-first-game',
    });
  });

  it('offers no link where the Team played only in a Liga without Spielberichte', () => {
    const step = childStep(
      inLigaWithoutGameReports(
        saisonOf(
          spielOn(1, '2026-09-20', PLAYED),
          spielOn(2, '2026-10-04', PLAYED)
        )
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'no-game-reports' });
  });

  it('leads to the last Spiel of a Liga with Spielberichte, passing over newer ones without', () => {
    const HAUPTRUNDE = 54900;
    const step = childStep(
      inLigaWithoutGameReports(
        saisonOf(spielOn(1, '2026-09-20', PLAYED), {
          ...spielOn(2, '2026-10-04', PLAYED),
          leagueId: HAUPTRUNDE,
        }),
        HAUPTRUNDE
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 1 });
  });
});
