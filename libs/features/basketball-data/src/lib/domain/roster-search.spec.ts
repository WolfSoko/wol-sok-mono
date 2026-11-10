import type { BasketballData } from '../basketball-data';
import { BasketballDataError } from './basketball-data-error';
import { searchRosters } from './roster-search';
import type { Game } from './game';
import type { NamedPlayer, GameReport } from './game-report';
import type { Team } from './team';

const WASBUETTEL: Team = { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 };
const GIFHORN: Team = { id: 201500, name: 'MTV Gifhorn', clubId: 1500 };

function player(personId: number, firstName: string): NamedPlayer {
  return { kind: 'named', personId, firstName, lastName: 'Ahornwiese' };
}

const LUMI = player(4711, 'Lumi');
const MORVO = player(4712, 'Morvo');
const NELKA = player(4713, 'Nelka');

function game(id: number, home: Team = WASBUETTEL, away: Team = GIFHORN): Game {
  return {
    id,
    leagueId: 54862,
    matchday: 1,
    date: '2026-11-01',
    home: { kind: 'team', team: home },
    away: { kind: 'team', team: away },
    status: {
      kind: 'played',
      result: { home: 50, away: 40 },
      confirmed: true,
    },
  };
}

function report(
  gameId: number,
  home: readonly NamedPlayer[],
  away: readonly NamedPlayer[] = []
): GameReport {
  return {
    gameId,
    home: {
      playerStatsRecorded: false,
      entries: [...home, { kind: 'anonymous' }],
    },
    away: { playerStatsRecorded: false, entries: [...away] },
  };
}

type ReportRead = BasketballData['gameReport'];

/** Answers each Spiel's Spielbericht from `reports`; one not listed has none. */
function data(reports: Readonly<Record<number, GameReport | Error>>): {
  readonly gameReport: jest.Mock<
    ReturnType<ReportRead>,
    Parameters<ReportRead>
  >;
} {
  return {
    gameReport: jest.fn<ReturnType<ReportRead>, Parameters<ReportRead>>(
      async (gameId) => {
        const answer = reports[gameId];
        if (answer instanceof Error) {
          throw answer;
        }
        return answer;
      }
    ),
  };
}

function wasRead(finds: Awaited<ReturnType<typeof searchRosters>>) {
  return [...finds.games].map(([gameId, children]) => [
    gameId,
    children && Object.fromEntries(children),
  ]);
}

