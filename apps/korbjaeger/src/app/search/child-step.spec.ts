import type {
  Spiel,
  SpielStatus,
  TeamSaison,
} from '@wolsok/feat-shared-basketball-data';
import { childStep } from './child-step';

const WASBUETTEL = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };
const GIFHORN = { id: 201500, name: 'MTV Gifhorn', vereinId: 201500 };

const PLAYED: SpielStatus = {
  art: 'gespielt',
  ergebnis: { heim: 78, gast: 47 },
  bestaetigt: true,
};

function spiel(id: number, datum: string, status: SpielStatus): Spiel {
  return {
    id,
    ligaId: 54862,
    spieltag: 1,
    datum,
    heim: { art: 'team', team: WASBUETTEL },
    gast: { art: 'team', team: GIFHORN },
    status,
  };
}

function saison(...spiele: Spiel[]): TeamSaison {
  return {
    team: WASBUETTEL,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen: [],
    spiele,
  };
}

describe('childStep', () => {
  it('leads to the last played Spiel', () => {
    const step = childStep(
      saison(
        spiel(1, '2026-09-20', PLAYED),
        spiel(2, '2026-10-04', PLAYED),
        spiel(3, '2026-11-15', { art: 'geplant' })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 2 });
  });

  it('passes over cancelled and forfeited Spiele, which have no Kader', () => {
    const step = childStep(
      saison(
        spiel(1, '2026-09-20', PLAYED),
        spiel(2, '2026-10-04', { art: 'abgesagt' }),
        spiel(3, '2026-10-11', { art: 'kampflos', verzichtet: ['gast'] })
      ),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'mark', spielId: 1 });
  });

  it('waits for the first Spiel where none was played', () => {
    const step = childStep(
      saison(spiel(1, '2026-11-15', { art: 'geplant' })),
      '2026-11-08'
    );

    expect(step).toEqual({ kind: 'after-first-game' });
  });

  it('waits for the first Spiel of a Saison without Spiele', () => {
    expect(childStep(saison(), '2026-11-08')).toEqual({
      kind: 'after-first-game',
    });
  });
});
