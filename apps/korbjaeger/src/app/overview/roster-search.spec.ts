import type { Game, Team } from '@wolsok/feat-shared-basketball-data';
import { sameJob } from './roster-search';

const WASBUETTEL: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };
const GIFHORN: Team = { id: 201500, name: 'MTV Gifhorn', clubId: 1500 };

const LUMI = 4711;
const MORVO = 4712;

function game(id: number): Game {
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

describe('sameJob', () => {
  const job = {
    team: WASBUETTEL.id,
    games: [game(2), game(1)],
    children: [LUMI],
  };

  it('takes an order for the same Spiele and Kinder as the same', () => {
    expect(sameJob(job, { ...job, games: [game(2), game(1)] })).toBe(true);
  });

  it.each([
    ['another Team', { ...job, team: GIFHORN.id }],
    ['another Spiel', { ...job, games: [game(3), game(2)] }],
    ['another Kind', { ...job, children: [LUMI, MORVO] }],
    ['none', undefined],
  ])('tells an order for %s apart', (_fall, anderer) => {
    expect(sameJob(job, anderer)).toBe(false);
  });

  it('searches no more for a Kind unmarked: the others were looked for', () => {
    const beide = { ...job, children: [LUMI, MORVO] };

    expect(sameJob(beide, job)).toBe(true);
    expect(sameJob(beide, { ...job, children: [MORVO] })).toBe(true);
  });
});
