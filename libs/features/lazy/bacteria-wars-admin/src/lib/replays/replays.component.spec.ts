import { TestBed } from '@angular/core/testing';
import { AdminActionsService } from '../moderation/admin-actions.service';
import type { StoredReplayRecord } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { ReplaysComponent } from './replays.component';

const STORED: StoredReplayRecord = {
  replayId: 'r9',
  state: 'verified',
  kind: 'local',
  levelId: 'l9',
  score: 64,
  publicId: null,
  galleryOut: false,
};

function render(stored: StoredReplayRecord | null = STORED) {
  const publicReplays = jest.fn(async () => ({
    rows: [
      {
        publicId: 'p1',
        replayId: 'r1',
        kind: 'online',
        levelId: 'arena',
        players: ['Ada', 'Anonymous #0042'],
        score: 70,
        featuredAt: Date.UTC(2026, 9, 25),
        featuredBy: 'admin' as const,
        anonymised: false,
      },
      {
        publicId: 'p2',
        replayId: 'r2',
        kind: 'local',
        levelId: 'l2',
        players: ['Anonymous #0001', 'computer'],
        score: 61,
        featuredAt: null,
        featuredBy: 'auto' as const,
        anonymised: true,
      },
    ],
    next: null,
  }));
  const candidateDays = jest.fn(async () => ({
    rows: [
      {
        day: '2026-10-24',
        checked: 3,
        published: ['r1'],
        candidates: [
          {
            replayId: 'r3',
            kind: 'local',
            levelId: 'daily-x',
            score: 58,
            reasons: ['close'],
          },
        ],
      },
    ],
    next: null,
  }));
  const storedReplay = jest.fn(async () => stored);
  const runReplay = jest.fn(async () => ({ ok: true }));
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AdminRecordsService,
        useValue: { publicReplays, candidateDays, storedReplay },
      },
      { provide: AdminActionsService, useValue: { runReplay } },
    ],
  });
  const fixture = TestBed.createComponent(ReplaysComponent);
  const element: HTMLElement = fixture.nativeElement;
  // A command reloads after it answers: let every promise run.
  const settle = async () => {
    for (let round = 0; round < 3; round++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve));
    }
    fixture.detectChanges();
  };
  const buttons = (label: string) =>
    [...element.querySelectorAll('button')].filter((b) =>
      b.textContent?.includes(label)
    ) as HTMLButtonElement[];
  const typeId = async (id: string) => {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = id;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return {
    fixture,
    element,
    publicReplays,
    storedReplay,
    runReplay,
    settle,
    buttons,
    typeId,
  };
}

describe('ReplaysComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the public replays and the runners-up', async () => {
    const { element, settle, buttons } = render();
    await settle();
    const text = element.textContent ?? '';
    expect(text).toContain('online · arena');
    expect(text).toContain('Ada – Anonymous #0042');
    expect(text).toContain('by you');
    expect(text).toContain('2026-10-24');
    expect(text).toContain('1 published, 3 re-run');
    expect(text).toContain('daily-x');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/replays/p1'
    );
    // The anonymised one offers no second anonymising.
    expect(buttons('Anonymise')).toHaveLength(1);
  });

  it('takes a public replay down and anonymises one, then reloads', async () => {
    const { runReplay, publicReplays, settle, buttons } = render();
    await settle();
    buttons('Take down from the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith(
      'unfeature',
      'p1',
      'online · arena'
    );
    expect(publicReplays).toHaveBeenCalledTimes(2);
    buttons('Anonymise')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith(
      'anonymise',
      'p1',
      'online · arena'
    );
  });

  it('features a runner-up', async () => {
    const { runReplay, settle, buttons } = render();
    await settle();
    buttons('Feature in the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith('feature', 'r3', 'r3');
  });

  it('looks up a stored replay by id and features it', async () => {
    const { element, storedReplay, runReplay, settle, buttons, typeId } =
      render();
    await settle();
    await typeId('bad id!');
    expect(buttons('Look up')[0].disabled).toBe(true);
    await typeId('r9');
    buttons('Look up')[0].click();
    await settle();
    expect(storedReplay).toHaveBeenCalledWith('r9');
    expect(element.textContent).toContain('local · l9 · verified');

    buttons('Feature in the gallery')[0].click();
    await settle();
    expect(runReplay).toHaveBeenLastCalledWith('feature', 'r9', 'r9');
    // Looked up again after the command, to show what changed.
    expect(storedReplay).toHaveBeenCalledTimes(2);
  });

  it('says when no stored replay has the id', async () => {
    const { element, settle, buttons, typeId } = render(null);
    await settle();
    await typeId('r404');
    buttons('Look up')[0].click();
    await settle();
    expect(element.textContent).toContain('No stored replay with this id.');
  });
});
