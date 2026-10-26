import { ComponentFixture, TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { FakeGameBoards, topRowsOf } from '../../testing/fake-game-boards';
import {
  FakeGamePresence,
  FakeGameSocial,
} from '../../testing/fake-game-social';
import { I18nService } from '../i18n/i18n.service';
import { defaultProfile } from '../social/profile';
import type { BoardEntry, BoardRef } from '../state/boards';
import { GameAccount } from '../storage/game-account';
import type { PagedEntry } from '../storage/game-boards';
import { GameCloud } from '../storage/game-cloud';
import { BoardViewComponent } from './board-view.component';
import { BoardsService } from './boards.service';
import { LeaderboardsComponent } from './leaderboards.component';

const DAY = '2026-10-24';
const DAILY: BoardRef = { kind: 'daily', day: DAY };

function anEntry(
  entryId: string,
  sort: number,
  changes: Partial<BoardEntry> = {}
): PagedEntry {
  return {
    entryId,
    sort,
    atHour: 0,
    status: 'verified',
    name: null,
    tag: 4821,
    avatar: 2,
    show: { ticks: 3720, won: true },
    ...changes,
  };
}

function anXpEntry(entryId: string, xp: number): PagedEntry {
  return anEntry(entryId, xp, {
    status: 'counted',
    show: { xp, rank: 'spore' },
  });
}

/** Lets the fakes' promises and the effects through. */
async function settle(fixture: ComponentFixture<unknown>): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await fixture.whenStable();
    fixture.detectChanges();
  }
}

