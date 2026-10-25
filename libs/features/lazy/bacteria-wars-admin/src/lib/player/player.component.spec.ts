import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { defaultProfile } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { BehaviorSubject } from 'rxjs';
import { AdminActionsService } from '../moderation/admin-actions.service';
import {
  AdminRecordsService,
  type PlayerRecord,
} from '../moderation/admin-records.service';
import { PlayerComponent } from './player.component';

const PLAYER: PlayerRecord = {
  profile: { ...defaultProfile('ada'), name: 'Ada' },
  flags: { publicName: true, boardOptOut: false, galleryOptOut: false },
  member: {
    entries: [
      { boardId: 'xp', kind: 'xp', entryId: 'x1' },
      { boardId: 'endless', kind: 'endless', entryId: 'e1' },
    ],
    barred: ['endless'],
    activeAt: Date.UTC(2026, 9, 24),
  },
  ban: null,
  moderation: { resets: 1, imageRemovals: 0, hides: 2, bans: 0 },
  entries: [
    {
      boardId: 'xp',
      kind: 'xp',
      entryId: 'x1',
      record: { status: 'counted', hiddenBy: [], name: 'Ada', sort: 9 },
    },
    {
      boardId: 'endless',
      kind: 'endless',
      entryId: 'e1',
      record: { status: 'hidden', hiddenBy: ['admin'], name: null, sort: 3 },
    },
  ],
};

function render(player: PlayerRecord = PLAYER) {
  const params = new BehaviorSubject(convertToParamMap({ uid: 'ada' }));
  const stop = jest.fn();
  const watchPlayer = jest.fn(
    (_uid: string, next: (player: PlayerRecord) => void) => {
      next(player);
      return stop;
    }
  );
  const audit = jest.fn(async () => ({ rows: [], next: null }));
  const run = jest.fn(async () => ({ ok: true }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: params } },
      { provide: AdminRecordsService, useValue: { watchPlayer, audit } },
      { provide: AdminActionsService, useValue: { run } },
    ],
  });
  const fixture = TestBed.createComponent(PlayerComponent);
  fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  const button = (label: string, from: ParentNode = element) =>
    [...from.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith(label)
    ) as HTMLButtonElement;
  return { fixture, element, params, stop, watchPlayer, audit, run, button };
}

describe('PlayerComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the profile, entries, counters and audit of the player', async () => {
    const { fixture, element, watchPlayer, audit } = render();
    await fixture.whenStable();
    const text = element.textContent ?? '';
    expect(watchPlayer).toHaveBeenCalledWith('ada', expect.any(Function));
    expect(audit).toHaveBeenCalledWith({ by: 'uid', uid: 'ada' }, null);
    expect(text).toContain('Ada');
    expect(text).toContain('Name on the boards: Ada');
    expect(text).toContain('Barred from: endless');
    expect(text).toContain('counted');
    expect(text).toContain('owner');
    expect(text).toContain('Not banned.');
    expect(text).toContain('Hides');
  });

  it('runs the commands on the player and on an entry', async () => {
    const { fixture, element, run, audit, button } = render();
    button('Ban').click();
    await fixture.whenStable();
    expect(run).toHaveBeenLastCalledWith({
      type: 'player.ban',
      ban: true,
      subject: 'Ada',
      target: { uid: 'ada' },
    });
    expect(audit).toHaveBeenCalledTimes(2);

    const rows = element.querySelectorAll('.entries tbody tr');
    button('Hide entry', rows[0]).click();
    await fixture.whenStable();
    expect(run).toHaveBeenLastCalledWith({
      type: 'board.hideEntry',
      bar: true,
      subject: 'Ada',
      target: { boardId: 'xp', entryId: 'x1' },
    });
    button('Restore on the boards', rows[1]).click();
    await fixture.whenStable();
    expect(run).toHaveBeenLastCalledWith({
      type: 'board.restore',
      subject: 'Ada',
      target: { boardId: 'endless', entryId: 'e1' },
    });
  });

  it('offers to lift a ban, and says when it ended', async () => {
    const { element, button } = render({
      ...PLAYER,
      ban: { uid: 'ada', since: 1, until: 2, reason: 'spam' },
    });
    expect(button('Lift ban')).toBeDefined();
    expect(element.textContent).toContain('Spam');
    expect(element.textContent).toContain('hourly sweep');
  });

  it('follows another player, and stops on leaving', () => {
    const { fixture, params, stop, watchPlayer } = render();
    params.next(convertToParamMap({ uid: 'bob' }));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(watchPlayer).toHaveBeenLastCalledWith('bob', expect.any(Function));
    fixture.destroy();
    expect(stop).toHaveBeenCalledTimes(2);
  });
});