describe('searchRosters', () => {
  it('reads only the last Spiel where every Kind is on its Kader', async () => {
    const source = data({
      3: report(3, [LUMI, MORVO]),
      2: report(2, [LUMI]),
    });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(3), game(2)],
      children: [LUMI.personId, MORVO.personId],
    });

    expect(wasRead(finds)).toEqual([
      [3, { [LUMI.personId]: 'Lumi', [MORVO.personId]: 'Morvo' }],
    ]);
    expect(finds.incomplete).toBe(false);
    expect(source.gameReport).toHaveBeenCalledTimes(1);
  });

  it('reads on two at a time, newest first, until each Kind was found', async () => {
    const source = data({
      5: report(5, [LUMI]),
      3: report(3, [MORVO]),
    });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(5), game(4), game(3), game(2), game(1)],
      children: [LUMI.personId, MORVO.personId],
    });

    expect(wasRead(finds)).toEqual([
      [5, { [LUMI.personId]: 'Lumi' }],
      [4, undefined],
      [3, { [MORVO.personId]: 'Morvo' }],
    ]);
    expect(source.gameReport).toHaveBeenCalledTimes(3);
  });

  it('reads every Spiel given, two at a time at most, where a Kind is in none', async () => {
    const source = data({});
    let running = 0;
    let atMost = 0;
    source.gameReport.mockImplementation(async () => {
      running++;
      atMost = Math.max(atMost, running);
      await new Promise((resolve) => setTimeout(resolve));
      running--;
      return undefined;
    });

    await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(5), game(4), game(3), game(2), game(1)],
      children: [LUMI.personId],
    });

    expect(source.gameReport).toHaveBeenCalledTimes(5);
    expect(atMost).toBe(2);
  });

  it('reads no further after a batch with a failed read', async () => {
    const source = data({
      5: report(5, []),
      4: new BasketballDataError('offline', 'no network'),
      3: report(3, []),
      2: report(2, [LUMI]),
    });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(5), game(4), game(3), game(2)],
      children: [LUMI.personId],
    });

    expect(wasRead(finds)).toEqual([
      [5, {}],
      [3, {}],
    ]);
    expect(finds.incomplete).toBe(true);
    expect(source.gameReport).toHaveBeenCalledTimes(3);
  });

  it('passes over a Spielbericht the DBB does not know, as one not there yet', async () => {
    const source = data({
      3: new BasketballDataError('not-found', 'no boxscore'),
      2: new BasketballDataError('not-found', 'no boxscore'),
      1: report(1, [LUMI]),
    });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(3), game(2), game(1)],
      children: [LUMI.personId],
    });

    expect(wasRead(finds)).toEqual([
      [3, undefined],
      [2, undefined],
      [1, { [LUMI.personId]: 'Lumi' }],
    ]);
    expect(finds.incomplete).toBe(false);
  });

  it('reads every Spiel given where a Kind is in none, and no more', async () => {
    const source = data({ 2: report(2, [NELKA]), 1: report(1, [NELKA]) });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(2), game(1)],
      children: [LUMI.personId],
    });

    expect(wasRead(finds)).toEqual([
      [2, {}],
      [1, {}],
    ]);
    expect(finds.incomplete).toBe(false);
  });

  it("looks only into the Team's own Kader, never the opponent's", async () => {
    const source = data({ 2: report(2, [], [LUMI]), 1: report(1, [LUMI]) });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      // the Team plays away in Spiel 1
      games: [game(2), game(1, GIFHORN, WASBUETTEL)],
      children: [LUMI.personId],
    });

    expect(wasRead(finds)).toEqual([
      [2, {}],
      [1, {}],
    ]);
  });

  it('reads nothing while no Kind is marked', async () => {
    const source = data({});

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(2)],
      children: [],
    });

    expect(finds.games.size).toBe(0);
    expect(source.gameReport).not.toHaveBeenCalled();
  });

  it('keeps what the other reads found where one failed, and says the search is incomplete', async () => {
    const source = data({
      3: report(3, []),
      2: new BasketballDataError('offline', 'no network'),
      1: report(1, [LUMI]),
    });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(3), game(2), game(1)],
      children: [LUMI.personId],
    });

    expect(wasRead(finds)).toEqual([
      [3, {}],
      [1, { [LUMI.personId]: 'Lumi' }],
    ]);
    expect(finds.incomplete).toBe(true);
  });

  it('reads no further where the last Spiel failed', async () => {
    const source = data({
      2: new BasketballDataError('unavailable', 'DBB down'),
      1: report(1, [LUMI]),
    });

    const finds = await searchRosters(source, {
      team: WASBUETTEL.id,
      games: [game(2), game(1)],
      children: [LUMI.personId],
    });

    expect(finds.games.size).toBe(0);
    expect(finds.incomplete).toBe(true);
    expect(source.gameReport).toHaveBeenCalledTimes(1);
  });

  it('gives up a search that was cancelled', async () => {
    const cancel = new AbortController();
    const source = data({});
    source.gameReport.mockImplementation(async () => {
      cancel.abort();
      throw new DOMException('aborted', 'AbortError');
    });

    await expect(
      searchRosters(
        source,
        { team: WASBUETTEL.id, games: [game(1)], children: [LUMI.personId] },
        { signal: cancel.signal }
      )
    ).rejects.toThrow('aborted');
  });
});