describe('Leaderboards', () => {
  let boards: FakeGameBoards;
  let social: FakeGameSocial;

  function configure(withCloud: boolean): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: new FakeGameAccount('ada') },
        {
          provide: GameCloud,
          useValue: {
            boards: () => (withCloud ? boards : null),
            social: () => (withCloud ? social : null),
            presence: () => new FakeGamePresence(),
            rooms: () => null,
            moderation: () => null,
          },
        },
      ],
    });
    TestBed.inject(I18nService).setLanguage('en');
  }

  beforeEach(() => {
    localStorage.clear();
    boards = new FakeGameBoards();
    social = new FakeGameSocial();
    configure(true);
  });

  async function renderBoard(
    board: BoardRef
  ): Promise<{ host: HTMLElement; fixture: ComponentFixture<unknown> }> {
    const fixture = TestBed.createComponent(BoardViewComponent);
    fixture.componentRef.setInput('board', board);
    await settle(fixture);
    return { host: fixture.nativeElement as HTMLElement, fixture };
  }

  async function textOf(board: BoardRef): Promise<string> {
    return (await renderBoard(board)).host.textContent ?? '';
  }

  function setDaily(entries: PagedEntry[], final = false): void {
    boards.setEntries(`daily-${DAY}`, entries);
    boards.setTop(`daily-${DAY}`, {
      cut: 10,
      rows: topRowsOf(entries, 10),
      final,
    });
  }

  function setXp(entries: PagedEntry[]): void {
    boards.setEntries('xp', entries);
    boards.setTop('xp', {
      cut: 0,
      rows: topRowsOf(entries, 0),
    });
  }

  it('shows the XP board with names and anonymous tags', async () => {
    setXp([
      { ...anXpEntry('a', 5000), name: 'Ada' },
      { ...anXpEntry('b', 1200), tag: 42 },
    ]);

    const text = await textOf({ kind: 'xp' });

    expect(text).toContain('The server works the XP out');
    expect(text).toMatch(/#1\s*Ada/);
    expect(text).toContain('5,000 XP');
    expect(text).toMatch(/#2\s*Anonymous #0042/);
  });

  it('shows the verified places, then the claims being checked, then everyone else', async () => {
    setDaily([
      anEntry('claim', 10_000_900, { status: 'provisional', tag: 1111 }),
      anEntry('first', 10_000_800, { name: 'Ada' }),
      anEntry('stale', 100, { status: 'stale', tag: 2222 }),
    ]);

    const text = await textOf(DAILY);

    expect(text).toContain('The top 10 were played again by the server');
    expect(text).toMatch(/#1\s*Ada/);
    expect(text).toContain('Won in 1:02');
    expect(text).toContain('Being checked');
    expect(text).toContain('Anonymous #1111');
    expect(text).toContain('Everyone else');
    expect(text).toMatch(/#3\s*Anonymous #2222/);
    expect(text).toContain('Older version');
    expect(text).not.toContain('Final');
  });

  it("marks a finished day's board as final", async () => {
    setDaily([anEntry('first', 10_000_800)], true);

    const { host } = await renderBoard(DAILY);

    expect(host.querySelector('.final')?.textContent?.trim()).toBe('Final');
  });

  it('never names a claim nobody checked', async () => {
    setDaily([
      anEntry('claim', 10_000_900, { status: 'provisional', name: 'Eve' }),
    ]);

    const text = await textOf(DAILY);

    expect(text).not.toContain('Eve');
    expect(text).toContain('Anonymous #4821');
  });

  it('says an empty board is empty - without a top document too', async () => {
    const text = await textOf({ kind: 'endless' });

    expect(text).toContain('Nobody on this board yet.');
    expect(text).toContain('Not on this board yet: no counted result yet');
    expect(text).not.toContain('Show more');
  });

  it('says when the board cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest
      .spyOn(boards, 'watchTop')
      .mockReturnValue(throwError(() => new Error('refused')));

    expect(await textOf({ kind: 'xp' })).toContain(
      'The board could not be loaded.'
    );
  });

  it("pins the player's own row under the board", async () => {
    setDaily([
      anEntry('first', 10_000_800),
      anEntry('mine', 500, { status: 'provisional' }),
    ]);
    boards.setMember('ada', {
      entryIds: { daily: 'mine' },
      boards: [`daily-${DAY}`],
    });

    expect(await textOf(DAILY)).toContain('You: #2, being checked');
  });

  it('says when the own entry is hidden, never that it does not count', async () => {
    setXp([anXpEntry('a', 100)]);
    boards.setMember('ada', { entryIds: { xp: 'mine' }, barred: ['xp'] });

    const text = await textOf({ kind: 'xp' });

    expect(text).toContain('Your entry on this board is hidden.');
    expect(text).not.toMatch(/count/i);
  });

  it('says the player keeps off the leaderboards', async () => {
    setXp([anXpEntry('mine', 100)]);
    boards.setMember('ada', { entryIds: { xp: 'mine' } });
    await social.saveProfile('ada', {
      ...defaultProfile('ada'),
      boardOptOut: true,
    });

    expect(await textOf({ kind: 'xp' })).toContain(
      'Not on this board yet: you keep off the leaderboards (Profile)'
    );
  });

  it('pages past the top 50, positions counted on', async () => {
    const entries = Array.from({ length: 60 }, (_, i) =>
      anXpEntry(`e${i}`, 10_000 - i)
    );
    setXp(entries);
    boards.setMember('ada', { entryIds: { xp: 'e57' } });
    const { host, fixture } = await renderBoard({ kind: 'xp' });
    const items = () => host.querySelectorAll('mat-list-item').length;
    expect(items()).toBe(50);
    expect(host.textContent).toContain('You: #58');

    const more = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Show more')
    ) as HTMLButtonElement;
    more.click();
    await settle(fixture);

    expect(items()).toBe(60);
    expect(host.textContent).toMatch(/#60\s*Anonymous/);

    more.click();
    await settle(fixture);
    expect(host.textContent).not.toContain('Show more');
  });

  it('keeps the pages and the own row while the top changes, not its end', async () => {
    const entries = Array.from({ length: 60 }, (_, i) =>
      anXpEntry(`e${i}`, 10_000 - i)
    );
    setXp(entries);
    boards.setMember('ada', { entryIds: { xp: 'e57' } });
    const standing = jest.spyOn(TestBed.inject(BoardsService), 'ownStanding');
    const { host, fixture } = await renderBoard({ kind: 'xp' });
    const items = () => host.querySelectorAll('mat-list-item').length;
    (
      Array.from(host.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Show more')
      ) as HTMLButtonElement
    ).click();
    await settle(fixture);
    expect(items()).toBe(60);

    // A row inside the top changes; its last row stays.
    setXp([{ ...entries[0], name: 'Ada' }, ...entries.slice(1)]);
    await settle(fixture);

    expect(host.textContent).toContain('Ada');
    expect(items()).toBe(60);
    expect(standing).toHaveBeenCalledTimes(1);
    expect(host.textContent).toContain('You: #58');

    // The own entry climbs into the top: read again, the pages start over.
    setXp(
      entries.map((entry) =>
        entry.entryId === 'e57' ? anXpEntry('e57', 20_000) : entry
      )
    );
    await settle(fixture);

    expect(standing).toHaveBeenCalledTimes(2);
    expect(items()).toBe(50);
    expect(host.textContent).toContain('You: #1');
  });

  it('shows the online record and the win rate after ten matches', async () => {
    const entries = [
      anEntry('a', 1, {
        status: 'counted',
        show: { w: 8, l: 2, d: 0, nr: 1 },
      }),
    ];
    boards.setEntries('online', entries);
    boards.setTop('online', {
      cut: 0,
      rows: topRowsOf(entries, 0),
    });

    expect(await textOf({ kind: 'online' })).toContain(
      'W 8 · L 2 · D 0 · 80% won · Not reported: 1'
    );
  });

  it('speaks German', async () => {
    TestBed.inject(I18nService).setLanguage('de');
    setXp([anXpEntry('b', 1200)]);

    const text = await textOf({ kind: 'xp' });

    expect(text).toContain('Anonym #4821');
    expect(text).toContain('Noch nicht in dieser Liste');
  });

  it('has a tab per board', async () => {
    const fixture = TestBed.createComponent(LeaderboardsComponent);
    await settle(fixture);
    const tabs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('[role="tab"]'),
      (tab) => tab.textContent?.trim()
    );

    expect(tabs).toEqual(['Rank', 'Online', 'Daily', 'Endless']);
  });

  it('says boards need the online game without the cloud', async () => {
    configure(false);
    const fixture = TestBed.createComponent(LeaderboardsComponent);
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Leaderboards need the online game'
    );
  });
});
