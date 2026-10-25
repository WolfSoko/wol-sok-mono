import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { FakeGameBoards, topRowsOf } from '../../testing/fake-game-boards';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { defaultProfile } from '../social/profile';
import type { BoardEntry } from '../state/boards';
import { GameAccount } from '../storage/game-account';
import type { BoardTop, PagedEntry } from '../storage/game-boards';
import { GameCloud } from '../storage/game-cloud';
import { BoardsService, idOfBoard, ownPlace } from './boards.service';

function anEntry(
  entryId: string,
  sort: number,
  changes: Partial<BoardEntry> = {}
): PagedEntry {
  return {
    entryId,
    sort,
    atHour: 0,
    status: 'counted',
    name: null,
    tag: 1234,
    avatar: 1,
    show: { xp: sort, rank: 'spore' },
    ...changes,
  };
}

function xpTop(entries: PagedEntry[]): BoardTop {
  return {
    cut: 0,
    rows: topRowsOf(entries, 0),
    final: false,
  };
}

describe('BoardsService', () => {
  let boards: FakeGameBoards;
  let social: FakeGameSocial;

  function configure(withBoards: boolean): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            boards: () => (withBoards ? boards : null),
            social: () => (withBoards ? social : null),
            presence: () => new FakeGamePresence(),
            rooms: () => null,
          },
        },
      ],
    });
  }

  function service(): BoardsService {
    return TestBed.inject(BoardsService);
  }

  beforeEach(() => {
    boards = new FakeGameBoards();
    social = new FakeGameSocial();
    configure(true);
  });

  it('names the boards by their kind and day', () => {
    expect(idOfBoard({ kind: 'xp' })).toBe('xp');
    expect(idOfBoard({ kind: 'daily', day: '2026-10-24' })).toBe(
      'daily-2026-10-24'
    );
  });

  it('has no boards without the cloud', async () => {
    configure(false);

    expect(service().available).toBe(false);
    expect(await firstValueFrom(service().watchTop({ kind: 'xp' }))).toBeNull();
    expect(await service().ownStanding({ kind: 'xp' }, null)).toEqual({
      on: false,
      reason: 'none',
    });
  });

  it('pages on by order, ties sharing a position', async () => {
    const entries = [
      anEntry('a', 50),
      anEntry('b', 40),
      anEntry('c', 30),
      anEntry('d', 30),
      anEntry('e', 20),
    ];
    boards.setEntries('xp', entries);
    const [first, second] = topRowsOf(entries.slice(0, 2), 0);

    const page = await service().page({ kind: 'xp' }, second, 2);

    expect(first.pos).toBe(1);
    expect(page.map((row) => [row.entryId, row.pos])).toEqual([
      ['c', 3],
      ['d', 3],
      ['e', 5],
    ]);
  });

  it("takes the player's position from the top document", async () => {
    const entries = [anEntry('a', 50), anEntry('mine', 40)];
    boards.setEntries('xp', entries);
    boards.setMember('ada', { entryIds: { xp: 'mine' } });
    const top = xpTop(entries);

    const own = await service().ownStanding({ kind: 'xp' }, top);

    expect(own).toEqual({
      on: true,
      entryId: 'mine',
      entry: expect.objectContaining({ sort: 40 }),
      above: null,
    });
    expect(own.on && ownPlace(own, top.rows)).toEqual({
      entry: expect.objectContaining({ sort: 40 }),
      pos: 2,
      rank: null,
    });
    expect(boards.counts).toEqual([]);
  });

  it("counts the player's position below the top 50, without a scan", async () => {
    const entries = [
      ...Array.from({ length: 60 }, (_, i) => anEntry(`e${i}`, 1000 - i)),
      anEntry('mine', 10),
    ];
    boards.setEntries('xp', entries);
    boards.setMember('ada', { entryIds: { xp: 'mine' } });
    const top = xpTop(entries);

    const own = await service().ownStanding({ kind: 'xp' }, top);

    expect(own.on && ownPlace(own, top.rows).pos).toBe(61);
    expect(boards.counts).toEqual([['xp', 10]]);
  });

  it('places the own row by the live top once it is among its rows', () => {
    const entries = [anEntry('a', 50), anEntry('mine', 60)];
    const own = {
      on: true as const,
      entryId: 'mine',
      entry: entries[1],
      above: 70,
    };

    expect(ownPlace(own, xpTop(entries).rows).pos).toBe(1);
    expect(ownPlace(own, xpTop([entries[0]]).rows).pos).toBe(71);
    expect(
      ownPlace({ ...own, above: null }, xpTop([entries[0]]).rows).pos
    ).toBe(1);
  });

  it('waits for the guest to sign in before it reads a board', async () => {
    TestBed.overrideProvider(GameAccount, {
      useValue: new FakeGameAccount(null),
    });
    const account = TestBed.inject(GameAccount) as FakeGameAccount;
    const watched = jest.spyOn(boards, 'watchTop');
    const paged = jest.spyOn(boards, 'page');
    const tops: (BoardTop | null)[] = [];
    const entries = [anEntry('a', 50), anEntry('b', 40)];
    boards.setEntries('xp', entries);
    boards.setTop('xp', xpTop(entries));

    const subscription = service()
      .watchTop({ kind: 'xp' })
      .subscribe((top) => tops.push(top));
    const page = service().page({ kind: 'xp' }, xpTop(entries).rows[0], 1);
    await Promise.resolve();

    expect(watched).not.toHaveBeenCalled();
    expect(paged).not.toHaveBeenCalled();

    account.switchTo('ada');

    expect(tops).toHaveLength(1);
    expect((await page).map((row) => row.entryId)).toEqual(['b']);
    subscription.unsubscribe();
  });

  it('is not on a board without a result there', async () => {
    expect(await service().ownStanding({ kind: 'xp' }, null)).toEqual({
      on: false,
      reason: 'none',
    });

    // The entry ids come for every kind at once; the boards list says
    // where the player is.
    boards.setMember('ada', {
      entryIds: { xp: 'x1', daily: 'd1' },
      boards: ['xp'],
    });
    expect(
      await service().ownStanding({ kind: 'daily', day: '2026-10-24' }, null)
    ).toEqual({ on: false, reason: 'none' });
  });

  it('is not on a board whose entry the functions deleted', async () => {
    // Listed in the membership, but the entry is gone: the rules read a
    // missing entry as not found, and it has no counted result.
    boards.setMember('ada', { entryIds: { endless: 'gone' } });

    expect(await service().ownStanding({ kind: 'endless' }, null)).toEqual({
      on: false,
      reason: 'none',
    });
  });

  it('says the own entry is hidden, by the owner or the rules', async () => {
    boards.setEntries('online', [anEntry('hid', 5, { status: 'hidden' })]);
    boards.setMember('ada', { entryIds: { online: 'hid' } });

    expect(await service().ownStanding({ kind: 'online' }, null)).toEqual({
      on: false,
      reason: 'hidden',
    });

    boards.setEntries('xp', [anEntry('mine', 5)]);
    boards.setMember('ada', { entryIds: { xp: 'mine' }, barred: ['xp'] });
    expect(await service().ownStanding({ kind: 'xp' }, null)).toEqual({
      on: false,
      reason: 'hidden',
    });
  });

  it('says the player keeps off the boards', async () => {
    boards.setEntries('xp', [anEntry('mine', 5)]);
    boards.setMember('ada', { entryIds: { xp: 'mine' } });
    await social.saveProfile('ada', {
      ...defaultProfile('ada'),
      boardOptOut: true,
    });
    TestBed.tick();

    expect(service().optedOut()).toBe(true);
    expect(await service().ownStanding({ kind: 'xp' }, null)).toEqual({
      on: false,
      reason: 'optedOut',
    });
  });
});
