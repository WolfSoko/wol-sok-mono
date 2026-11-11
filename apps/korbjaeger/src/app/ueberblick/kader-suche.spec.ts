import type { Game, Team } from '@wolsok/feat-shared-basketball-data';
import { gleicherAuftrag } from './kader-suche';

const WASBUETTEL: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };
const GIFHORN: Team = { id: 201500, name: 'MTV Gifhorn', clubId: 1500 };

const LUMI = 4711;
const MORVO = 4712;

function spiel(id: number): Game {
  return {
    id,
    leagueId: 54862,
    matchday: 1,
    date: '2026-11-01',
    home: { kind: 'team', team: WASBUETTEL },
    away: { kind: 'team', team: GIFHORN },
    status: {
      kind: 'played',
      result: { home: 50, away: 40 },
      confirmed: true,
    },
  };
}

describe('gleicherAuftrag', () => {
  const auftrag = {
    team: WASBUETTEL.id,
    games: [spiel(2), spiel(1)],
    children: [LUMI],
  };

  it('takes an order for the same Spiele and Kinder as the same', () => {
    expect(
      gleicherAuftrag(auftrag, { ...auftrag, games: [spiel(2), spiel(1)] })
    ).toBe(true);
  });

  it.each([
    ['another Team', { ...auftrag, team: GIFHORN.id }],
    ['another Spiel', { ...auftrag, games: [spiel(3), spiel(2)] }],
    ['another Kind', { ...auftrag, children: [LUMI, MORVO] }],
    ['none', undefined],
  ])('tells an order for %s apart', (_fall, anderer) => {
    expect(gleicherAuftrag(auftrag, anderer)).toBe(false);
  });

  it('searches no more for a Kind unmarked: the others were looked for', () => {
    const beide = { ...auftrag, children: [LUMI, MORVO] };

    expect(gleicherAuftrag(beide, auftrag)).toBe(true);
    expect(gleicherAuftrag(beide, { ...auftrag, children: [MORVO] })).toBe(
      true
    );
  });
});
