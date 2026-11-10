import { childStep } from './child-step';
import { PLAYED, saisonOf, spielOn } from '../../testing/team-saison';

describe('childStep', () => {
  it('leads to the last played Spiel', () => {
    const step = childStep(
      saisonOf(
        spielOn(1, '2026-09-20', PLAYED),
        spielOn(2, '2026-10-04', PLAYED),
        spielOn(3, '2026-11-15', { art: 'geplant' })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 2 });
  });

  it('passes over cancelled and forfeited Spiele, which have no Kader', () => {
    const step = childStep(
      saisonOf(
        spielOn(1, '2026-09-20', PLAYED),
        spielOn(2, '2026-10-04', { art: 'abgesagt' }),
        spielOn(3, '2026-10-11', { art: 'kampflos', verzichtet: ['gast'] })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 1 });
  });

  it('waits for the first Spiel where none was played', () => {
    const step = childStep(
      saisonOf(spielOn(1, '2026-11-15', { art: 'geplant' })),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'after-first-game' });
  });

  it('waits for the first Spiel of a Saison without Spiele', () => {
    expect(childStep(saisonOf(), '2026-11-08')).toEqual({
      kind: 'after-first-game',
    });
  });
});
