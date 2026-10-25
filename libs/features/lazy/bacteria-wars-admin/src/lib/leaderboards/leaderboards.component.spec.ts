import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminActionsService } from '../moderation/admin-actions.service';
import type { BoardEntryRecord } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { LeaderboardsComponent, utcDay } from './leaderboards.component';

const row = (
  entryId: string,
  extra: Partial<BoardEntryRecord> = {}
): BoardEntryRecord => ({
  entryId,
  status: 'counted',
  hiddenBy: [],
  name: null,
  sort: 1,
  tag: 42,
  atHour: 1,
  show: { xp: 1234, rank: 'gold' },
  ...extra,
});

function render() {
  const boardEntries = jest.fn(async (boardId: string) => ({
    rows:
      boardId === 'xp'
        ? [
            row('e2', {
              status: 'hidden',
              hiddenBy: ['admin', 'ban'],
              sort: 9,
            }),
            row('e1', { name: 'Ada', sort: 5 }),
            row('e3', { sort: 5 }),
          ]
        : [
            row('d1', { show: { ticks: 900, won: true } }),
            row('d2', { show: { depth: 4, seconds: 60, partial: true } }),
          ],
    next: null,
  }));
  const entryOwners = jest.fn(async (_kind: string, ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, id === 'e1' ? 'ada' : null]))
  );
  const run = jest.fn(async () => ({ ok: true }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminRecordsService, useValue: { boardEntries, entryOwners } },
      { provide: AdminActionsService, useValue: { run } },
    ],
  });
  const fixture = TestBed.createComponent(LeaderboardsComponent);
  const element: HTMLElement = fixture.nativeElement;
  // The owner lookups start from an effect, after the page arrived.
  const settle = async () => {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  const buttons = (label: string) =>
    [...element.querySelectorAll('td button')].filter((b) =>
      b.textContent?.includes(label)
    ) as HTMLButtonElement[];
  return { fixture, element, boardEntries, entryOwners, run, settle, buttons };
}

describe('LeaderboardsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('takes the day in UTC', () => {
    expect(utcDay(Date.UTC(2026, 9, 25, 23, 59))).toBe('2026-10-25');
  });

  it('lists a board with hidden rows and each row’s player', async () => {
    const { element, boardEntries, entryOwners, settle } = render();
    await settle();
    expect(boardEntries).toHaveBeenCalledWith('xp', null);
    expect(entryOwners).toHaveBeenCalledTimes(1);
    expect(entryOwners).toHaveBeenCalledWith('xp', ['e2', 'e1', 'e3']);
    // Positions as players see them: the hidden row has none, ties share.
    const positions = [...element.querySelectorAll('tbody tr')].map((tr) =>
      tr.querySelector('td')?.textContent?.trim()
    );
    expect(positions).toEqual(['-', '1', '1']);
    const text = element.textContent ?? '';
    expect(text).toContain('Ada');
    expect(text).toContain('Anonymous #0042');
    expect(text).toContain('1,234 XP');
    expect(text).toContain('owner, ban');
    expect(text).toContain('No player');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/player/ada'
    );
  });

  it('hides, restores and bans by entry, and offers verify on daily boards only', async () => {
    const { fixture, run, settle, buttons, boardEntries, entryOwners } =
      render();
    await settle();
    expect(buttons('Verify entry')).toHaveLength(0);
    // No ban for an entry nobody holds: only Ada's row offers it.
    expect(buttons('Ban')).toHaveLength(1);

    buttons('Hide entry')[0].click();
    await settle();
    expect(run).toHaveBeenLastCalledWith({
      type: 'board.hideEntry',
      bar: true,
      subject: 'Ada',
      target: { boardId: 'xp', entryId: 'e1' },
    });
    // The board shown reloads; its players are known already.
    expect(boardEntries).toHaveBeenCalledTimes(2);
    expect(boardEntries).toHaveBeenLastCalledWith('xp', null);
    expect(entryOwners).toHaveBeenCalledTimes(1);
    buttons('Restore on the boards')[0].click();
    await settle();
    expect(run).toHaveBeenLastCalledWith({
      type: 'board.restore',
      subject: 'Anonymous #0042',
      target: { boardId: 'xp', entryId: 'e2' },
    });
    buttons('Ban')[0].click();
    await settle();
    expect(run).toHaveBeenLastCalledWith({
      type: 'player.ban',
      ban: true,
      subject: 'Ada',
      target: { boardId: 'xp', entryId: 'e1' },
    });

    const component = fixture.componentInstance as unknown as {
      kind: { set: (kind: string) => void };
      day: { set: (day: string) => void };
      show: () => void;
    };
    component.kind.set('daily');
    component.day.set('');
    await settle();
    component.show();
    expect(boardEntries).not.toHaveBeenLastCalledWith(
      expect.stringMatching(/^daily/),
      null
    );
    component.day.set('2026-10-24');
    component.show();
    await settle();
    expect(boardEntries).toHaveBeenLastCalledWith('daily-2026-10-24', null);
    expect(fixture.nativeElement.textContent).toContain('Won in 900 ticks');
    expect(fixture.nativeElement.textContent).toContain(
      'Depth 4 · 60 s (unfinished)'
    );
    buttons('Verify entry')[0].click();
    await settle();
    expect(run).toHaveBeenLastCalledWith({
      type: 'board.verify',
      subject: 'Anonymous #0042',
      target: { boardId: 'daily-2026-10-24', entryId: 'd1' },
    });
  });
});
