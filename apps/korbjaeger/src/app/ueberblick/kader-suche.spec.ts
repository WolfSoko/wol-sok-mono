import type { Spiel, Team } from '@wolsok/feat-shared-basketball-data';
import { gleicherAuftrag } from './kader-suche';

const WASBUETTEL: Team = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };
const GIFHORN: Team = { id: 201500, name: 'MTV Gifhorn', vereinId: 1500 };

const LUMI = 4711;
const MORVO = 4712;

function spiel(id: number): Spiel {
  return {
    id,
    ligaId: 54862,
    spieltag: 1,
    datum: '2026-11-01',
    heim: { art: 'team', team: WASBUETTEL },
    gast: { art: 'team', team: GIFHORN },
    status: {
      art: 'gespielt',
      ergebnis: { heim: 50, gast: 40 },
      bestaetigt: true,
    },
  };
}

describe('gleicherAuftrag', () => {
  const auftrag = {
    team: WASBUETTEL.id,
    spiele: [spiel(2), spiel(1)],
    kinder: [LUMI],
  };

  it('takes an order for the same Spiele and Kinder as the same', () => {
    expect(
      gleicherAuftrag(auftrag, { ...auftrag, spiele: [spiel(2), spiel(1)] })
    ).toBe(true);
  });

  it.each([
    ['another Team', { ...auftrag, team: GIFHORN.id }],
    ['another Spiel', { ...auftrag, spiele: [spiel(3), spiel(2)] }],
    ['another Kind', { ...auftrag, kinder: [LUMI, MORVO] }],
    ['none', undefined],
  ])('tells an order for %s apart', (_fall, anderer) => {
    expect(gleicherAuftrag(auftrag, anderer)).toBe(false);
  });

  it('searches no more for a Kind unmarked: the others were looked for', () => {
    const beide = { ...auftrag, kinder: [LUMI, MORVO] };

    expect(gleicherAuftrag(beide, auftrag)).toBe(true);
    expect(gleicherAuftrag(beide, { ...auftrag, kinder: [MORVO] })).toBe(true);
  });
});
